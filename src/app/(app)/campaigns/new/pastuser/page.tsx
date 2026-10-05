"use client";

import { useRouter } from "next/navigation";
import WizardModeToggle from "@/components/WizardModeToggle";
import { useWizard, type PastUserInput } from "@/lib/wizard-context";
import type { PastUserMatch } from "@/lib/mock-data";

type CurrentField = keyof NonNullable<PastUserMatch["current"]>;

// Name plus either the old email or the old company's website is enough.
const INPUTS: { field: keyof PastUserInput; label: string; placeholder: string; mono?: boolean }[] = [
  { field: "name", label: "Name", placeholder: "Priya Sharma" },
  {
    field: "oldCompanyDomain",
    label: "Old company website",
    placeholder: "oldcompany.com · or give their email",
    mono: true,
  },
  { field: "oldTitle", label: "Their position there (optional)", placeholder: "HR Manager" },
  {
    field: "email",
    label: "Email at their old company (optional)",
    placeholder: "priya@oldcompany.com",
    mono: true,
  },
  { field: "oldCompanyName", label: "Old company name (optional)", placeholder: "From the website" },
];

type Verification = NonNullable<PastUserMatch["verification"]>;

const VERIFY_COPY: Record<Verification["status"], { label: string; style: string }> = {
  confirmed: { label: "Confirmed by job history", style: "bg-[#E7F0EC] text-teal" },
  title_differs: { label: "Different position", style: "bg-[#F2EDDF] text-[#7A5B27]" },
  unconfirmed: { label: "Unconfirmed", style: "bg-[#F6E3DC] text-[#A0522D]" },
};

const CURRENT_FIELDS: { field: CurrentField; label: string; mono?: boolean }[] = [
  { field: "company", label: "New company" },
  { field: "domain", label: "New company website", mono: true },
  { field: "title", label: "Their title now" },
  { field: "email", label: "Their email now", mono: true },
];

const STATUS_COPY: Record<PastUserMatch["status"], { label: string; style: string }> = {
  moved: { label: "Moved", style: "bg-[#E7F0EC] text-teal" },
  same: { label: "Still at old company", style: "bg-[#F2EDDF] text-[#7A5B27]" },
  not_found: { label: "Not found", style: "bg-[#EEEBE3] text-[#6E6A5C]" },
};

export default function PastUserPage() {
  const router = useRouter();
  const {
    pastUserInput,
    setPastUserInput,
    pastUserMatch: match,
    setPastUserCurrent,
    pastUserStatus,
    pastUserError,
    lookupPastUser,
    enterPastUserManually,
    confirmPastUser,
  } = useWizard();

  const canLookup =
    !!pastUserInput.name.trim() &&
    (pastUserInput.email.includes("@") || /\.[a-z]{2,}/i.test(pastUserInput.oldCompanyDomain));
  const verification = match?.status === "not_found" ? undefined : match?.verification;
  const current = match?.current;
  const canContinue =
    match?.status === "moved" && !!current?.company.trim() && !!current.domain.trim() && current.email.includes("@");

  const onContinue = () => {
    confirmPastUser();
    router.push("/campaigns/new/case");
  };

  return (
    <div className="px-5 pt-[22px] sm:px-10 sm:pt-[38px]">
      <div className="flex max-w-[1060px] flex-col gap-5">
        <WizardModeToggle mode="pastUser" />
        <p className="max-w-[680px] text-[15px] leading-relaxed text-[#55513F]">
          Someone who used HROne at a previous company. We find where they work now, then write to
          them and to the HR team at their new company — with their old company&apos;s case study as
          the proof.
        </p>

        <div className="rounded-[10px] border border-line bg-white p-5 sm:p-7">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-5">
            {INPUTS.map((input) => (
              <label key={input.field} className="flex flex-col gap-[7px]">
                <span className="font-mono text-[10.5px] tracking-[0.12em] text-[#6E6A5C] uppercase">
                  {input.label}
                </span>
                <input
                  value={pastUserInput[input.field]}
                  onChange={(e) => setPastUserInput(input.field, e.target.value)}
                  placeholder={input.placeholder}
                  className={`rounded-md border border-line bg-paper px-[13px] py-[11px] text-[14.5px] ${input.mono ? "font-mono" : ""}`}
                />
              </label>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3.5">
            <button
              type="button"
              onClick={lookupPastUser}
              disabled={!canLookup || pastUserStatus === "loading"}
              className="cursor-pointer rounded-md bg-teal px-[22px] py-3 text-sm font-semibold text-paper disabled:opacity-60"
            >
              {pastUserStatus === "loading" ? "Looking them up…" : "Find where they are now"}
            </button>
            <span className="text-[12.5px] text-muted">One Apollo lookup · saved for 30 days</span>
          </div>
          {pastUserError && <p className="mt-3 text-[13px] text-[#B3402A]">{pastUserError}</p>}
        </div>

        {match && (
          <div className="flex flex-col gap-4 rounded-[10px] border border-line bg-white p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[15px] font-semibold">{match.name}</span>
              <span
                className={`rounded-full px-2 py-[3px] font-mono text-[9.5px] tracking-[0.09em] uppercase ${STATUS_COPY[match.status].style}`}
              >
                {STATUS_COPY[match.status].label}
              </span>
              {verification && (
                <span
                  className={`rounded-full px-2 py-[3px] font-mono text-[9.5px] tracking-[0.09em] uppercase ${VERIFY_COPY[verification.status].style}`}
                >
                  {VERIFY_COPY[verification.status].label}
                </span>
              )}
              <span className="ml-auto font-mono text-[11px] text-muted">
                Data as of {match.checkedAt.slice(0, 10)}
              </span>
            </div>

            {verification && (
              <p className="text-[12.5px] text-[#55513F]">
                {verification.status === "confirmed" &&
                  `Their job history shows: ${verification.role}.`}
                {verification.status === "title_differs" &&
                  `Their job history shows ${verification.role}, not "${pastUserInput.oldTitle}". Check it's the right person.`}
                {verification.status === "unconfirmed" &&
                  `${match.oldCompany.name} isn't in their job history, so this may be someone else with the same name. Check their LinkedIn before continuing.`}
              </p>
            )}

            <p className="text-[13.5px] text-[#55513F]">
              Used HROne at <span className="font-medium text-ink">{match.oldCompany.name}</span>{" "}
              <span className="font-mono text-[12px] text-muted">({match.oldCompany.domain})</span>
              {match.status === "moved" && current?.company && (
                <>
                  {" "}
                  → now at <span className="font-medium text-ink">{current.company}</span>
                </>
              )}
            </p>

            {match.status !== "moved" && (
              <div className="flex flex-wrap items-center gap-3 rounded-md bg-paper px-4 py-3 text-[13px] text-[#55513F]">
                <span>
                  {match.status === "same"
                    ? `Apollo still shows them at ${match.oldCompany.name}. Its job data can lag a move by weeks.`
                    : "Apollo couldn't match this person. Check the name and old company, add their old email, or add their new company yourself."}
                </span>
                <button
                  type="button"
                  onClick={enterPastUserManually}
                  className="cursor-pointer rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-[#55513F]"
                >
                  They&apos;ve moved — enter it manually
                </button>
              </div>
            )}

            {match.status === "moved" && current && (
              <>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4">
                  {CURRENT_FIELDS.map((f) => (
                    <label key={f.field} className="flex flex-col gap-[7px]">
                      <span className="font-mono text-[10.5px] tracking-[0.12em] text-[#6E6A5C] uppercase">
                        {f.label}
                      </span>
                      <input
                        value={current[f.field]}
                        onChange={(e) => setPastUserCurrent(f.field, e.target.value)}
                        className={`rounded-md border border-line bg-paper px-[13px] py-[10px] text-sm ${f.mono ? "font-mono" : ""}`}
                      />
                    </label>
                  ))}
                </div>
                {match.emailWarning && (
                  <p className="text-[12.5px] text-[#A0522D]">{match.emailWarning}</p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
                  {current.employees && <span>{current.employees} employees</span>}
                  {current.location && <span>{current.location}</span>}
                  {current.linkedin && (
                    <a href={current.linkedin} target="_blank" rel="noreferrer" className="text-teal underline">
                      LinkedIn
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3.5">
          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            className="cursor-pointer rounded-md bg-teal px-[22px] py-3 text-sm font-semibold text-paper disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue to case study
          </button>
          <span className="text-[12.5px] text-muted">
            {canContinue
              ? `We'll look for HROne's case study about ${match?.oldCompany.name}.`
              : "Needs their new company, its website and their email there."}
          </span>
        </div>
      </div>
    </div>
  );
}
