"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { INTEGRATIONS, INTEGRATION_STATE_STYLES } from "@/lib/mock-data";

export default function WorkspacePage() {
  const [company, setCompany] = useState("Northbeam Logistics Cloud");
  const [website, setWebsite] = useState("northbeam.co");

  return (
    <>
      <PageHeader crumb="Settings" title="Workspace" />

      <div className="px-5 pt-[22px] sm:px-10 sm:pt-[38px]">
        <div className="flex max-w-[880px] flex-col gap-[18px]">
          <p className="max-w-[620px] text-[15px] leading-relaxed text-[#55513F]">
            This is the company every lookalike is measured against. Ocean
            uses the domain; the rest shapes how sequences are written.
          </p>

          <div className="rounded-[10px] border border-line bg-white p-6 sm:p-[30px]">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-5">
              <label className="flex flex-col gap-[7px]">
                <span className="font-mono text-[10.5px] tracking-[0.12em] text-[#6E6A5C] uppercase">
                  Name
                </span>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="rounded-md border border-line bg-paper px-[13px] py-[11px] text-[14.5px]"
                />
              </label>
              <label className="flex flex-col gap-[7px]">
                <span className="font-mono text-[10.5px] tracking-[0.12em] text-[#6E6A5C] uppercase">
                  Website
                </span>
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="rounded-md border border-line bg-paper px-[13px] py-[11px] font-mono text-[14.5px]"
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-3.5">
            {INTEGRATIONS.map((integration) => (
              <div
                key={integration.name}
                className="flex flex-col gap-2.5 rounded-[10px] border border-line bg-white px-5 py-[18px]"
              >
                <div className="flex items-center justify-between gap-2.5">
                  <span className="text-[14.5px] font-semibold">
                    {integration.name}
                  </span>
                  <span
                    className={`rounded-full px-2 py-[3px] font-mono text-[9.5px] tracking-[0.1em] uppercase ${INTEGRATION_STATE_STYLES[integration.state]}`}
                  >
                    {integration.state}
                  </span>
                </div>
                <div className="text-[12.5px] leading-relaxed text-[#6E6A5C]">
                  {integration.role}
                </div>
                <div className="font-mono text-[10.5px] text-[#A39D8C]">
                  {integration.key}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button className="cursor-pointer rounded-md bg-teal px-[22px] py-3 text-sm font-semibold text-paper">
              Save workspace
            </button>
            <span className="text-[12.5px] text-muted">
              Last edited by Priya, 2 days ago
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
