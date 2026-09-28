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

  const {
    campaignName,
    checks,
    toggleCheck,
    launched,
    launchStatus,
    launchError,
    smartleadCampaignUrl,
    leadsSent,
    sendingStarted,
    launch,
    picked,
    emails,
    companies,
    contactGroups,
  } = useWizard();
  const allChecked = isExisting || checks.every(Boolean);
  const remaining = checks.filter((v) => !v).length;
  const companyCount = pickedCompanies(companies, picked).length;
  const revealedContacts = contactGroups
    .flatMap((g) => g.people)
    .filter((p) => p.email).length;

  if (launched) {
    return (
      <div className="px-5 pt-[22px] sm:px-10 sm:pt-[38px]">
        <div className="max-w-[860px] flex flex-col gap-[18px]">
          <div className="rounded-xl bg-ink p-6 text-paper sm:p-11">
            <div className="font-mono text-[10.5px] tracking-[0.14em] text-accent uppercase">
              {sendingStarted ? "Sending" : "Pushed to Smartlead"}
            </div>
            <h2 className="mt-[14px] mb-3 font-serif text-[clamp(28px,3.6vw,40px)] leading-[1.1]">
              {sendingStarted
                ? "Sending started in Smartlead."
                : "Campaign created as a draft in Smartlead."}
            </h2>
            <p className="mb-[26px] max-w-[520px] text-[14.5px] leading-relaxed text-[#B5B0A1]">
              {companyCount} companies, {leadsSent} contacts, {emails.length}{" "}
              steps loaded.{" "}
              {sendingStarted
                ? "A connected sender mailbox was assigned automatically and the campaign is now live."
                : "No mailbox is connected in Smartlead yet, so it couldn't start automatically — head there to schedule and manage sending."}
            </p>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-[18px] border-t border-[#332F22] pt-[22px]">
              {[
                { k: "Companies", v: String(companyCount) },
                { k: "Contacts", v: String(leadsSent) },
                { k: "Steps", v: String(emails.length) },
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
            <div className="mt-7 flex flex-wrap gap-3">
              {smartleadCampaignUrl && (
                <a
                  href={smartleadCampaignUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block cursor-pointer rounded-md bg-accent px-[22px] py-3 text-sm font-semibold text-ink"
                >
                  Open in Smartlead
                </a>
              )}
              <Link
                href="/campaigns"
                className="inline-block cursor-pointer rounded-md bg-paper px-[22px] py-3 text-sm font-semibold text-ink"
              >
                Back to campaigns
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pt-[22px] sm:px-10 sm:pt-[38px]">
      <div className="flex max-w-[860px] flex-col gap-[18px]">
        <div className="rounded-[10px] border border-line bg-white p-5 sm:p-7">
          <h2 className="mb-1 text-[17px] font-semibold">{campaignName}</h2>
          <p className="mb-[22px] text-[13px] text-muted">
            {isExisting
              ? "This campaign was cleared before it went live."
              : "Nothing sends until the box below is checked."}
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
            { k: "Contacts", v: String(revealedContacts) },
            { k: "Steps", v: String(emails.length) },
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
              disabled={!allChecked || launchStatus === "loading"}
              className={`rounded-md px-[26px] py-[13px] text-[14.5px] font-semibold text-paper ${
                allChecked && launchStatus !== "loading"
                  ? "cursor-pointer bg-teal"
                  : "cursor-not-allowed bg-[#B8B2A0]"
              }`}
            >
              {launchStatus === "loading" ? "Pushing to Smartlead…" : "Approve & push to Smartlead"}
            </button>
            <span className="text-[12.5px] text-muted">
              {launchStatus === "error"
                ? launchError
                : allChecked
                  ? "Creates a draft Smartlead campaign with the sequence and revealed contacts."
                  : `${remaining} ${remaining === 1 ? "check" : "checks"} remaining`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
