import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { CAMPAIGNS, STATS, STATUS_STYLES } from "@/lib/mock-data";

export default function CampaignsPage() {
  return (
    <>
      <PageHeader crumb="Home" title="Referral campaigns" />

      <div className="px-5 pt-[22px] sm:px-10 sm:pt-[38px]">
        <div className="flex max-w-[1180px] flex-col gap-[22px]">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3.5">
            {STATS.map((stat) => (
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
                <div className="mt-[3px] text-xs text-[#6E6A5C]">
                  {stat.note}
                </div>
              </div>
            ))}
          </div>

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

            {CAMPAIGNS.map((c) => (
              <Link
                key={c.name}
                href={`/campaigns/new/${c.openStep}${c.openStep === "review" ? `?status=${encodeURIComponent(c.status)}` : ""}`}
                className="grid cursor-pointer grid-cols-[minmax(0,2.1fr)_minmax(0,1.5fr)_92px_92px_minmax(0,1.3fr)] items-center gap-4 border-b border-[#F0EBE0] px-5 py-[15px] hover:bg-paper"
              >
                <div className="min-w-0">
                  <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[14.5px] font-semibold">
                    {c.name}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    Seed · {c.seed}
                  </div>
                </div>
                <div className="min-w-0 text-[12.5px] text-[#55513F]">
                  {c.owner}
                </div>
                <div className="font-mono text-sm">{c.targets}</div>
                <div className="font-mono text-sm text-teal">{c.replies}</div>
                <div>
                  <span
                    className={`rounded-full px-[9px] py-1 font-mono text-[9.5px] tracking-[0.1em] uppercase ${STATUS_STYLES[c.status]}`}
                  >
                    {c.status}
                  </span>
                </div>
              </Link>
            ))}

            <div className="grid grid-cols-[minmax(0,2.1fr)_minmax(0,1.5fr)_92px_92px_minmax(0,1.3fr)] gap-4 bg-paper px-5 py-[11px] font-mono text-[9.5px] tracking-[0.11em] text-[#A39D8C] uppercase">
              <span>Campaign</span>
              <span>Owners</span>
              <span>Targets</span>
              <span>Replies</span>
              <span>Status</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
