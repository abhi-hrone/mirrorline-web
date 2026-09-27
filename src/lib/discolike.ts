// Second fallback provider, tried after both Ocean and Apollo fail. See
// /api/lookalikes and /api/contacts for where these are called. API
// reference: https://docs.discolike.com/

const DISCOLIKE_BASE_URL = "https://api.discolike.com/v1";

function discolikeHeaders(key: string) {
  return { "X-API-Key": key };
}

function buildUrl(
  path: string,
  params: Record<string, string | number | string[] | undefined>
): string {
  const url = new URL(`${DISCOLIKE_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, item);
    } else {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export type DiscolikeCompany = {
  domain: string;
  name?: string | null;
  employees?: string | null;
  similarity?: number | null;
  address?: { country?: string | null } | null;
};

// DiscoLike's /discover takes the seed domain directly as a lookalike filter
// — unlike Apollo, there's no separate "resolve domain to an org id" step.
export async function discolikeLookalikeCompanies(
  key: string,
  domain: string,
  isoCountries: string[],
  size: number
): Promise<DiscolikeCompany[]> {
  const url = buildUrl("/discover", {
    domain: [domain],
    country: isoCountries.map((c) => c.toUpperCase()),
    max_records: size,
  });
  const res = await fetch(url, { headers: discolikeHeaders(key) });
  if (!res.ok) {
    throw new Error(`DiscoLike /discover returned ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as DiscolikeCompany[];
}

export type DiscolikeContact = {
  persona_id: number;
  domain: string;
  name?: string | null;
  title?: string | null;
  email?: string | null;
  social_urls?: string[] | null;
};

export async function discolikeSearchPeople(
  key: string,
  domain: string,
  titles: string[],
  departments: string[],
  isoCountries: string[],
  size: number
): Promise<DiscolikeContact[]> {
  // /contacts requires max_records >= 20 even when only a handful of results
  // are wanted per company; results_by_company is what actually caps it.
  const url = buildUrl("/contacts", {
    domain: [domain],
    title: titles.length > 0 ? titles : undefined,
    department: departments.length > 0 ? departments : undefined,
    person_country: isoCountries.map((c) => c.toUpperCase()),
    max_records: Math.max(size, 20),
    results_by_company: size,
  });
  const res = await fetch(url, { headers: discolikeHeaders(key) });
  if (!res.ok) {
    throw new Error(`DiscoLike /contacts returned ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as DiscolikeContact[];
}

// DiscoLike's contact search already returns an email per result (unlike
// Ocean and Apollo, which need a separate reveal call) — so revealing here is
// just a narrower version of the same search, filtered to one name.
export async function discolikeRevealEmail(
  key: string,
  person: { name: string; domain: string }
): Promise<{ email?: string }> {
  const url = buildUrl("/contacts", {
    domain: [person.domain],
    name: person.name,
    max_records: 20,
  });
  const res = await fetch(url, { headers: discolikeHeaders(key) });
  if (!res.ok) {
    throw new Error(`DiscoLike /contacts (reveal) returned ${res.status}: ${await res.text()}`);
  }
  const contacts = (await res.json()) as DiscolikeContact[];
  return { email: contacts.find((c) => c.email)?.email ?? undefined };
}
