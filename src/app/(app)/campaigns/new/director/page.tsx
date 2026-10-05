"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import WizardModeToggle from "@/components/WizardModeToggle";
import { useWizard, type DirectorInput } from "@/lib/wizard-context";
import type { DirectorCompany } from "@/lib/mock-data";

const INPUTS: { field: keyof DirectorInput; label: string; placeholder: string; mono?: boolean }[] = [
  { field: "name", label: "Director's name", placeholder: "Karan Jain" },
  {
    field: "customerDomain",
    label: "HROne customer they direct",
    placeholder: "uneecops.com",
    mono: true,
  },
  {
    field: "linkedin",
    label: "LinkedIn URL (optional)",
    placeholder: "Pins the right person for common names",
    mono: true,
  },
];

const KIND_COPY: Record<DirectorCompany["kind"], { label: string; style: string }> = {
  board: { label: "Board seat", style: "bg-[#E7F0EC] text-teal" },
  maybe: { label: "Check title", style: "bg-[#F2EDDF] text-[#7A5B27]" },
  job: { label: "Job role", style: "bg-[#EEEBE3] text-[#6E6A5C]" },
};

export default function DirectorPage() {
  const router = useRouter();
  const {
    directorInput,
    setDirectorInput,
    directorMatch: match,
    directorStatus,
    directorError,
    lookupDirector,
    directorPicked,
    toggleDirectorCompany,
    addDirectorCompany,
    directorNamed,
    setDirectorNamed,
    confirmDirector,
  } = useWizard();
  const [draft, setDraft] = useState({ name: "", domain: "", title: "" });

  const canLookup = !!directorInput.name.trim() && /\.[a-z]{2,}/i.test(directorInput.customerDomain);
  const pickedCount = match ? match.companies.filter((c) => directorPicked[c.id] && c.domain).length : 0;
  const first = match?.name.split(/\s+/)[0] ?? "the director";

  const onAdd = () => {
    addDirectorCompany(draft);
    setDraft({ name: "", domain: "", title: "" });
  };

  const onContinue = () => {
    confirmDirector();
    router.push("/campaigns/new/case");
  };

  return (
    <div className="px-5 pt-[22px] sm:px-10 sm:pt-[38px]">
      <div className="flex max-w-[1060px] flex-col gap-5">
        <WizardModeToggle mode="director" />
        <p className="max-w-[680px] text-[15px] leading-relaxed text-[#55513F]">
          A director of a company that already runs on HROne. We find the other companies they sit
          on, then write to the HR team at each one — with the HROne company&apos;s case study as the
          proof.
        </p>

        <div className="rounded-[10px] border border-line bg-white p-5 sm:p-7">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-5">
            {INPUTS.map((input) => (
              <label key={input.field} className="flex flex-col gap-[7px]">
                <span className="font-mono text-[10.5px] tracking-[0.12em] text-[#6E6A5C] uppercase">
                  {input.label}
                </span>
                <input
                  value={directorInput[input.field]}
                  onChange={(e) => setDirectorInput(input.field, e.target.value)}
                  placeholder={input.placeholder}
                  className={`rounded-md border border-line bg-paper px-[13px] py-[11px] text-[14.5px] ${input.mono ? "font-mono" : ""}`}
                />
              </label>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3.5">
            <button
              type="button"
              onClick={lookupDirector}
              disabled={!canLookup || directorStatus === "loading"}
              className="cursor-pointer rounded-md bg-teal px-[22px] py-3 text-sm font-semibold text-paper disabled:opacity-60"
            >
              {directorStatus === "loading" ? "Looking them up…" : "Find their other companies"}
            </button>
            <span className="text-[12.5px] text-muted">One Apollo lookup · saved for 30 days</span>
          </div>
          {directorError && <p className="mt-3 text-[13px] text-[#B3402A]">{directorError}</p>}
        </div>

        {match && (
          <div className="flex flex-col gap-4 rounded-[10px] border border-line bg-white p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[15px] font-semibold">{match.name}</span>
              {match.title && <span className="text-[13px] text-[#55513F]">{match.title}</span>}
              {match.linkedin && (
                <a href={match.linkedin} target="_blank" rel="noreferrer" className="text-[12.5px] text-teal underline">
                  LinkedIn
                </a>
              )}
              <span className="ml-auto font-mono text-[11px] text-muted">
                Data as of {match.checkedAt.slice(0, 10)}
              </span>
            </div>

            {match.status === "not_found" ? (
              <p className="rounded-md bg-paper px-4 py-3 text-[13px] text-[#55513F]">
                Apollo couldn&apos;t match this person at {match.customer.domain}. Check the name and
                website, or add their LinkedIn URL.
              </p>
            ) : (
              <>
                <p className="text-[13.5px] text-[#55513F]">
                  Director at <span className="font-medium text-ink">{match.customer.name}</span>{" "}
                  <span className="font-mono text-[12px] text-muted">({match.customer.domain})</span>
                  {" · "}
                  {match.companies.length === 0
                    ? "Apollo lists no other current companies."
                    : `Apollo lists ${match.companies.length} other current ${match.companies.length === 1 ? "company" : "companies"}.`}
                </p>

                {match.companies.length > 0 && (
                  <div className="flex flex-col divide-y divide-[#EFEAE0] rounded-md border border-line">
                    {match.companies.map((c) => (
                      <label key={c.id} className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={!!directorPicked[c.id]}
                          disabled={!c.domain}
                          onChange={() => toggleDirectorCompany(c.id)}
                        />
                        <span className="flex min-w-[200px] flex-1 flex-col">
                          <span className="text-[14px] font-medium">{c.name}</span>
                          <span className="text-[12.5px] text-muted">
                            {c.title}
                            {c.domain ? (
                              <span className="font-mono"> · {c.domain}</span>
                            ) : (
                              " · no website on Apollo — add it below"
                            )}
                          </span>
                        </span>
                        <span className="flex flex-wrap gap-x-3 text-[12px] text-muted">
                          {c.employees && <span>{c.employees} employees</span>}
                          {c.industry && <span>{c.industry}</span>}
                          {c.location && <span>{c.location}</span>}
                        </span>
                        <span
                          className={`rounded-full px-2 py-[3px] font-mono text-[9.5px] tracking-[0.09em] uppercase ${KIND_COPY[c.kind].style}`}
                        >
                          {c.manual ? "Added" : KIND_COPY[c.kind].label}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                <p className="text-[12.5px] text-muted">
                  Apollo only knows the board seats on their public profile. Add any it missed — from
                  MCA filings, Zaubacorp or the account team.
                </p>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] items-end gap-3">
                  {(
                    [
                      { key: "name", label: "Company", placeholder: "Acme Industries", mono: false },
                      { key: "domain", label: "Website", placeholder: "acme.co.in", mono: true },
                      { key: "title", label: "Their role there", placeholder: "Director", mono: false },
                    ] as const
                  ).map((f) => (
                    <label key={f.key} className="flex flex-col gap-[7px]">
                      <span className="font-mono text-[10.5px] tracking-[0.12em] text-[#6E6A5C] uppercase">
                        {f.label}
                      </span>
                      <input
                        value={draft[f.key]}
                        onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className={`rounded-md border border-line bg-paper px-[13px] py-[10px] text-sm ${f.mono ? "font-mono" : ""}`}
                      />
                    </label>
                  ))}
                  <button
                    type="button"
                    onClick={onAdd}
                    disabled={!/\.[a-z]{2,}/i.test(draft.domain)}
                    className="cursor-pointer rounded-md border border-line bg-white px-3 py-[10px] text-sm font-medium text-[#55513F] disabled:opacity-50"
                  >
                    Add company
                  </button>
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-md bg-paper px-4 py-3 text-[13px] text-[#55513F]">
                  <input
                    type="checkbox"
                    checked={directorNamed}
                    onChange={(e) => setDirectorNamed(e.target.checked)}
                    className="mt-[3px]"
                  />
                  <span>
                    Name {first} in the emails. Leave this off unless {first} or their account
                    manager has agreed — the emails then only say a company sharing their board
                    already uses HROne.
                  </span>
                </label>
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3.5">
          <button
            type="button"
            onClick={onContinue}
            disabled={pickedCount === 0}
            className="cursor-pointer rounded-md bg-teal px-[22px] py-3 text-sm font-semibold text-paper disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue to case study
          </button>
          <span className="text-[12.5px] text-muted">
            {pickedCount > 0
              ? `${pickedCount} ${pickedCount === 1 ? "company" : "companies"} picked. We'll look for HROne's case study about ${match?.customer.name}.`
              : "Pick at least one company with a website."}
          </span>
        </div>
      </div>
    </div>
  );
}
