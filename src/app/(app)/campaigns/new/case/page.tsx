"use client";

import Link from "next/link";
import { useWizard } from "@/lib/wizard-context";
import { CASE_QS, CASE_SECTIONS, CONTEXT_QS } from "@/lib/mock-data";

export default function CaseStudyPage() {
  const {
    answers,
    setAnswer,
    caseContent,
    setCaseContent,
    fillStatus,
    fillError,
    fillFromContent,
    mode,
    pastUserMatch,
    directorMatch,
    sequenceCompanies,
    knownCaseStatus,
    findKnownCaseStudy,
    selectedCaseStudyUrl,
  } = useWizard();
  const pastUserMode = mode === "pastUser";
  const directorMode = mode === "director";
  // Both modes start from one known HROne customer, so the case study is
  // looked up for that exact company.
  const knownMode = pastUserMode || directorMode;
  const oldCompany = directorMode
    ? (directorMatch?.customer.name ?? "their HROne company")
    : (pastUserMatch?.oldCompany.name ?? "their old company");
  const bareFact = directorMode
    ? `${oldCompany} uses HROne and shares a director with each company`
    : `${pastUserMatch?.name ?? "they"} used HROne at ${oldCompany}`;
  // With no client facts at all, past-user emails fall back to the one thing
  // we know: the person used HROne at their old company.
  const noCaseFacts = CASE_QS.filter((q) => !CONTEXT_QS.includes(q.id)).every(
    (q) => !(answers[q.id] || "").trim()
  );

  return (
    <div className="px-5 pt-[22px] sm:px-10 sm:pt-[38px]">
      <div className="flex max-w-[820px] flex-col gap-4">
        {knownMode && (
          <div className="flex flex-col gap-2 rounded-[10px] border border-line bg-white p-5 sm:p-6">
            <span className="font-mono text-[10.5px] tracking-[0.13em] text-teal uppercase">
              {oldCompany}&apos;s case study
            </span>
            {knownCaseStatus === "loading" && (
              <p className="text-[13.5px] text-[#55513F]">
                Looking for HROne&apos;s published case study about {oldCompany}… this can take a
                minute.
              </p>
            )}
            {knownCaseStatus === "found" && (
              <p className="text-[13.5px] text-[#55513F]">
                Filled from HROne&apos;s published case study
                {selectedCaseStudyUrl && (
                  <>
                    {" "}
                    (
                    <a href={selectedCaseStudyUrl} target="_blank" rel="noreferrer" className="text-teal underline">
                      source
                    </a>
                    )
                  </>
                )}
                . Check it&apos;s about {oldCompany} before moving on.
              </p>
            )}
            {(knownCaseStatus === "none" || knownCaseStatus === "error") && (
              <div className="flex flex-wrap items-center gap-3">
                <p className="flex-1 text-[13.5px] text-[#55513F]">
                  {knownCaseStatus === "none"
                    ? `HROne hasn't published a case study about ${oldCompany}.`
                    : "The case study search failed."}{" "}
                  Paste notes about their implementation below to fill the record. If you leave it
                  empty, the emails only say that {bareFact} — no numbers.
                </p>
                <button
                  type="button"
                  onClick={() => findKnownCaseStudy()}
                  className="cursor-pointer rounded-md border border-line px-3 py-1.5 text-xs font-medium text-[#55513F]"
                >
                  Search again
                </button>
              </div>
            )}
          </div>
        )}
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
            href={knownMode ? "/campaigns/new/contacts" : "/campaigns/new/lookalikes"}
            className="cursor-pointer rounded-md bg-teal px-[22px] py-3 text-sm font-semibold text-paper"
          >
            {pastUserMode
              ? `Find contacts at ${pastUserMatch?.current?.company ?? "their new company"}`
              : directorMode
                ? `Find contacts at ${sequenceCompanies.length} ${sequenceCompanies.length === 1 ? "company" : "companies"}`
                : "Find lookalikes"}
          </Link>
          <span className="text-[12.5px] text-muted">
            {knownMode
              ? noCaseFacts
                ? directorMode
                  ? `No case study facts — the emails will only mention that ${oldCompany} uses HROne.`
                  : "No case study facts — the emails will only mention that they used HROne."
                : "Saved continuously."
              : "Saved continuously. Ocean only needs the domain."}
          </span>
        </div>
      </div>
    </div>
  );
}
