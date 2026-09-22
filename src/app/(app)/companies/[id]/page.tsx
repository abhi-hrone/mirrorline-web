import PageHeader from "@/components/PageHeader";
import { COMPANIES, COMPANY_MATCH_DETAIL } from "@/lib/mock-data";
import { notFound } from "next/navigation";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = COMPANIES.find((c) => c.id === id);
  if (!company) notFound();

  const detail = COMPANY_MATCH_DETAIL[id];

  return (
    <>
      <PageHeader crumb="Lookalikes" title="Company detail" />

      <div className="px-5 pt-[22px] sm:px-10 sm:pt-[38px]">
        <div className="grid max-w-[1180px] grid-cols-1 items-start gap-[22px] lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="rounded-[10px] border border-line bg-white p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-[18px]">
                <div className="min-w-0">
                  <h2 className="text-[23px] font-semibold tracking-[-0.015em]">
                    {company.name}
                  </h2>
                  <div className="mt-[5px] font-mono text-xs text-muted">
                    {company.domain}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
                    Ocean similarity
                  </div>
                  <div className="font-mono text-[30px] font-medium tracking-[-0.02em] text-teal">
                    {company.score}
                  </div>
                </div>
              </div>
              <div className="mt-[22px] grid grid-cols-[repeat(auto-fit,minmax(128px,1fr))] gap-4 border-t border-[#E8E2D5] pt-5">
                <div>
                  <div className="font-mono text-[9.5px] tracking-[0.11em] text-muted uppercase">
                    Headcount
                  </div>
                  <div className="mt-1 text-[13.5px] font-medium">
                    {company.size}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[9.5px] tracking-[0.11em] text-muted uppercase">
                    Region
                  </div>
                  <div className="mt-1 text-[13.5px] font-medium">
                    {company.region}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[9.5px] tracking-[0.11em] text-muted uppercase">
                    Industry
                  </div>
                  <div className="mt-1 text-[13.5px] font-medium">
                    {detail?.industry ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[9.5px] tracking-[0.11em] text-muted uppercase">
                    Revenue
                  </div>
                  <div className="mt-1 text-[13.5px] font-medium">
                    {detail?.revenue ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[9.5px] tracking-[0.11em] text-muted uppercase">
                    Tech
                  </div>
                  <div className="mt-1 text-[13.5px] font-medium">
                    {detail?.tech ?? "—"}
                  </div>
                </div>
              </div>
            </div>

            {detail && (
              <div className="rounded-[10px] border border-line bg-white p-5 sm:p-7">
                <h3 className="mb-1 text-sm font-semibold">
                  Why it matches {detail.matchAgainst}
                </h3>
                <p className="mb-[18px] text-[12.5px] text-muted">
                  Signal overlap returned by Ocean, ordered by weight.
                </p>
                <div className="flex flex-col gap-3.5">
                  {detail.signals.map((signal) => (
                    <div key={signal.label}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[13.5px] font-medium">
                          {signal.label}
                        </span>
                        <span className="font-mono text-[11.5px] text-[#6E6A5C]">
                          {signal.pct}%
                        </span>
                      </div>
                      <div className="mt-[7px] h-1 overflow-hidden rounded-full bg-canvas">
                        <div
                          className="h-full rounded-full bg-[#3E9384]"
                          style={{ width: `${signal.pct}%` }}
                        />
                      </div>
                      <div className="mt-1.5 text-xs text-[#6E6A5C]">
                        {signal.note}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-[10px] border border-line bg-white lg:sticky lg:top-[92px]">
            <div className="border-b border-[#E8E2D5] px-5 py-[17px]">
              <h3 className="text-sm font-semibold">Contacts</h3>
              <div className="mt-[3px] text-xs text-muted">
                Findymail · not run
              </div>
            </div>
            <div className="flex flex-col items-start gap-3.5 px-5 py-[26px]">
              <p className="text-[13px] leading-relaxed text-[#6E6A5C]">
                No contacts pulled yet. Findymail will return verified work
                emails for the titles in your ICP only.
              </p>
              <button className="cursor-pointer rounded-md bg-ink px-[18px] py-2.5 text-[13px] font-semibold text-paper">
                Find contacts
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
