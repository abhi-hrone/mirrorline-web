import { NextRequest, NextResponse } from "next/server";
import { setPending } from "@/lib/reveal-store";

export const maxDuration = 120;

const OCEAN_SEARCH_URL = "https://api.ocean.io/v3/search/people";
const OCEAN_ENRICH_URL = "https://api.ocean.io/v2/enrich/person";
const MAX_COMPANIES = 15;
const PEOPLE_PER_COMPANY = 5;
// Only contacts located in these countries (ISO 3166-1 alpha-2).
const CONTACT_COUNTRIES = ["in"];

type OceanPerson = {
  name?: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  linkedinUrl?: string;
};

type CompanyInput = { name: string; domain: string; score: number };

// Kicks off an async email/phone reveal for one person via Ocean's Enrich Person
// API. Ocean delivers the result later as a webhook POST to our own
// /api/contacts/reveal-webhook route, so this only works once APP_BASE_URL points
// somewhere Ocean's servers can reach (not localhost). Returns the Ocean person id
// used to correlate that later webhook, or null if the reveal wasn't requested.
async function requestReveal(token: string, linkedinUrl: string): Promise<string | null> {
  const base = process.env.APP_BASE_URL;
  if (!base) return null;

  const webhookUrl = `${base.replace(/\/$/, "")}/api/contacts/reveal-webhook`;
  try {
    const res = await fetch(OCEAN_ENRICH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-token": token },
      body: JSON.stringify({
        person: { linkedin: linkedinUrl },
        revealEmails: { webhookUrl },
        revealPhones: { webhookUrl },
      }),
    });
    if (!res.ok) {
      console.error("Ocean reveal request failed", res.status, await res.text());
      return null;
    }
    const data = (await res.json()) as { id?: string };
    if (!data.id) return null;
    setPending(data.id);
    return data.id;
  } catch (err) {
    console.error("Ocean reveal request failed", err);
    return null;
  }
}

async function searchPeople(
  token: string,
  domain: string,
  titles: string[],
  departments: string[]
) {
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

export async function POST(req: NextRequest) {
  const token = process.env.OCEAN_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "OCEAN_API_TOKEN is not set on the server." },
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
      { error: "Pick at least one department or add a target title." },
      { status: 400 }
    );
  }

  const results = await Promise.allSettled(
    companies.map((c) => searchPeople(token, c.domain, titles, departments))
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length === results.length) {
    console.error("Ocean people search failed", (failures[0] as PromiseRejectedResult).reason);
    return NextResponse.json(
      { error: "Ocean people search failed. Check server logs." },
      { status: 502 }
    );
  }
  failures.forEach((f) =>
    console.error("Ocean people search failed for a company", (f as PromiseRejectedResult).reason)
  );

  const groups = companies.flatMap((c, i) => {
    const r = results[i];
    if (r.status !== "fulfilled" || r.value.length === 0) return [];
    return [
      {
        company: c.name,
        domain: c.domain,
        score: c.score,
        people: r.value.map((p) => ({
          name: p.name ?? [p.firstName, p.lastName].filter(Boolean).join(" "),
          title: p.jobTitle ?? "",
          // Ocean's people search returns no emails or phones; LinkedIn is the
          // handle, and requestReveal() below asks Ocean to fill the rest in.
          email: "",
          phone: "",
          linkedin: p.linkedinUrl ?? "",
          conf: "No email" as const,
          id: null as string | null,
          revealStatus: "unavailable" as "pending" | "unavailable",
        })),
      },
    ];
  });

  const revealTargets = groups.flatMap((g) => g.people.filter((p) => p.linkedin));
  await Promise.allSettled(
    revealTargets.map(async (p) => {
      const id = await requestReveal(token, p.linkedin);
      if (id) {
        p.id = id;
        p.revealStatus = "pending";
      }
    })
  );

  return NextResponse.json({ groups, failedCompanies: failures.length });
}
