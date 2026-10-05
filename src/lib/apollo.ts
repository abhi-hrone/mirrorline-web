// Apollo is the primary provider for contact search/reveal (/api/contacts),
// with Ocean as its fallback. /api/lookalikes still tries Ocean first and
// uses Apollo as its fallback.

const APOLLO_BASE_URL = "https://api.apollo.io/api/v1";

// Ocean's country/location filters use ISO 3166-1 alpha-2 codes; Apollo's
// location filters take free-text names. Only "in" is used anywhere in this
// app today, so this map is intentionally small.
const ISO_TO_APOLLO_LOCATION: Record<string, string> = { in: "India" };

export function toApolloLocations(isoCountries: string[]): string[] {
  return isoCountries.map((c) => ISO_TO_APOLLO_LOCATION[c.toLowerCase()] ?? c);
}

function apolloHeaders(key: string) {
  return { "Content-Type": "application/json", "x-api-key": key };
}

export type ApolloPerson = {
  id?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  // Search hides last names, returning e.g. "Sh***" instead.
  last_name_obfuscated?: string;
  title?: string;
  linkedin_url?: string;
};

export async function apolloSearchPeople(
  key: string,
  domain: string,
  titles: string[],
  locations: string[],
  size: number
): Promise<ApolloPerson[]> {
  const res = await fetch(`${APOLLO_BASE_URL}/mixed_people/api_search`, {
    method: "POST",
    headers: apolloHeaders(key),
    body: JSON.stringify({
      q_organization_domains_list: [domain],
      ...(titles.length > 0 && { person_titles: titles }),
      person_locations: locations,
      per_page: size,
      page: 1,
    }),
  });
  if (!res.ok) {
    throw new Error(`Apollo people search returned ${res.status}: ${await res.text()}`);
  }
  // "mixed" search combines net-new people with contacts already saved to
  // the Apollo account; merge both since either can hold results.
  const data = (await res.json()) as { people?: ApolloPerson[]; contacts?: ApolloPerson[] };
  return [...(data.people ?? []), ...(data.contacts ?? [])];
}

// Apollo returns a matched person's email synchronously when
// reveal_personal_emails is set. Phone reveal exists too, but only via
// Apollo's own async webhook — not wired up here, so phone stays unrevealed
// on this path.
//
// Pass `id` (from apolloSearchPeople) whenever you have it: the people search
// only returns first names (last names come back obfuscated) and no LinkedIn
// URL, so matching on name + domain alone finds nothing. Matching by id is
// exact, and the response carries the full name and LinkedIn URL.
export async function apolloRevealEmail(
  key: string,
  person: {
    id?: string;
    first_name?: string;
    last_name?: string;
    domain: string;
    linkedin_url?: string;
  }
): Promise<{
  email?: string;
  matched: boolean;
  emailStatus?: string;
  name?: string;
  linkedin_url?: string;
}> {
  const res = await fetch(`${APOLLO_BASE_URL}/people/match`, {
    method: "POST",
    headers: apolloHeaders(key),
    body: JSON.stringify({
      id: person.id,
      first_name: person.first_name,
      last_name: person.last_name,
      domain: person.domain,
      linkedin_url: person.linkedin_url,
      reveal_personal_emails: true,
    }),
  });
  if (!res.ok) {
    throw new Error(`Apollo people/match returned ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    person?: {
      email?: string;
      email_status?: string;
      name?: string;
      linkedin_url?: string;
    };
  };
  const match = data.person;
  // Apollo answers with a placeholder address (email_not_unlocked@...) when
  // it matched someone but has no revealable email — never a real contact.
  const email = match?.email && !match.email.startsWith("email_not_unlocked") ? match.email : undefined;
  return {
    email,
    matched: !!match,
    emailStatus: match?.email_status,
    name: match?.name,
    linkedin_url: match?.linkedin_url,
  };
}

// One role from a person's profile, current or past.
export type ApolloEmployment = {
  organization_id?: string;
  organization_name?: string;
  title?: string;
  current?: boolean;
  start_date?: string;
  end_date?: string;
};

// Looks up one known person — a past HROne user — and returns where Apollo
// says they work now. With the email they had at their old company, Apollo
// matches on that first. Without it, name + old company's domain still finds
// people who've left, since Apollo matches on past employers too; the
// employment history is then how we check it's the right person. Personal
// emails aren't requested: the campaign writes to their new work address.
export type ApolloPersonMatch = {
  name?: string;
  title?: string;
  email?: string;
  linkedin_url?: string;
  city?: string;
  state?: string;
  country?: string;
  organization?: {
    name?: string;
    primary_domain?: string;
    website_url?: string;
    estimated_num_employees?: number;
  };
  employment_history?: ApolloEmployment[];
};

export async function apolloMatchPerson(
  key: string,
  person: { name: string; email?: string; domain?: string }
): Promise<ApolloPersonMatch | null> {
  const res = await fetch(`${APOLLO_BASE_URL}/people/match`, {
    method: "POST",
    headers: apolloHeaders(key),
    body: JSON.stringify({
      name: person.name,
      ...(person.email && { email: person.email }),
      ...(person.domain && { domain: person.domain }),
      reveal_personal_emails: false,
    }),
  });
  if (!res.ok) {
    throw new Error(`Apollo people/match returned ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { person?: ApolloPersonMatch | null };
  const match = data.person ?? null;
  // Same placeholder as in apolloRevealEmail: a match with no revealable email.
  if (match?.email?.startsWith("email_not_unlocked")) match.email = undefined;
  return match;
}

// Looks up a director of an HROne customer by name and the customer's
// domain. `employment_history` lists every role on their profile, board
// seats included — but only the ones they've listed publicly.
export type ApolloDirectorMatch = ApolloPersonMatch;

export async function apolloMatchDirector(
  key: string,
  person: { name: string; domain: string; linkedin_url?: string }
): Promise<ApolloDirectorMatch | null> {
  const res = await fetch(`${APOLLO_BASE_URL}/people/match`, {
    method: "POST",
    headers: apolloHeaders(key),
    body: JSON.stringify({
      name: person.name,
      domain: person.domain,
      ...(person.linkedin_url && { linkedin_url: person.linkedin_url }),
      reveal_personal_emails: false,
    }),
  });
  if (!res.ok) {
    throw new Error(`Apollo people/match returned ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { person?: ApolloDirectorMatch | null };
  return data.person ?? null;
}

export type ApolloOrganization = {
  id?: string;
  name?: string;
  primary_domain?: string;
  website_url?: string;
  country?: string;
  // HQ country. Accounts imported from a CRM carry the CRM's own `country`,
  // which can disagree with this (or be blank), so prefer this one.
  organization_country?: string;
  estimated_num_employees?: number;
  industry?: string;
  city?: string;
  state?: string;
};

// One organization by Apollo's ID — the IDs that employment_history carries.
export async function apolloGetOrganization(
  key: string,
  id: string
): Promise<ApolloOrganization | null> {
  const res = await fetch(`${APOLLO_BASE_URL}/organizations/${encodeURIComponent(id)}`, {
    headers: apolloHeaders(key),
  });
  if (!res.ok) {
    throw new Error(`Apollo organization ${id} returned ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { organization?: ApolloOrganization };
  return data.organization ?? null;
}

export async function apolloEnrichOrganization(
  key: string,
  domain: string
): Promise<ApolloOrganization | null> {
  const url = new URL(`${APOLLO_BASE_URL}/organizations/enrich`);
  url.searchParams.set("domain", domain);
  const res = await fetch(url.toString(), { headers: apolloHeaders(key) });
  if (!res.ok) {
    throw new Error(`Apollo organization enrich returned ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { organization?: ApolloOrganization };
  return data.organization ?? null;
}

export async function apolloSearchLookalikeCompanies(
  key: string,
  seedOrganizationId: string,
  locations: string[],
  size: number
): Promise<ApolloOrganization[]> {
  const res = await fetch(`${APOLLO_BASE_URL}/mixed_companies/search`, {
    method: "POST",
    headers: apolloHeaders(key),
    body: JSON.stringify({
      lookalike_organization_ids: [seedOrganizationId],
      organization_locations: locations,
      per_page: size,
      page: 1,
    }),
  });
  if (!res.ok) {
    throw new Error(`Apollo company search returned ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    organizations?: ApolloOrganization[];
    accounts?: ApolloOrganization[];
  };
  return [...(data.organizations ?? []), ...(data.accounts ?? [])];
}

const BULK_ENRICH_BATCH = 10; // Apollo's per-request maximum.
const BULK_ENRICH_CONCURRENCY = 3;

// Company search (mixed_companies/search) never returns an employee count,
// so headcount has to come from enrichment. Costs 1 Apollo credit per
// company — callers should pass only the domains that are actually missing
// a headcount. Returns domain -> employee count for the ones Apollo knew.
export async function apolloBulkEnrichHeadcounts(
  key: string,
  domains: string[]
): Promise<Map<string, number>> {
  const batches: string[][] = [];
  for (let i = 0; i < domains.length; i += BULK_ENRICH_BATCH) {
    batches.push(domains.slice(i, i + BULK_ENRICH_BATCH));
  }

  const counts = new Map<string, number>();
  const runBatch = async (batch: string[]) => {
    const res = await fetch(`${APOLLO_BASE_URL}/organizations/bulk_enrich`, {
      method: "POST",
      headers: apolloHeaders(key),
      body: JSON.stringify({ domains: batch }),
    });
    if (!res.ok) {
      throw new Error(`Apollo bulk enrich returned ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { organizations?: (ApolloOrganization | null)[] };
    // Results come back in request order, with null for domains Apollo
    // doesn't know — but match on domain anyway rather than trusting order.
    (data.organizations ?? []).forEach((o, i) => {
      if (!o?.estimated_num_employees) return;
      const domain = domainFromApolloOrg(o) ?? batch[i];
      counts.set(domain.toLowerCase(), o.estimated_num_employees);
      counts.set(batch[i].toLowerCase(), o.estimated_num_employees);
    });
  };

  // Keep whatever batches succeed; only fail outright if none did.
  const failures: unknown[] = [];
  for (let i = 0; i < batches.length; i += BULK_ENRICH_CONCURRENCY) {
    const results = await Promise.allSettled(
      batches.slice(i, i + BULK_ENRICH_CONCURRENCY).map(runBatch)
    );
    results.forEach((r) => r.status === "rejected" && failures.push(r.reason));
  }
  if (batches.length > 0 && failures.length === batches.length) throw failures[0];
  return counts;
}

export function domainFromApolloOrg(o: ApolloOrganization): string | null {
  if (o.primary_domain) return o.primary_domain;
  if (!o.website_url) return null;
  try {
    const u = new URL(o.website_url.startsWith("http") ? o.website_url : `https://${o.website_url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
