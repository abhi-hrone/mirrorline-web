import { apolloGetOrganization, apolloMatchDirector, domainFromApolloOrg } from "@/lib/apollo";
import { normalizeDomain } from "@/lib/domain";
import { getDb } from "@/lib/mongodb";
import { nameFromDomain } from "@/lib/past-users";
import type { DirectorCompany, DirectorMatch } from "@/lib/mock-data";

// Finds the other companies a director of an HROne customer sits on. One
// Apollo match for the person, then one organization lookup per current
// role, cached by name + customer so re-running costs nothing for a month.
// The standalone version of this is directorsearch.py at the repo root.

type DirectorDoc = { _id: string; match: DirectorMatch; checkedAt: Date };

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Never a target, whoever the director is.
const OWN_DOMAINS = new Set(["hrone.cloud"]);

// Titles that read as a board seat or ownership, not a job.
const BOARD_TITLE =
  /\b(board|chair(man|woman|person)?|founder|co-?founder|promoter|owner|proprietor|managing director|whole[- ]?time director|executive director|non[- ]executive|independent director|nominee director|additional director|designated partner|managing partner)\b/i;
// A bare "Director" is a board seat at Indian private companies, but
// "Director of Sales" is a job — flagged as maybe.
const PLAIN_DIRECTOR = /^\s*director\s*$/i;
const ANY_DIRECTOR = /\bdirector\b/i;

export function classifyTitle(title: string): DirectorCompany["kind"] {
  if (BOARD_TITLE.test(title) || PLAIN_DIRECTOR.test(title)) return "board";
  if (ANY_DIRECTOR.test(title)) return "maybe";
  return "job";
}

export async function lookupDirector(input: {
  name: string;
  customerDomain: string;
  linkedin?: string;
}): Promise<DirectorMatch> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) throw new Error("APOLLO_API_KEY is not set on the server.");

  const name = input.name.trim();
  const customerDomain = normalizeDomain(input.customerDomain);
  const cacheKey = `${name.toLowerCase()}|${customerDomain}|${(input.linkedin ?? "").trim().toLowerCase()}`;

  const db = await getDb().catch((err) => {
    console.error("Director cache unavailable", err);
    return null;
  });
  const cached = db
    ? await db
        .collection<DirectorDoc>("directors")
        .findOne({ _id: cacheKey })
        .catch(() => null)
    : null;
  if (cached && Date.now() - cached.checkedAt.getTime() < CACHE_TTL_MS) return cached.match;

  const person = await apolloMatchDirector(apiKey, {
    name,
    domain: customerDomain,
    linkedin_url: input.linkedin?.trim() || undefined,
  });

  const customer = {
    domain: customerDomain,
    name:
      normalizeDomain(person?.organization?.primary_domain ?? "") === customerDomain && person?.organization?.name
        ? person.organization.name
        : nameFromDomain(customerDomain),
  };

  let match: DirectorMatch;
  if (!person) {
    match = {
      status: "not_found",
      name,
      title: "",
      linkedin: "",
      location: "",
      customer,
      companies: [],
      checkedAt: new Date().toISOString(),
    };
  } else {
    // Roles they've left aren't board seats any more.
    const roles = (person.employment_history ?? []).filter((r) => r.current);
    let title = person.title ?? "";
    const companies: DirectorCompany[] = [];
    const seen = new Set<string>();
    // A handful of current roles at most, so one lookup each is fine.
    const orgs = await Promise.all(
      roles.map((r) =>
        r.organization_id
          ? apolloGetOrganization(apiKey, r.organization_id).catch((err) => {
              console.error("Apollo organization lookup failed", err);
              return null;
            })
          : Promise.resolve(null)
      )
    );
    roles.forEach((role, i) => {
      const org = orgs[i];
      const domain = normalizeDomain((org && domainFromApolloOrg(org)) || "");
      const roleTitle = role.title ?? "";
      if (domain === customerDomain) {
        // Their title at the customer, for the rep to sanity-check.
        title = roleTitle || title;
        if (org?.name) customer.name = org.name;
        return;
      }
      if (OWN_DOMAINS.has(domain)) return;
      const key = domain || role.organization_name?.toLowerCase() || "";
      if (!key || seen.has(key)) return; // the same company under two titles
      seen.add(key);
      companies.push({
        id: role.organization_id ?? `role-${i}`,
        name: org?.name ?? role.organization_name ?? nameFromDomain(domain),
        domain,
        title: roleTitle,
        kind: classifyTitle(roleTitle),
        employees: org?.estimated_num_employees ? String(org.estimated_num_employees) : "",
        location: [org?.city, org?.state, org?.organization_country ?? org?.country].filter(Boolean).join(", "),
        industry: org?.industry ?? "",
      });
    });
    match = {
      status: "found",
      name: person.name || name,
      title,
      linkedin: person.linkedin_url ?? "",
      location: [person.city, person.state, person.country].filter(Boolean).join(", "),
      customer,
      companies,
      checkedAt: new Date().toISOString(),
    };
  }

  if (db) {
    await db
      .collection<DirectorDoc>("directors")
      .updateOne(
        { _id: cacheKey },
        { $set: { _id: cacheKey, match, checkedAt: new Date() } },
        { upsert: true }
      )
      .catch((err) => console.error("Director cache save failed", err));
  }
  return match;
}
