import { NextRequest, NextResponse } from "next/server";
import { normalizeDomain } from "@/lib/domain";
import { getCachedLookalikes, saveLookalikes } from "@/lib/research-cache";
import {
  apolloEnrichOrganization,
  apolloSearchLookalikeCompanies,
  domainFromApolloOrg,
  toApolloLocations,
} from "@/lib/apollo";
import { discolikeLookalikeCompanies } from "@/lib/discolike";
import { withFallback } from "@/lib/fallback";
import { createLogger, withRequestLog } from "@/lib/logger";

const log = createLogger("lookalikes");

const OCEAN_URL = "https://api.ocean.io/v3/search/companies";

const RELEVANCE_SCORE: Record<string, number> = { A: 92, B: 82, C: 72 };
const RETURNED_COMPANIES_LIMIT = 100;
// Only companies headquartered in these countries (ISO 3166-1 alpha-2).
const LOOKALIKE_COUNTRIES = ["in"];
const COMPANY_SIZES = [
    "201-500",
    "501-1000",
    "1001-5000",
    "5001-10000",
    "10001-50000",
    "50001-100000",
    "500000+"
]

const REGION_BY_COUNTRY: Record<string, string> = {
  nl: "Benelux", be: "Benelux", lu: "Benelux",
  de: "DACH", at: "DACH", ch: "DACH",
  se: "Nordics", no: "Nordics", dk: "Nordics", fi: "Nordics", is: "Nordics",
};

type OceanCompany = {
  domain?: string;
  name?: string;
  countries?: string[];
  primaryCountry?: string;
  companySize?: string;
  employeeCountOcean?: string;
};

type Company = {
  id: string;
  name: string;
  domain: string;
  score: number;
  size: string;
  region: string;
  fit: string;
};

function regionFor(country: string): string {
  const c = country.toLowerCase();
  return REGION_BY_COUNTRY[c] ?? (c ? c.toUpperCase() : "Other");
}

async function oceanLookalikes(token: string, domain: string): Promise<Company[]> {
  const res = await fetch(OCEAN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-token": token },
    body: JSON.stringify({
      size: RETURNED_COMPANIES_LIMIT,
      companiesFilters: {
        lookalikeDomains: [domain],
        primaryLocations: { includeCountries: LOOKALIKE_COUNTRIES },
        companySizes: COMPANY_SIZES,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Ocean returned ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    detail?: string;
    companies?: { company?: OceanCompany; relevance?: string | number }[];
  };

  const companies = (data.companies ?? []).flatMap((row, i) => {
    const c = row.company;
    if (!c?.domain) return [];
    const country = c.primaryCountry ?? c.countries?.[0] ?? "";
    const score =
      typeof row.relevance === "number"
        ? Math.round(row.relevance)
        : RELEVANCE_SCORE[String(row.relevance).toUpperCase()] ?? 70;
    return [
      {
        id: `ocean-${i}-${c.domain}`,
        name: c.name ?? c.domain,
        domain: c.domain,
        score,
        size: c.companySize ?? c.employeeCountOcean ?? "—",
        region: regionFor(country),
        fit: "",
      },
    ];
  });

  if (companies.length === 0) {
    // e.g. "Missing some `lookalikeDomains`" when Ocean doesn't know the seed domain.
    throw new Error(`Ocean found no lookalikes for ${domain}${data.detail ? ` (${data.detail})` : ""}`);
  }

  return companies;
}

// Apollo has no direct "lookalike domains" filter — resolve the seed domain
// to an Apollo organization id first, then ask for companies similar to it.
async function apolloLookalikes(key: string, domain: string): Promise<Company[]> {
  const seed = await apolloEnrichOrganization(key, domain);
  if (!seed?.id) {
    throw new Error(`Apollo has no organization on record for ${domain}`);
  }

  const orgs = await apolloSearchLookalikeCompanies(
    key,
    seed.id,
    toApolloLocations(LOOKALIKE_COUNTRIES),
    RETURNED_COMPANIES_LIMIT
  );

  const companies = orgs.flatMap((o, i) => {
    const orgDomain = domainFromApolloOrg(o);
    if (!orgDomain) return [];
    return [
      {
        id: `apollo-${i}-${orgDomain}`,
        name: o.name ?? orgDomain,
        domain: orgDomain,
        // Apollo doesn't return a relevance score like Ocean's A/B/C — it
        // already ranks by similarity, so approximate one from result order.
        score: Math.max(60, 90 - i),
        size: o.estimated_num_employees ? String(o.estimated_num_employees) : "—",
        region: regionFor(o.country ?? ""),
        fit: "",
      },
    ];
  });

  if (companies.length === 0) {
    throw new Error(`Apollo found no lookalikes for ${domain}`);
  }

  return companies;
}

async function discolikeLookalikes(key: string, domain: string): Promise<Company[]> {
  const results = await discolikeLookalikeCompanies(key, domain, LOOKALIKE_COUNTRIES, RETURNED_COMPANIES_LIMIT);

  const companies = results.flatMap((c, i) => {
    if (!c.domain) return [];
    return [
      {
        id: `discolike-${i}-${c.domain}`,
        name: c.name ?? c.domain,
        domain: c.domain,
        // DiscoLike's similarity score is 0-100 like Ocean's, when present.
        score: c.similarity ?? Math.max(60, 90 - i),
        size: c.employees ?? "—",
        region: regionFor(c.address?.country ?? ""),
        fit: "",
      },
    ];
  });

  if (companies.length === 0) {
    throw new Error(`DiscoLike found no lookalikes for ${domain}`);
  }

  return companies;
}

export const POST = withRequestLog("lookalikes", async (req: NextRequest) => {
  const oceanToken = process.env.OCEAN_API_TOKEN;
  const apolloKey = process.env.APOLLO_API_KEY;
  const discolikeKey = process.env.DISCOLIKE_API_KEY;
  if (!oceanToken && !apolloKey && !discolikeKey) {
    return NextResponse.json(
      {
        error:
          "None of OCEAN_API_TOKEN, APOLLO_API_KEY, or DISCOLIKE_API_KEY is set on the server.",
      },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const domain = typeof body.domain === "string" ? normalizeDomain(body.domain) : "";
  if (!domain) {
    return NextResponse.json({ error: "domain is required." }, { status: 400 });
  }

  const cached = await getCachedLookalikes(domain).catch((err) => {
    log.error("Lookalikes cache lookup failed", err, { domain });
    return null;
  });
  if (cached) {
    return NextResponse.json({ companies: cached, cached: true });
  }

  let companies: Company[];
  try {
    companies = await withFallback([
      oceanToken ? { name: "Ocean", run: () => oceanLookalikes(oceanToken, domain) } : null,
      apolloKey ? { name: "Apollo", run: () => apolloLookalikes(apolloKey, domain) } : null,
      discolikeKey
        ? { name: "DiscoLike", run: () => discolikeLookalikes(discolikeKey, domain) }
        : null,
    ]);
  } catch (err) {
    log.error("Lookalike search failed on every configured provider", err, { domain });
    return NextResponse.json(
      { error: `Lookalike search failed: ${(err as Error).message}` },
      { status: 502 }
    );
  }

  await saveLookalikes(domain, companies).catch((err) =>
    log.error("Lookalikes cache save failed", err, { domain })
  );

  return NextResponse.json({ companies });
});
