"use client";

import Link from "next/link";
import { useWizard } from "@/lib/wizard-context";
import { SEQUENCE_STYLES } from "@/lib/mock-data";

export default function SequencePage() {
  const { emails, setEmailField } = useWizard();

  return (
    <div className="px-5 pt-[22px] sm:px-10 sm:pt-[38px]">
      <div className="flex max-w-[900px] flex-col gap-3.5">
        {emails.map((email, i) => (
          <div
            key={email.step}
            className="overflow-hidden rounded-[10px] border border-line bg-white"
          >
            <div className="flex flex-wrap items-center gap-3 border-b border-[#E8E2D5] bg-paper px-[18px] py-[13px]">
              <span className="font-mono text-[10.5px] tracking-[0.1em] text-teal uppercase">
                {email.step}
              </span>
              <span className="font-mono text-[10.5px] text-muted">
                {email.day}
              </span>
              <span
                className={`ml-auto rounded-full px-2 py-[3px] font-mono text-[9.5px] tracking-[0.09em] uppercase ${SEQUENCE_STYLES[email.state]}`}
              >
                {email.state}
              </span>
            </div>
            <div className="flex flex-col gap-3 p-[18px]">
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[9.5px] tracking-[0.11em] text-[#A39D8C] uppercase">
                  Subject
                </span>
                <input
                  value={email.subject}
                  onChange={(e) => setEmailField(i, "subject", e.target.value)}
                  className="rounded-md border border-line bg-paper px-3 py-2.5 text-sm font-medium"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[9.5px] tracking-[0.11em] text-[#A39D8C] uppercase">
                  Body
                </span>
                <textarea
                  rows={7}
                  value={email.body}
                  onChange={(e) => setEmailField(i, "body", e.target.value)}
                  className="rounded-md border border-line bg-paper p-3 text-sm leading-relaxed"
                />
              </label>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-[10.5px] text-muted">
                  Pulled from
                </span>
                {email.sources.map((source) => (
                  <span
                    key={source}
                    className="rounded-full border border-[#E5DAC0] bg-[#F2EDDF] px-[9px] py-[3px] text-[11.5px] text-[#7A5B27]"
                  >
                    {source}
                  </span>
                ))}
                <button className="ml-auto cursor-pointer rounded-md border border-line px-[13px] py-[7px] text-xs font-medium text-[#55513F]">
                  Rewrite this step
                </button>
              </div>
            </div>
          </div>
        ))}

        <Link
          href="/campaigns/new/review"
          className="cursor-pointer self-start rounded-md bg-teal px-[22px] py-3 text-sm font-semibold text-paper"
        >
          Send to review
        </Link>
      </div>
    </div>
  );
}
