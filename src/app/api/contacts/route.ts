import { NextRequest, NextResponse } from "next/server";
import { setPending } from "@/lib/reveal-store";
import { getCachedContacts, saveContacts, getCachedReveals, saveReveal } from "@/lib/research-cache";
import { apolloRevealEmail, apolloSearchPeople, toApolloLocations } from "@/lib/apollo";

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
type ContactConfidence = "Verified" | "Risky" | "Guessed" | "No email";
type PersonOut = {
  name: string;
  title: string;
  email: string;
  phone: string;
  linkedin: string;
  conf: ContactConfidence;
  id: string | null;
  revealStatus: "pending" | "unavailable";
};

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
    name: p.name ?? [p.first_name, p.last_name].filter(Boolean).join(" "),
    firstName: p.first_name,
    lastName: p.last_name,
    jobTitle: p.title,
    linkedinUrl: p.linkedin_url,
  }));
}

async function searchPeople(
  oceanToken: string | undefined,
  apolloKey: string | undefined,
  domain: string,
  titles: string[],
  departments: string[]
): Promise<OceanPerson[]> {
  const cached = await getCachedContacts(domain, titles, departments).catch((err) => {
    console.error("Contacts cache lookup failed", err);
    return null;
  });
  if (cached) return cached as OceanPerson[];

  let people: OceanPerson[];
  if (oceanToken) {
    try {
      people = await oceanSearchPeople(oceanToken, domain, titles, departments);
    } catch (err) {
      console.error("Ocean people search failed, falling back to Apollo", domain, err);
      if (!apolloKey) throw err;
      people = await apolloSearchPeopleForDomain(apolloKey, domain, titles);
    }
  } else if (apolloKey) {
    people = await apolloSearchPeopleForDomain(apolloKey, domain, titles);
  } else {
    throw new Error("Neither OCEAN_API_TOKEN nor APOLLO_API_KEY is set on the server.");
  }

  await saveContacts(domain, titles, departments, people).catch((err) =>
    console.error("Contacts cache save failed", err)
  );

  return people;
}

export async function POST(req: NextRequest) {
  const oceanToken = process.env.OCEAN_API_TOKEN;
  const apolloKey = process.env.APOLLO_API_KEY;
  if (!oceanToken && !apolloKey) {
    return NextResponse.json(
      { error: "Neither OCEAN_API_TOKEN nor APOLLO_API_KEY is set on the server." },
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
    companies.map((c) => searchPeople(oceanToken, apolloKey, c.domain, titles, departments))
  );

  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length === results.length) {
    console.error("People search failed on all companies", (failures[0] as PromiseRejectedResult).reason);
    return NextResponse.json(
      { error: "People search failed. Check server logs." },
      { status: 502 }
    );
  }
  failures.forEach((f) =>
    console.error("People search failed for a company", (f as PromiseRejectedResult).reason)
  );

  const groups = companies.flatMap((c, i) => {
    const r = results[i];
    if (r.status !== "fulfilled" || r.value.length === 0) return [];
    return [
      {
        company: c.name,
        domain: c.domain,
        score: c.score,
        people: r.value.map((p): PersonOut => ({
          name: p.name ?? [p.firstName, p.lastName].filter(Boolean).join(" "),
          title: p.jobTitle ?? "",
          // Ocean's people search returns no emails or phones; requestReveals()
          // below asks Ocean to fill the rest in, keyed by this person's id.
          email: "",
          phone: "",
          linkedin: p.linkedinUrl ?? "",
          conf: "No email",
          id: p.id ?? null,
          revealStatus: "unavailable",
        })),
      },
    ];
  });

  const revealTargets = groups.flatMap((g) =>
    g.people.filter((p) => p.id).map((p) => ({ person: p, domain: g.domain }))
  );

  const cachedReveals = await getCachedReveals(revealTargets.map((t) => t.person.id as string)).catch(
    (err) => {
      console.error("Reveal cache lookup failed", err);
      return new Map<string, { status: string; email?: string; phone?: string }>();
    }
  );

  // A cached "revealed" contact already has its final email/phone from a
  // prior run — reuse it instead of spending another reveal credit.
  // Anything not fully revealed yet (or never requested) gets a fresh ask.
  const toRequest = revealTargets.filter(({ person: p }) => {
    const cached = cachedReveals.get(p.id as string);
    if (!cached || cached.status !== "revealed") return true;
    p.email = cached.email ?? "";
    p.phone = cached.phone ?? "";
    p.conf = cached.email ? "Verified" : p.conf;
    p.revealStatus = "unavailable";
    return false;
  });

  const accepted = oceanToken
    ? await requestReveals(
        oceanToken,
        toRequest.map((t) => t.person.id as string)
      )
    : false;

  if (accepted) {
    toRequest.forEach(({ person: p }) => {
      setPending(p.id as string);
      p.revealStatus = "pending";
    });
  } else if (apolloKey) {
    // Ocean's reveal request itself failed (or Ocean isn't configured) —
    // fall back to Apollo's synchronous email match per person. Apollo can
    // reveal phone numbers too, but only via its own async webhook, which
    // isn't wired up here to keep this fallback simple, so phone stays
    // unrevealed on this path.
    await Promise.all(
      toRequest.map(async ({ person: p, domain }) => {
        p.revealStatus = "unavailable";
        const [firstName, ...rest] = p.name.trim().split(/\s+/);
        try {
          const { email } = await apolloRevealEmail(apolloKey, {
            first_name: firstName,
            last_name: rest.join(" "),
            domain,
            linkedin_url: p.linkedin || undefined,
          });
          if (email) {
            p.email = email;
            p.conf = "Verified";
            await saveReveal(p.id as string, {
              status: "revealed",
              email,
              emailDone: true,
              phoneDone: false,
            }).catch((err) => console.error("Apollo reveal cache save failed", err));
          }
        } catch (err) {
          console.error("Apollo reveal fallback failed for", p.id, err);
        }
      })
    );
  }

  return NextResponse.json({ groups, failedCompanies: failures.length });
}
