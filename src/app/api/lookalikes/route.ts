import { NextRequest, NextResponse } from "next/server";

const OCEAN_URL = "https://api.ocean.io/v3/search/companies";
const RELEVANCE_SCORE: Record<string, number> = { A: 92, B: 82, C: 72 };
// Only companies headquartered in these countries (ISO 3166-1 alpha-2).
const LOOKALIKE_COUNTRIES = ["in"];

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

function normalizeDomain(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export async function POST(req: NextRequest) {
  const token = process.env.OCEAN_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "OCEAN_API_TOKEN is not set on the server." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const domain = typeof body.domain === "string" ? normalizeDomain(body.domain) : "";
  if (!domain) {
    return NextResponse.json({ error: "domain is required." }, { status: 400 });
  }

  try {
    const res = await fetch(OCEAN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-token": token },
      body: JSON.stringify({
        size: 25,
        companiesFilters: {
          lookalikeDomains: [domain],
          primaryLocations: { includeCountries: LOOKALIKE_COUNTRIES },
        },
      }),
    });

    if (!res.ok) {
      console.error("Ocean lookalike search failed", res.status, await res.text());
      return NextResponse.json(
        { error: `Ocean returned ${res.status}. Check server logs.` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      detail?: string;
      companies?: { company?: OceanCompany; relevance?: string | number }[];
    };

    const companies = (data.companies ?? []).flatMap((row, i) => {
      const c = row.company;
      if (!c?.domain) return [];
      const country = (c.primaryCountry ?? c.countries?.[0] ?? "").toLowerCase();
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
          region: REGION_BY_COUNTRY[country] ?? (country ? country.toUpperCase() : "Other"),
          fit: "",
        },
      ];
    });

    if (companies.length === 0) {
      // e.g. "Missing some `lookalikeDomains`" when Ocean doesn't know the seed domain.
      return NextResponse.json(
        { error: `Ocean found no lookalikes for ${domain}${data.detail ? ` (${data.detail})` : ""}.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ companies });
  } catch (err) {
    console.error("Ocean lookalike search failed", err);
    return NextResponse.json(
      { error: "Lookalike search failed. Check server logs." },
      { status: 502 }
    );
  }
}
