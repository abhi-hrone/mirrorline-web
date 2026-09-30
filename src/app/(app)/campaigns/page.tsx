import { Suspense } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { STATUS_STYLES } from "@/lib/mock-data";
import { listCampaigns, type CampaignRow } from "@/lib/campaigns";

const ROW_GRID =
  "grid grid-cols-[minmax(0,2.1fr)_minmax(0,1.1fr)_92px_92px_minmax(0,1.3fr)] gap-4";

export default function CampaignsPage() {
  return (
    <>
      <PageHeader crumb="Home" title="Referral campaigns" />

      <div className="px-5 pt-[22px] sm:px-10 sm:pt-[38px]">
        <div className="flex max-w-[1180px] flex-col gap-[22px]">
          <Suspense fallback={<CampaignsSkeleton />}>
            <CampaignsBody />
          </Suspense>
        </div>
      </div>
    </>
  );
}

async function CampaignsBody() {
  const result = await listCampaigns();
  const campaigns = result.ok ? result.campaigns : [];

  return (
    <>
      <StatTiles stats={result.ok ? summarize(campaigns) : null} />

      <CampaignsTable>
        {!result.ok ? (
          <Message tone="error">
            Couldn&apos;t load campaigns from Smartlead: {result.error}
          </Message>
        ) : campaigns.length === 0 ? (
          <Message>
            No campaigns yet. Start one from a customer you&apos;ve already won.
          </Message>
        ) : (
          campaigns.map((c) => <CampaignRowLink key={c.id} c={c} />)
        )}
      </CampaignsTable>
    </>
  );
}

function summarize(campaigns: CampaignRow[]) {
  const sum = (pick: (c: CampaignRow) => number | null) =>
    campaigns.reduce((n, c) => n + (pick(c) ?? 0), 0);
  const live = campaigns.filter((c) => c.status === "Sending").length;
  const targets = sum((c) => c.targets);
  const sent = sum((c) => c.sent);
  const replies = sum((c) => c.replies);
  const pct = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "—");

  return [
    { label: "Live campaigns", value: String(live), note: `of ${campaigns.length} total` },
    {
      label: "Contacts targeted",
      value: targets.toLocaleString("en-IN"),
      note: `across ${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}`,
    },
    {
      label: "Contacts emailed",
      value: sent.toLocaleString("en-IN"),
      note: targets > 0 ? `${pct(sent, targets)} of targets` : "nothing sent yet",
    },
    {
      label: "Reply rate",
      value: pct(replies, sent),
      note: `${replies} repl${replies === 1 ? "y" : "ies"}`,
    },
  ];
}

function StatTiles({ stats }: { stats: { label: string; value: string; note: string }[] | null }) {
  const tiles = stats ?? [
    { label: "Live campaigns", value: "—", note: "unavailable" },
    { label: "Contacts targeted", value: "—", note: "unavailable" },
    { label: "Contacts emailed", value: "—", note: "unavailable" },
    { label: "Reply rate", value: "—", note: "unavailable" },
  ];
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3.5">
      {tiles.map((stat) => (
        <div
          key={stat.label}
          className="rounded-[10px] border border-line bg-white px-[18px] py-4"
        >
          <div className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
            {stat.label}
          </div>
          <div className="mt-[7px] font-mono text-[27px] font-medium tracking-[-0.02em]">
            {stat.value}
          </div>
          <div className="mt-[3px] text-xs text-[#6E6A5C]">{stat.note}</div>
        </div>
      ))}
    </div>
  );
}

function CampaignsTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3.5 border-b border-[#E8E2D5] px-5 py-4">
        <h2 className="text-[15px] font-semibold">Campaigns</h2>
        <Link
          href="/campaigns/new/seed"
          className="cursor-pointer rounded-md bg-ink px-4 py-2.5 text-[13px] font-semibold text-paper"
        >
          New campaign from a customer
        </Link>
      </div>

      <div
        className={`${ROW_GRID} border-b border-[#F0EBE0] bg-paper px-5 py-[11px] font-mono text-[9.5px] tracking-[0.11em] text-[#A39D8C] uppercase`}
      >
        <span>Campaign</span>
        <span>Created</span>
        <span>Targets</span>
        <span>Replies</span>
        <span>Status</span>
      </div>

      {children}
    </div>
  );
}

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

function CampaignRowLink({ c }: { c: CampaignRow }) {
  return (
    <a
      href={c.url}
      target="_blank"
      rel="noreferrer"
      className={`${ROW_GRID} cursor-pointer items-center border-b border-[#F0EBE0] px-5 py-[15px] last:border-b-0 hover:bg-paper`}
    >
      <div className="min-w-0">
        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[14.5px] font-semibold">
          {c.name}
        </div>
        <div className="mt-0.5 text-xs text-muted">Seed · {c.seed ?? "—"}</div>
      </div>
      <div className="min-w-0 text-[12.5px] text-[#55513F]">
        {dateFormat.format(new Date(c.createdAt))}
      </div>
      <div className="font-mono text-sm">{c.targets ?? "—"}</div>
      <div className="font-mono text-sm text-teal">{c.replies ?? "—"}</div>
      <div className="min-w-0">
        <span
          title={c.statusNote ?? undefined}
          className={`rounded-full px-[9px] py-1 font-mono text-[9.5px] tracking-[0.1em] uppercase ${STATUS_STYLES[c.status]}`}
        >
          {c.status}
        </span>
        {c.statusNote && (
          <div className="mt-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] text-muted">
            {c.statusNote}
          </div>
        )}
      </div>
    </a>
  );
}

function Message({ children, tone }: { children: React.ReactNode; tone?: "error" }) {
  return (
    <div className={`px-5 py-8 text-center text-[13px] ${tone === "error" ? "text-[#9B3D2E]" : "text-muted"}`}>
      {children}
    </div>
  );
}

function CampaignsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3.5">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[94px] animate-pulse rounded-[10px] border border-line bg-white" />
        ))}
      </div>
      <CampaignsTable>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="border-b border-[#F0EBE0] px-5 py-[15px] last:border-b-0">
            <div className="h-[38px] animate-pulse rounded bg-paper" />
          </div>
        ))}
      </CampaignsTable>
    </>
  );
}
