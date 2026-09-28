import { getDb } from "@/lib/mongodb";

// Caches results from the three paid research calls (Ocean lookalikes, Ocean
// people search, Exa case studies) so re-seeding a campaign for a domain we've
// already researched reads from Mongo instead of spending API credits again.

type LookalikesDoc = { _id: string; domain: string; companies: unknown[]; fetchedAt: Date };
type CaseStudiesDoc = { _id: string; domain: string; caseStudies: unknown[]; fetchedAt: Date };
type ContactsDoc = {
  _id: string;
  domain: string;
  titles: string[];
  departments: string[];
  people: unknown[];
  source: string;
  fetchedAt: Date;
};
type RevealDoc = {
  _id: string;
  status: "pending" | "revealed" | "unavailable";
  email?: string;
  phone?: string;
  emailDone?: boolean;
  phoneDone?: boolean;
  updatedAt: Date;
};

function contactsKey(domain: string, titles: string[], departments: string[]) {
  const t = [...titles].sort().join(",");
  const d = [...departments].sort().join(",");
  return `${domain}::${t}::${d}`;
}

export async function getCachedLookalikes(domain: string) {
  const db = await getDb();
  const doc = await db.collection<LookalikesDoc>("lookalikes").findOne({ _id: domain });
  return doc?.companies ?? null;
}

export async function saveLookalikes(domain: string, companies: unknown[]) {
  const db = await getDb();
  await db
    .collection<LookalikesDoc>("lookalikes")
    .updateOne(
      { _id: domain },
      { $set: { _id: domain, domain, companies, fetchedAt: new Date() } },
      { upsert: true }
    );
}

export async function getCachedCaseStudies(domain: string) {
  const db = await getDb();
  const doc = await db.collection<CaseStudiesDoc>("caseStudies").findOne({ _id: domain });
  return doc?.caseStudies ?? null;
}

export async function saveCaseStudies(domain: string, caseStudies: unknown[]) {
  const db = await getDb();
  await db
    .collection<CaseStudiesDoc>("caseStudies")
    .updateOne(
      { _id: domain },
      { $set: { _id: domain, domain, caseStudies, fetchedAt: new Date() } },
      { upsert: true }
    );
}

export async function getCachedContacts(domain: string, titles: string[], departments: string[]) {
  const db = await getDb();
  const key = contactsKey(domain, titles, departments);
  const doc = await db.collection<ContactsDoc>("contacts").findOne({ _id: key });
  if (!doc) return null;
  // Older cache entries predate the `source` field; treat them as Ocean's
  // since Ocean was the only provider in use at the time they were written.
  return { people: doc.people, source: doc.source ?? "Ocean" };
}

export async function saveContacts(
  domain: string,
  titles: string[],
  departments: string[],
  people: unknown[],
  source: string
) {
  const db = await getDb();
  const key = contactsKey(domain, titles, departments);
  await db.collection<ContactsDoc>("contacts").updateOne(
    { _id: key },
    { $set: { _id: key, domain, titles, departments, people, source, fetchedAt: new Date() } },
    { upsert: true }
  );
}

export async function getCachedReveal(personId: string) {
  const db = await getDb();
  const doc = await db.collection<RevealDoc>("reveals").findOne({ _id: personId });
  if (!doc) return null;
  const { status, email, phone, emailDone, phoneDone } = doc;
  return { status, email, phone, emailDone, phoneDone };
}

export async function getCachedReveals(personIds: string[]) {
  if (personIds.length === 0) return new Map<string, Omit<RevealDoc, "_id" | "updatedAt">>();
  const db = await getDb();
  const docs = await db
    .collection<RevealDoc>("reveals")
    .find({ _id: { $in: personIds } })
    .toArray();
  return new Map(
    docs.map((d) => [
      d._id,
      { status: d.status, email: d.email, phone: d.phone, emailDone: d.emailDone, phoneDone: d.phoneDone },
    ])
  );
}

export async function saveReveal(
  personId: string,
  data: Omit<RevealDoc, "_id" | "updatedAt">
) {
  const db = await getDb();
  await db
    .collection<RevealDoc>("reveals")
    .updateOne({ _id: personId }, { $set: { ...data, updatedAt: new Date() } }, { upsert: true });
}

// Atomically records one channel's webhook result. Ocean's email and phone
// webhooks arrive within milliseconds of each other, often on different
// serverless instances, so a read-merge-write of the whole document lets the
// later writer wipe the other channel's data. This only touches this
// channel's fields; "revealed" means at least one channel has come back.
export async function saveRevealChannel(
  personId: string,
  channel: "email" | "phone",
  value?: string
) {
  const db = await getDb();
  await db.collection<RevealDoc>("reveals").updateOne(
    { _id: personId },
    {
      $set: {
        status: "revealed",
        [`${channel}Done`]: true,
        ...(value ? { [channel]: value } : {}),
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );
}
