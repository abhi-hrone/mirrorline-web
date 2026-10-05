import Exa from "exa-js";
import { getDb } from "@/lib/mongodb";
import { normalizeDomain } from "@/lib/domain";

// Web research on one target company, used to personalize the sequence
// drafted for it. Two Exa searches: the company's own site (what it does,
// where it operates) and the last year of news that names it (expansions,
// funding, hiring, new plants). Each hit comes back as a short summary
// focused on what an HR/payroll seller could open with.
//
// Research is a nice-to-have: without an Exa key, or when Exa fails, the
// sequence is drafted from the lookalike facts alone.

export type ResearchFinding = {
  title: string;
  url: string;
  publishedDate: string;
  summary: string;
  source: "website" | "news";
};

type ResearchDoc = { _id: string; domain: string; findings: ResearchFinding[]; fetchedAt: Date };

// News goes stale; re-research a company after this long.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const NEWS_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

// The summary names the company so Exa can tell a page about it from a news
// roundup that merely mentions it — those come back as NOT RELEVANT.
const summaryQuery = (name: string) =>
  `Is this page mainly about the company ${name}? If not, reply exactly NOT RELEVANT. ` +
  `If it is, reply with only 2-3 factual sentences (no "yes", no preamble) on what it tells us about ${name}: what it does or sells, ` +
  "who its customers are, its size, locations, plants or offices, expansion, hiring, funding, " +
  "acquisitions, leadership changes or anything affecting its workforce. Keep numbers and dates exactly.";

async function getCached(domain: string) {
  const db = await getDb();
  const doc = await db.collection<ResearchDoc>("companyResearch").findOne({ _id: domain });
  if (!doc || Date.now() - doc.fetchedAt.getTime() > CACHE_TTL_MS) return null;
  return doc.findings;
}

async function saveCached(domain: string, findings: ResearchFinding[]) {
  const db = await getDb();
  await db
    .collection<ResearchDoc>("companyResearch")
    .updateOne(
      { _id: domain },
      { $set: { _id: domain, domain, findings, fetchedAt: new Date() } },
      { upsert: true }
    );
}

export async function researchCompany(name: string, rawDomain: string): Promise<ResearchFinding[]> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey || !name) return [];
  const domain = rawDomain ? normalizeDomain(rawDomain) : "";
  const cacheKey = domain || name.toLowerCase();

  const cached = await getCached(cacheKey).catch((err) => {
    console.error("Company research cache lookup failed", err);
    return null;
  });
  if (cached) return cached;

  const exa = new Exa(apiKey);
  const contents = { summary: { query: summaryQuery(name) } };

  const [site, news] = await Promise.allSettled([
    domain
      ? exa.search(`${name} company overview, operations, locations and careers`, {
          includeDomains: [domain],
          numResults: 4,
          contents,
        })
      : Promise.resolve({ results: [] }),
    exa.search(`${name} India news`, {
      category: "news",
      // Exa allows one phrase of up to five words; it keeps out namesakes.
      ...(name.split(/\s+/).length <= 5 ? { includeText: [name] } : {}),
      startPublishedDate: new Date(Date.now() - NEWS_WINDOW_MS).toISOString(),
      numResults: 5,
      contents,
    }),
  ]);

  const findings: ResearchFinding[] = [];
  const add = (
    result: PromiseSettledResult<{ results: { title: string | null; url: string; publishedDate?: string; summary?: string }[] }>,
    source: ResearchFinding["source"]
  ) => {
    if (result.status === "rejected") {
      console.error(`Exa ${source} research failed for ${name}`, result.reason);
      return;
    }
    for (const r of result.value.results) {
      // Strip any "Yes, this page is about X." preamble the summary opens with.
      const summary = (r.summary ?? "")
        .trim()
        .replace(/^(yes[,.]?\s*)?(this page is (mainly )?about[^.]*\.)?\s*/i, "");
      if (!summary || /^W*NOT RELEVANT/i.test(summary)) continue;
      findings.push({
        title: r.title ?? "",
        url: r.url,
        publishedDate: r.publishedDate?.slice(0, 10) ?? "",
        summary,
        source,
      });
    }
  };
  add(site, "website");
  add(news, "news");

  // Don't cache a total failure, so the next draft tries again.
  if (site.status === "fulfilled" || news.status === "fulfilled") {
    await saveCached(cacheKey, findings).catch((err) =>
      console.error("Company research cache save failed", err)
    );
  }
  return findings;
}
