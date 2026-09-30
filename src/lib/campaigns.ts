import { connection } from "next/server";
import { getDb } from "@/lib/mongodb";
import { createLogger } from "@/lib/logger";
import type { CampaignStatus } from "@/lib/mock-data";

const log = createLogger("campaigns");

const SMARTLEAD_BASE_URL = "https://server.smartlead.ai/api/v1";

// Smartlead is the source of truth for a campaign's status and send/reply
// numbers, but it knows nothing about the seed customer we cloned. The launch
// route records that here, keyed by Smartlead's campaign id, so the campaigns
// list can join the two.
type CampaignDoc = {
  _id: number;
  name: string;
  seedName: string;
  seedWebsite: string;
  companies: number;
  steps: number;
  createdAt: Date;
};

export async function saveLaunchedCampaign(doc: Omit<CampaignDoc, "createdAt">) {
  const db = await getDb();
  await db
    .collection<CampaignDoc>("campaigns")
    .updateOne(
      { _id: doc._id },
      { $set: doc, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
}

type SmartleadCampaign = {
  id: number;
  name: string;
  status: string;
  created_at: string;
  campaign_activity_logs?: { paused_reason?: string } | null;
};

// Smartlead returns every count in /analytics as a string.
type SmartleadAnalytics = {
  unique_sent_count?: string;
  reply_count?: string;
  campaign_lead_stats?: { total?: number };
};

const STATUS_MAP: Record<string, CampaignStatus> = {
  ACTIVE: "Sending",
  DRAFTED: "Draft",
  PAUSED: "Paused",
  STOPPED: "Stopped",
  COMPLETED: "Completed",
};

export type CampaignRow = {
  id: number;
  name: string;
  seed: string | null;
  createdAt: string;
  targets: number | null;
  sent: number | null;
  replies: number | null;
  status: CampaignStatus;
  statusNote: string | null;
  url: string;
};

export type CampaignsResult =
  | { ok: true; campaigns: CampaignRow[] }
  | { ok: false; error: string };

function smartleadUrl(path: string, apiKey: string) {
  return `${SMARTLEAD_BASE_URL}${path}?api_key=${encodeURIComponent(apiKey)}`;
}

function toNumber(v: string | number | undefined): number | null {
  const n = Number(v);
  return v === undefined || !Number.isFinite(n) ? null : n;
}

async function getAnalytics(id: number, apiKey: string): Promise<SmartleadAnalytics | null> {
  try {
    const res = await fetch(smartleadUrl(`/campaigns/${id}/analytics`, apiKey), {
      cache: "no-store",
    });
    if (!res.ok) {
      log.warn("Smartlead analytics fetch failed", { campaignId: id, status: res.status });
      return null;
    }
    return (await res.json()) as SmartleadAnalytics;
  } catch (err) {
    log.error("Smartlead analytics fetch failed", err, { campaignId: id });
    return null;
  }
}

async function getSeedMetadata(ids: number[]) {
  try {
    const db = await getDb();
    const docs = await db
      .collection<CampaignDoc>("campaigns")
      .find({ _id: { $in: ids } })
      .toArray();
    return new Map(docs.map((d) => [d._id, d]));
  } catch (err) {
    // Seeds are a nice-to-have on this page; the Smartlead numbers still render.
    log.error("Campaign metadata lookup failed", err);
    return new Map<number, CampaignDoc>();
  }
}

export async function listCampaigns(): Promise<CampaignsResult> {
  await connection();

  const apiKey = process.env.SMARTLEAD_API_KEY;
  if (!apiKey) return { ok: false, error: "SMARTLEAD_API_KEY is not set on the server." };

  let campaigns: SmartleadCampaign[];
  try {
    const res = await fetch(smartleadUrl("/campaigns/", apiKey), { cache: "no-store" });
    if (!res.ok) {
      log.error("Smartlead campaigns fetch failed", undefined, { status: res.status });
      return { ok: false, error: `Smartlead returned ${res.status} listing campaigns.` };
    }
    const data = await res.json();
    campaigns = Array.isArray(data) ? data : [];
  } catch (err) {
    log.error("Smartlead campaigns fetch failed", err);
    return { ok: false, error: "Couldn't reach Smartlead." };
  }

  campaigns = campaigns
    .filter((c) => c.status !== "ARCHIVED")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const ids = campaigns.map((c) => c.id);
  const [analytics, seeds] = await Promise.all([
    Promise.all(ids.map((id) => getAnalytics(id, apiKey))),
    getSeedMetadata(ids),
  ]);

  return {
    ok: true,
    campaigns: campaigns.map((c, i) => {
      const a = analytics[i];
      const status = STATUS_MAP[c.status] ?? "Draft";
      return {
        id: c.id,
        name: c.name,
        seed: seeds.get(c.id)?.seedName ?? null,
        createdAt: c.created_at,
        targets: toNumber(a?.campaign_lead_stats?.total),
        sent: toNumber(a?.unique_sent_count),
        replies: toNumber(a?.reply_count),
        status,
        statusNote: status === "Paused" ? c.campaign_activity_logs?.paused_reason ?? null : null,
        url: `https://app.smartlead.ai/app/email-campaigns-v2/${c.id}/analytics`,
      };
    }),
  };
}
