import { NextRequest, NextResponse } from "next/server";
import { getCachedContacts, saveContacts } from "@/lib/research-cache";
import { apolloSearchPeople, toApolloLocations } from "@/lib/apollo";
import { discolikeSearchPeople } from "@/lib/discolike";
import { withFallbackTagged } from "@/lib/fallback";
import { createLogger, withRequestLog } from "@/lib/logger";
import type { ContactConfidence } from "@/lib/contact-reveal";

export const maxDuration = 120;

const OCEAN_SEARCH_URL = "https://api.ocean.io/v3/search/people";
// Matches the lookalikes step's 100-company result size, so "select all" there
// is never silently truncated here.
const MAX_COMPANIES = 100;
// Searches run this many at a time: firing 100 at once trips provider rate
// limits (Apollo 429s), which would push every company onto the fallbacks.
const SEARCH_CONCURRENCY = 8;
const PEOPLE_PER_COMPANY = 5;
// Only contacts located in these countries (ISO 3166-1 alpha-2).
const CONTACT_COUNTRIES = ["in"];

// Like Promise.allSettled over `items`, but with at most `limit` in flight.
async function settleWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        try {
          results[i] = { status: "fulfilled", value: await fn(items[i]) };
        } catch (reason) {
          results[i] = { status: "rejected", reason };
        }
      }
    })
  );
  return results;
}

const logger = createLogger("contacts");
const log = (msg: string) => logger.info(msg);

type OceanPerson = {
  id?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  linkedinUrl?: string;
};

type CompanyInput = { name: string; domain: string; score: number };
type PersonOut = {
  name: string;
  title: string;
  email: string;
  phone: string;
  linkedin: string;
  conf: ContactConfidence;
  id: string | null;
};

async function oceanSearchPeople(
  token: string,
  domain: string,
  titles: string[],
  departments: string[]
): Promise<OceanPerson[]> {
  const res = await fetch(OCEAN_SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-token": token },
    body: JSON.stringify({
      size: PEOPLE_PER_COMPANY,
      companiesFilters: { includeDomains: [domain] },
      peopleFilters: {
        // Titles narrow within the chosen departments; either can be used alone.
        ...(titles.length > 0 && { jobTitleKeywords: { any_of: titles } }),
        ...(departments.length > 0 && { departments: { departments } }),
        countries: CONTACT_COUNTRIES,
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Ocean returned ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { people?: OceanPerson[] };
  return data.people ?? [];
}

// Apollo has no equivalent to Ocean's `departments` enum (see
// src/lib/departments.ts), so a department-only search (no titles) can't be
// narrowed the same way on this fallback path — it comes back broader.
async function apolloSearchPeopleForDomain(
  key: string,
  domain: string,
  titles: string[]
): Promise<OceanPerson[]> {
  const people = await apolloSearchPeople(
    key,
    domain,
    titles,
    toApolloLocations(CONTACT_COUNTRIES),
    PEOPLE_PER_COMPANY
  );
  return people.map((p) => ({
    id: p.id,
    name:
      p.name ?? [p.first_name, p.last_name ?? p.last_name_obfuscated].filter(Boolean).join(" "),
    firstName: p.first_name,
    lastName: p.last_name,
    jobTitle: p.title,
    linkedinUrl: p.linkedin_url,
  }));
}

async function discolikeSearchPeopleForDomain(
  key: string,
  domain: string,
  titles: string[],
  departments: string[]
): Promise<OceanPerson[]> {
  const contacts = await discolikeSearchPeople(
    key,
    domain,
    titles,
    departments,
    CONTACT_COUNTRIES,
    PEOPLE_PER_COMPANY
  );
  return contacts.map((c) => ({
    id: c.persona_id != null ? String(c.persona_id) : undefined,
    name: c.name ?? undefined,
    jobTitle: c.title ?? undefined,
    linkedinUrl: c.social_urls?.find((u) => u.includes("linkedin")) ?? undefined,
  }));
}

async function searchPeople(
  oceanToken: string | undefined,
  apolloKey: string | undefined,
  discolikeKey: string | undefined,
  domain: string,
  titles: string[],
  departments: string[]
): Promise<{ source: string; people: OceanPerson[] }> {
  const cached = await getCachedContacts(domain, titles, departments).catch((err) => {
    logger.error("Contacts cache lookup failed", err, { domain });
    return null;
  });
  if (cached) {
    log(`${domain}: search cache HIT (source=${cached.source}, ${cached.people.length} people)`);
    return { source: cached.source, people: cached.people as OceanPerson[] };
  }
  log(`${domain}: search cache MISS, querying providers`);

  const { name: source, value: people } = await withFallbackTagged([
    apolloKey
      ? { name: "Apollo", run: () => apolloSearchPeopleForDomain(apolloKey, domain, titles) }
      : null,
    oceanToken
      ? { name: "Ocean", run: () => oceanSearchPeople(oceanToken, domain, titles, departments) }
      : null,
    discolikeKey
      ? {
          name: "DiscoLike",
          run: () => discolikeSearchPeopleForDomain(discolikeKey, domain, titles, departments),
        }
      : null,
  ]);

  log(`${domain}: found ${people.length} people via ${source}`);
  await saveContacts(domain, titles, departments, people, source).catch((err) =>
    logger.error("Contacts cache save failed", err, { domain })
  );

  return { source, people };
}

export const POST = withRequestLog("contacts", async (req: NextRequest) => {
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
  const companies: CompanyInput[] = Array.isArray(body.companies)
    ? body.companies
        .filter((c: CompanyInput) => c && typeof c.domain === "string" && c.domain)
        .slice(0, MAX_COMPANIES)
    : [];
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((t): t is string => typeof t === "string" && !!t.trim()) : [];
  const titles = strings(body.titles);
  const departments = strings(body.departments);

  if (companies.length === 0) {
    return NextResponse.json({ error: "Pick at least one company." }, { status: 400 });
  }
  if (titles.length === 0 && departments.length === 0) {
    return NextResponse.json(
      { error: "Pick at least one target role or add a title keyword." },
      { status: 400 }
    );
  }

  log(
    `request: ${companies.length} companies, titles=[${titles.join(", ")}], departments=[${departments.join(", ")}]; ` +
      `providers configured: Apollo=${!!apolloKey}, Ocean=${!!oceanToken}, DiscoLike=${!!discolikeKey}`
  );

  const results = await settleWithLimit(companies, SEARCH_CONCURRENCY, (c) =>
    searchPeople(oceanToken, apolloKey, discolikeKey, c.domain, titles, departments)
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length === results.length) {
    logger.error("People search failed on all companies", (failures[0] as PromiseRejectedResult).reason);
    return NextResponse.json(
      { error: "People search failed. Check server logs." },
      { status: 502 }
    );
  }
  failures.forEach((f) =>
    logger.error("People search failed for a company", (f as PromiseRejectedResult).reason)
  );
  log(`search done: ${results.length - failures.length}/${results.length} companies succeeded`);

  const groups = companies.flatMap((c, i) => {
    const r = results[i];
    if (r.status !== "fulfilled" || r.value.people.length === 0) return [];
    return [
      {
        company: c.name,
        domain: c.domain,
        score: c.score,
        source: r.value.source,
        people: r.value.people.map((p): PersonOut => ({
          name: p.name ?? [p.firstName, p.lastName].filter(Boolean).join(" "),
          title: p.jobTitle ?? "",
          // Search only returns who and what role. Emails are revealed in a
          // second step, for just the contacts the user selects (see
          // /api/contacts/reveal).
          email: "",
          phone: "",
          linkedin: p.linkedinUrl ?? "",
          conf: "Not revealed",
          id: p.id ?? null,
        })),
      },
    ];
  });

  log(
    `done: ${groups.length} companies, ${groups.reduce((n, g) => n + g.people.length, 0)} people found (no emails revealed)`
  );

  return NextResponse.json({ groups, failedCompanies: failures.length });
});
