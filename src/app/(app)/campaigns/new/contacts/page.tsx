"use client";

import Link from "next/link";
import { CONTACT_CONFIDENCE_STYLES } from "@/lib/mock-data";
import { pickedCompanies, useWizard } from "@/lib/wizard-context";

export default function ContactsPage() {
  const { contactGroups, contactStatus, contactError, findContacts, companies, picked } =
    useWizard();
  const pickedCount = pickedCompanies(companies, picked).length;
  const totalContacts = contactGroups.reduce((n, g) => n + g.people.length, 0);

  return (
    <div className="px-5 pt-[22px] sm:px-10 sm:pt-[38px]">
      <div className="flex max-w-[980px] flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3.5">
          <p className="text-sm text-[#6E6A5C]">
            {totalContacts} contacts across {contactGroups.length} companies · Ocean
          </p>
          <button
            onClick={findContacts}
            disabled={contactStatus === "loading" || pickedCount === 0}
            className="ml-auto cursor-pointer rounded-md bg-teal px-4 py-2 text-[12.5px] font-semibold text-paper disabled:opacity-60"
          >
            {contactStatus === "loading"
              ? "Searching Ocean…"
              : `Find contacts at ${pickedCount} ${pickedCount === 1 ? "company" : "companies"}`}
          </button>
        </div>
        {contactError && <p className="text-[13px] text-[#B3402A]">{contactError}</p>}
        {contactGroups.length === 0 && !contactError && (
          <p className="rounded-[10px] border border-line bg-white px-5 py-6 text-[13.5px] text-[#55513F]">
            {pickedCount === 0
              ? "No companies selected. Pick some on the Lookalikes step first."
              : "Click “Find contacts” to search Ocean for people at the selected companies."}
          </p>
        )}

        {contactGroups.map((group) => (
          <div
            key={group.domain}
            className="overflow-hidden rounded-[10px] border border-line bg-white"
          >
            <div className="flex flex-wrap items-center gap-3.5 border-b border-[#E8E2D5] bg-paper px-5 py-3.5">
              <div className="min-w-0">
                <div className="text-[15px] font-semibold tracking-[-0.01em]">
                  {group.company}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-muted">
                  {group.domain}
                </div>
              </div>
              <span className="ml-auto font-mono text-[11px] text-[#6E6A5C]">
                {group.people.length} contacts
              </span>
              <span className="font-mono text-[11px] text-teal">
                {group.score}
              </span>
            </div>

            {group.people.map((p) => (
              <div
                key={`${p.name}-${p.email}`}
                className="grid grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)_minmax(0,1.05fr)_minmax(0,0.85fr)_60px_82px] items-center gap-3.5 border-b border-[#F0EBE0] px-5 py-3"
              >
                <span className="min-w-0 overflow-hidden text-ellipsis text-[13.5px] font-semibold">
                  {p.name}
                </span>
                <span className="min-w-0 text-[13px] text-[#55513F]">
                  {p.title}
                </span>
                <span className="min-w-0 overflow-hidden text-ellipsis font-mono text-[11.5px] text-teal">
                  {p.email || (p.revealStatus === "pending" ? "Revealing…" : "—")}
                </span>
                <span className="min-w-0 overflow-hidden text-ellipsis font-mono text-[11.5px] text-[#55513F]">
                  {p.phone || (p.revealStatus === "pending" ? "Revealing…" : "—")}
                </span>
                <span className="min-w-0 text-[11.5px]">
                  {p.linkedin ? (
                    <a href={p.linkedin} target="_blank" rel="noreferrer" className="text-teal underline">
                      LinkedIn
                    </a>
                  ) : (
                    "—"
                  )}
                </span>
                <span
                  className={`rounded-full px-[7px] py-[3px] text-center font-mono text-[9.5px] tracking-[0.08em] uppercase ${CONTACT_CONFIDENCE_STYLES[p.conf]}`}
                >
                  {p.conf}
                </span>
              </div>
            ))}
          </div>
        ))}

        <Link
          href="/campaigns/new/sequence"
          className="cursor-pointer self-start rounded-md bg-teal px-[22px] py-3 text-sm font-semibold text-paper"
        >
          Draft sequence
        </Link>
      </div>
    </div>
  );
}
