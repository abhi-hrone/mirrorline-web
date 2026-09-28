"use client";

import Link from "next/link";
import { useWizard } from "@/lib/wizard-context";
import { CASE_QS, CASE_SECTIONS } from "@/lib/mock-data";

export default function CaseStudyPage() {
  const {
    answers,
    setAnswer,
    caseContent,
    setCaseContent,
    fillStatus,
    fillError,
    fillFromContent,
  } = useWizard();

  return (
    <div className="px-5 pt-[22px] sm:px-10 sm:pt-[38px]">
      <div className="flex max-w-[820px] flex-col gap-4">
        <div className="flex flex-col gap-[14px] rounded-[10px] border border-line bg-white p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10.5px] tracking-[0.13em] text-teal uppercase">
              Fill from pasted content
            </span>
            <span className="h-px flex-1 bg-[#E8E2D5]" />
          </div>
          <span className="text-[12.5px] text-muted">
            Paste notes, a call transcript, or a draft write-up about the client and we&apos;ll
            fill in the fields below from it.
          </span>
          <textarea
            rows={6}
            value={caseContent}
            onChange={(e) => setCaseContent(e.target.value)}
            placeholder="Paste the client's story here…"
            className="rounded-md border border-line bg-paper px-[13px] py-[11px] text-sm leading-relaxed"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => fillFromContent()}
              disabled={fillStatus === "loading" || !caseContent.trim()}
              className="cursor-pointer rounded-md bg-teal px-[22px] py-3 text-sm font-semibold text-paper disabled:opacity-60"
            >
              {fillStatus === "loading" ? "Reading…" : "Fill form from content"}
            </button>
          </div>
          {fillStatus === "error" && (
            <p className="text-[12.5px] text-[#A0522D]">{fillError}</p>
          )}
        </div>

        {CASE_SECTIONS.map((section) => {
          const questions = CASE_QS.filter((q) => q.section === section.section);
          const filled = questions.filter(
            (q) => (answers[q.id] || "").trim().length > 2
          ).length;

          return (
            <div
              key={section.title}
              className="flex flex-col gap-[18px] rounded-[10px] border border-line bg-white p-5 sm:p-6"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10.5px] tracking-[0.13em] text-teal uppercase">
                  {section.title}
                </span>
                <span className="h-px flex-1 bg-[#E8E2D5]" />
                <span className="font-mono text-[10.5px] text-muted">
                  {filled}/{questions.length}
                </span>
              </div>

              {questions.map((q) => (
                <label key={q.id} className="flex flex-col gap-[7px]">
                  <span className="text-[13.5px] font-semibold leading-snug">
                    {q.label}
                  </span>
                  {q.long ? (
                    <textarea
                      rows={3}
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      placeholder={q.hint || "Add detail"}
                      className="rounded-md border border-line bg-paper px-[13px] py-[11px] text-sm leading-relaxed"
                    />
                  ) : (
                    <input
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      placeholder={q.hint || "Add detail"}
                      className="rounded-md border border-line bg-paper px-[13px] py-[11px] text-sm"
                    />
                  )}
                </label>
              ))}
            </div>
          );
        })}

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/campaigns/new/lookalikes"
            className="cursor-pointer rounded-md bg-teal px-[22px] py-3 text-sm font-semibold text-paper"
          >
            Find lookalikes
          </Link>
          <span className="text-[12.5px] text-muted">
            Saved continuously. Ocean only needs the domain.
          </span>
        </div>
      </div>
    </div>
  );
}
