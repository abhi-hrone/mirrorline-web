"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { pickedCompanies, useWizard } from "@/lib/wizard-context";
import { REVIEW_CHECKS, STATUS_STYLES } from "@/lib/mock-data";

export default function ReviewPage() {
  return (
    <Suspense fallback={null}>
      <ReviewContent />
    </Suspense>
  );
}

function ReviewContent() {
  const searchParams = useSearchParams();
  const existingStatus = searchParams.get("status");
  // A campaign opened from the campaigns list that's already Sending or In
  // review has already cleared this checklist — show it locked/complete
  // instead of asking to re-approve something already live.
  const isExisting = existingStatus === "Sending" || existingStatus === "In review";

  const { seedName, checks, toggleCheck, launched, launch, picked, emails, companies } =
    useWizard();
  const allChecked = isExisting || checks.every(Boolean);
  const remaining = checks.filter((v) => !v).length;
  const companyCount = pickedCompanies(companies, picked).length;
  const campaignTitle = `${seedName.split(" ")[0]} × freight brokers, EU`;

  if (launched) {
    return (
      <div className="px-5 pt-[22px] sm:px-10 sm:pt-[38px]">
        <div className="max-w-[860px] flex flex-col gap-[18px]">
          <div className="rounded-xl bg-ink p-6 text-paper sm:p-11">
            <div className="font-mono text-[10.5px] tracking-[0.14em] text-accent uppercase">
              Scheduled
            </div>
            <h2 className="mt-[14px] mb-3 font-serif text-[clamp(28px,3.6vw,40px)] leading-[1.1]">
              First send goes out Tuesday, 08:00 CET.
            </h2>
            <p className="mb-[26px] max-w-[520px] text-[14.5px] leading-relaxed text-[#B5B0A1]">
              {companyCount} companies, 96 contacts, {emails.length} steps.
              Replies land in the shared inbox. Marcus and Priya are credited
              on anything that converts.
            </p>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-[18px] border-t border-[#332F22] pt-[22px]">
              {[
                { k: "Companies", v: String(companyCount) },
                { k: "Contacts", v: "96" },
                { k: "Steps", v: String(emails.length) },
                { k: "Window", v: "14 days" },
              ].map((stat) => (
                <div key={stat.k}>
                  <div className="font-mono text-[9.5px] tracking-[0.11em] text-muted uppercase">
                    {stat.k}
                  </div>
                  <div className="mt-[5px] font-mono text-xl font-medium">
                    {stat.v}
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/campaigns"
              className="mt-7 inline-block cursor-pointer rounded-md bg-paper px-[22px] py-3 text-sm font-semibold text-ink"
            >
              Back to campaigns
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-[22px] sm:px-10 sm:pt-[38px]">
      <div className="flex max-w-[860px] flex-col gap-[18px]">
        <div className="rounded-[10px] border border-line bg-white p-5 sm:p-7">
          <h2 className="mb-1 text-[17px] font-semibold">{campaignTitle}</h2>
          <p className="mb-[22px] text-[13px] text-muted">
            {isExisting
              ? "Every line below was cleared before this campaign went live."
              : "Nothing sends until every line below is cleared."}
          </p>
          <div className="flex flex-col">
            {REVIEW_CHECKS.map((check, i) => {
              const done = isExisting || checks[i];
              return (
                <button
                  key={check.label}
                  onClick={() => !isExisting && toggleCheck(i)}
                  disabled={isExisting}
                  className={`flex w-full items-start gap-3 border-b border-[#F0EBE0] py-3.5 text-left last:border-b-0 ${
                    isExisting ? "cursor-default" : "cursor-pointer"
                  }`}
                >
                  <span
                    className={`mt-0.5 grid h-[19px] w-[19px] flex-none place-items-center rounded-[5px] border text-[11px] text-paper ${
                      done ? "border-teal bg-teal" : "border-[#C9C2B0] bg-white"
                    }`}
                  >
                    {done ? "✓" : ""}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={`block text-sm font-medium ${done ? "text-ink" : "text-[#55513F]"}`}
                    >
                      {check.label}
                    </span>
                    <span className="mt-0.5 block text-[12.5px] text-muted">
                      {check.note}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3.5">
          {[
            { k: "Companies", v: String(companyCount) },
            { k: "Contacts", v: "96" },
            { k: "Steps", v: String(emails.length) },
            { k: "Window", v: "14 days" },
          ].map((stat) => (
            <div
              key={stat.k}
              className="rounded-[10px] border border-line bg-white px-[17px] py-[15px]"
            >
              <div className="font-mono text-[9.5px] tracking-[0.11em] text-muted uppercase">
                {stat.k}
              </div>
              <div className="mt-1.5 font-mono text-[21px] font-medium">
                {stat.v}
              </div>
            </div>
          ))}
        </div>

        {isExisting ? (
          <div className="flex flex-wrap items-center gap-4">
            <span
              className={`rounded-full px-[14px] py-2 font-mono text-[11px] tracking-[0.08em] uppercase ${STATUS_STYLES[existingStatus as "Sending" | "In review"]}`}
            >
              {existingStatus}
            </span>
            <span className="text-[12.5px] text-muted">
              {existingStatus === "Sending"
                ? "First send already went out. Replies land in the shared inbox."
                : "Awaiting final sign-off from the team before sending starts."}
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={launch}
              disabled={!allChecked}
              className={`rounded-md px-[26px] py-[13px] text-[14.5px] font-semibold text-paper ${
                allChecked ? "cursor-pointer bg-teal" : "cursor-not-allowed bg-[#B8B2A0]"
              }`}
            >
              Approve & schedule
            </button>
            <span className="text-[12.5px] text-muted">
              {allChecked
                ? "All clear. Sending starts Tuesday 08:00 CET."
                : `${remaining} checks remaining`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
