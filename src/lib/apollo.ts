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

export type ApolloOrganization = {
  id?: string;
  name?: string;
  primary_domain?: string;
  website_url?: string;
  country?: string;
  estimated_num_employees?: number;
};

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
