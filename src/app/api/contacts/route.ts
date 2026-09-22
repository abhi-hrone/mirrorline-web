import { NextRequest, NextResponse } from "next/server";
import { setPending } from "@/lib/reveal-store";

export const maxDuration = 120;

const OCEAN_SEARCH_URL = "https://api.ocean.io/v3/search/people";
const OCEAN_REVEAL_EMAILS_URL = "https://api.ocean.io/v2/reveal/emails";
const OCEAN_REVEAL_PHONES_URL = "https://api.ocean.io/v2/reveal/phones";
const MAX_COMPANIES = 15;
const PEOPLE_PER_COMPANY = 5;
// Only contacts located in these countries (ISO 3166-1 alpha-2).
const CONTACT_COUNTRIES = ["in"];

type OceanPerson = {
  id?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  linkedinUrl?: string;
};

type CompanyInput = { name: string; domain: string; score: number };

// Kicks off an async email/phone reveal for a batch of people via Ocean's
// Reveal Emails/Phones APIs (personIds come from the search results above).
// Ocean delivers results later as webhook POSTs to our own
// /api/contacts/reveal-webhook route, so this only works once APP_BASE_URL
// points somewhere Ocean's servers can reach (not localhost). Returns whether
// at least one of the two reveal requests was accepted.
async function requestReveals(token: string, personIds: string[]): Promise<boolean> {
  const base = process.env.APP_BASE_URL;
  if (!base || personIds.length === 0) return false;

  const webhookUrl = `${base.replace(/\/$/, "")}/api/contacts/reveal-webhook`;
  const headers = { "Content-Type": "application/json", "x-api-token": token };
  const body = JSON.stringify({ personIds, webhookUrl });

  try {
    const [emailRes, phoneRes] = await Promise.all([
      fetch(OCEAN_REVEAL_EMAILS_URL, { method: "POST", headers, body }),
      fetch(OCEAN_REVEAL_PHONES_URL, { method: "POST", headers, body }),
    ]);
    if (!emailRes.ok) {
      console.error("Ocean reveal emails request failed", emailRes.status, await emailRes.text());
    }
    if (!phoneRes.ok) {
      console.error("Ocean reveal phones request failed", phoneRes.status, await phoneRes.text());
    }
    return emailRes.ok || phoneRes.ok;
  } catch (err) {
    console.error("Ocean reveal request failed", err);
    return false;
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
          // Ocean's people search returns no emails or phones; requestReveals()
          // below asks Ocean to fill the rest in, keyed by this person's id.
          email: "",
          phone: "",
          linkedin: p.linkedinUrl ?? "",
          conf: "No email" as const,
          id: p.id ?? null,
          revealStatus: "unavailable" as "pending" | "unavailable",
        })),
      },
    ];
  });

  const revealTargets = groups.flatMap((g) => g.people.filter((p) => p.id));
  const accepted = await requestReveals(
    token,
    revealTargets.map((p) => p.id as string)
  );
  if (accepted) {
    revealTargets.forEach((p) => {
      setPending(p.id as string);
      p.revealStatus = "pending";
    });
  }

  return NextResponse.json({ groups, failedCompanies: failures.length });
}
