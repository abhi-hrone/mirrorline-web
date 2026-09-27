"use client";

import Link from "next/link";
import { useWizard } from "@/lib/wizard-context";
import { CASE_QS, CASE_SECTIONS } from "@/lib/mock-data";

export default function CaseStudyPage() {
  const {
    answers,
    setAnswer,
    seedWebsite,
    caseStudyOptions,
    caseStudyStatus,
    caseStudyError,
    selectedCaseStudyUrl,
    findCaseStudies,
    selectCaseStudy,
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
              Find a case study
            </span>
            <span className="h-px flex-1 bg-[#E8E2D5]" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => findCaseStudies()}
              disabled={caseStudyStatus === "loading"}
              className="cursor-pointer rounded-md bg-teal px-[22px] py-3 text-sm font-semibold text-paper disabled:opacity-60"
            >
              {caseStudyStatus === "loading"
                ? "Searching hrone.cloud…"
                : "Search HROne case studies"}
            </button>
            <span className="text-[12.5px] text-muted">
              Finds case studies relevant to{" "}
              <span className="font-semibold">{seedWebsite || "the seed domain"}</span>.
            </span>
          </div>

          {caseStudyStatus === "error" && (
            <p className="text-[12.5px] text-[#A0522D]">{caseStudyError}</p>
          )}

          {caseStudyOptions.length > 0 && (
            <div className="flex flex-col gap-3">
              {caseStudyOptions.map((cs, i) => {
                const selected = selectedCaseStudyUrl === cs.sourceUrl;
                return (
                  <div
                    key={cs.sourceUrl || i}
                    className={`flex flex-col gap-2 rounded-md border p-4 ${
                      selected ? "border-teal bg-[#E7F0EC]" : "border-line bg-paper"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[13.5px] font-semibold">
                        {cs.customerName}
                        {cs.customerDomain ? (
                          <span className="font-normal text-muted"> · {cs.customerDomain}</span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        onClick={() => selectCaseStudy(cs)}
                        className="cursor-pointer rounded-md border border-teal px-3 py-1.5 text-[12.5px] font-semibold text-teal"
                      >
                        {selected ? "Selected — reapply" : "Use this case study"}
                      </button>
                    </div>
                    {cs.benefits && (
                      <p className="text-[13px] font-semibold text-teal">{cs.benefits}</p>
                    )}
                    {(cs.industry || cs.headcount || cs.locations) && (
                      <p className="text-[12px] text-muted">
                        {[cs.industry, cs.headcount, cs.locations].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {cs.solution && (
                      <p className="text-[12.5px] leading-relaxed text-[#4A4636]">
                        {cs.solution}
                      </p>
                    )}
                    {cs.sourceUrl && (
                      <a
                        href={cs.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[12px] text-muted underline"
                      >
                        {cs.sourceUrl}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
