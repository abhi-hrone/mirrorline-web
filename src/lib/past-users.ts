import { apolloMatchPerson, type ApolloEmployment } from "@/lib/apollo";
import { normalizeDomain } from "@/lib/domain";
import { getDb } from "@/lib/mongodb";
import type { PastUserMatch } from "@/lib/mock-data";

// Finds where a past HROne user works now. One Apollo call per person (two
// when the old email only brings back the old address), cached
// by email, or by name + old company, so re-running within a month is free.

// `history` is their Apollo job history, kept so a changed position can be
// re-checked without another lookup.
type PastUserDoc = { _id: string; match: PastUserMatch; history?: ApolloEmployment[]; checkedAt: Date };

// Job data goes stale; look a person up again after this long.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// An address on one of these says nothing about where the person worked, so
// the rep has to give the old company's website.
const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.in",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "rediffmail.com",
  "protonmail.com",
  "aol.com",
]);

export function emailDomain(email: string) {
  return email.trim().toLowerCase().split("@")[1] ?? "";
}

export function isPersonalEmail(email: string) {
  return PERSONAL_DOMAINS.has(emailDomain(email));
}

// "acme-industries.co.in" → "Acme Industries", for when the rep doesn't type
// the old company's name.
export function nameFromDomain(domain: string) {
  const label = normalizeDomain(domain).split(".")[0] ?? "";
  return label
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

// "HR Mgr" and "Human Resources Manager" should match; "Payroll Manager"
// and "HR Manager" shouldn't. Seniority words say nothing about the job.
const TITLE_ALIASES: [RegExp, string][] = [
  [/\bhr\b/g, "human resources"],
  [/\bmgr\b/g, "manager"],
  [/\bexec\b/g, "executive"],
  [/\bsr\b/g, "senior"],
];
const TITLE_NOISE = new Set(["senior", "junior", "assistant", "associate", "lead", "of", "and", "the", "at"]);

function titleWords(title: string) {
  let t = title.toLowerCase();
  for (const [re, to] of TITLE_ALIASES) t = t.replace(re, to);
  return new Set(t.split(/[^a-z]+/).filter((w) => w && !TITLE_NOISE.has(w)));
}

export function titlesMatch(given: string, actual: string) {
  const want = titleWords(given);
  const have = titleWords(actual);
  const overlap = [...want].filter((w) => have.has(w)).length;
  return want.size > 0 && overlap >= Math.min(2, want.size);
}

// Apollo names companies its own way ("Walsons Global Talent Mobility
// (WGTM)" for walsonshealthcare.com), so match loosely on the domain's
// label and on the name the rep gave.
function companyMatches(orgName: string, company: { name: string; domain: string }) {
  const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const firstWord = (s: string) => compact(s.split(/\s+/)[0] ?? "");
  const org = compact(orgName);
  const label = compact(company.domain.split(".")[0] ?? "");
  if (!org) return false;
  if (label && (org.includes(label) || label.includes(org))) return true;
  const orgFirst = firstWord(orgName);
  if (orgFirst.length >= 4 && (label.startsWith(orgFirst) || orgFirst === firstWord(company.name))) {
    return true;
  }
  return false;
}

function verify(
  history: ApolloEmployment[],
  oldCompany: { name: string; domain: string },
  oldTitle: string
): NonNullable<PastUserMatch["verification"]> {
  const roles = history.filter((r) => companyMatches(r.organization_name ?? "", oldCompany));
  if (roles.length === 0) return { status: "unconfirmed" };
  const best = (oldTitle && roles.find((r) => titlesMatch(oldTitle, r.title ?? ""))) || roles[0];
  const year = (d?: string) => d?.slice(0, 4);
  const span = [year(best.start_date), best.current ? "now" : year(best.end_date)].filter(Boolean).join("–");
  return {
    status: !oldTitle || titlesMatch(oldTitle, best.title ?? "") ? "confirmed" : "title_differs",
    role: `${best.title || "A role"} at ${best.organization_name}${span ? `, ${span}` : ""}`,
  };
}

// An address on the new company's domain (or a subdomain of it).
const onDomain = (email: string, domain: string) =>
  emailDomain(email) === domain || emailDomain(email).endsWith(`.${domain}`);

export async function lookupPastUser(input: {
  name: string;
  // Optional: name + old company's website is enough on its own.
  email?: string;
  oldCompanyName?: string;
  oldCompanyDomain?: string;
  // The position they held there, checked against their job history.
  oldTitle?: string;
}): Promise<PastUserMatch> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) throw new Error("APOLLO_API_KEY is not set on the server.");

  const name = input.name.trim();
  const email = (input.email ?? "").trim().toLowerCase();
  const oldTitle = (input.oldTitle ?? "").trim();
  const oldDomain = normalizeDomain(input.oldCompanyDomain || emailDomain(email));
  const oldCompany = {
    domain: oldDomain,
    name: input.oldCompanyName?.trim() || nameFromDomain(oldDomain),
  };
  // Keyed by email when there is one, as before; otherwise by name + company.
  const cacheKey = email || `name:${name.toLowerCase()}|${oldDomain}`;

  const db = await getDb().catch((err) => {
    console.error("Past user cache unavailable", err);
    return null;
  });
  const cached = db
    ? await db
        .collection<PastUserDoc>("pastUsers")
        .findOne({ _id: cacheKey })
        .catch(() => null)
    : null;
  // Entries saved before history was kept are looked up again once, so
  // they get the job-history check and the new-address retry.
  if (cached?.history && Date.now() - cached.checkedAt.getTime() < CACHE_TTL_MS) {
    // The rep may have corrected the old company or the position since;
    // keep their version and re-check it against the saved history.
    return {
      ...cached.match,
      name: name || cached.match.name,
      oldCompany,
      verification:
        cached.match.status !== "not_found" ? verify(cached.history, oldCompany, oldTitle) : undefined,
    };
  }

  let person = await apolloMatchPerson(apiKey, {
    name,
    email: email || undefined,
    domain: oldDomain,
  });
  const org = person?.organization;
  const currentDomain = normalizeDomain(org?.primary_domain || org?.website_url || "");

  // Given the old email, Apollo tends to hand that same address back. When
  // they've moved and there's no address at the new company, ask again
  // without it, which can return their new one (one more credit).
  if (
    person &&
    email &&
    currentDomain &&
    currentDomain !== oldDomain &&
    !(person.email && onDomain(person.email, currentDomain))
  ) {
    const retry = await apolloMatchPerson(apiKey, { name, domain: oldDomain }).catch((err) => {
      console.error("Past user retry without email failed", err);
      return null;
    });
    const samePerson =
      retry && (retry.linkedin_url ? retry.linkedin_url === person.linkedin_url : retry.name === person.name);
    if (samePerson && retry.email && onDomain(retry.email, currentDomain)) {
      person = { ...person, email: retry.email };
    }
  }

  const history = person?.employment_history ?? [];
  let match: PastUserMatch;
  if (!person || !currentDomain) {
    match = {
      status: "not_found",
      name,
      oldCompany,
      checkedAt: new Date().toISOString(),
    };
  } else {
    const newEmail = person.email ?? "";
    // An email still on the old domain (or on some third domain) is likely
    // stale — Apollo moved the person but kept an old address.
    const emailWarning =
      newEmail && !onDomain(newEmail, currentDomain)
        ? `This email is on ${emailDomain(newEmail)}, not ${currentDomain} — it may be out of date.`
        : !newEmail
          ? "Apollo has no work email for them at the new company. Add one before continuing."
          : undefined;
    match = {
      status: currentDomain === oldDomain ? "same" : "moved",
      name: person.name || name,
      oldCompany,
      current: {
        company: org?.name ?? nameFromDomain(currentDomain),
        domain: currentDomain,
        title: person.title ?? "",
        email: newEmail,
        linkedin: person.linkedin_url ?? "",
        employees: org?.estimated_num_employees ? String(org.estimated_num_employees) : "",
        location: [person.city, person.state, person.country].filter(Boolean).join(", "),
      },
      emailWarning,
      verification: verify(history, oldCompany, oldTitle),
      checkedAt: new Date().toISOString(),
    };
  }

  if (db) {
    await db
      .collection<PastUserDoc>("pastUsers")
      .updateOne(
        { _id: cacheKey },
        { $set: { _id: cacheKey, match, history, checkedAt: new Date() } },
        { upsert: true }
      )
      .catch((err) => console.error("Past user cache save failed", err));
  }
  return match;
}
