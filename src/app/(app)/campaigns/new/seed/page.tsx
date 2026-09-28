"use client";

import Link from "next/link";
import { useWizard } from "@/lib/wizard-context";
import { ALL_HR_ROLES, HR_ROLE_GROUPS } from "@/lib/hr-roles";

export default function SeedPage() {
  const { seedName, seedWebsite, setSeedName, setSeedWebsite, targetTitles,
    setTargetTitles,
    targetRoles,
    toggleRole,
    setTargetRoles,
  } =
    useWizard();

  return (
    <div className="px-5 pt-[22px] sm:px-10 sm:pt-[38px]">
      <div className="flex max-w-[1060px] flex-col gap-5">
        <p className="max-w-[640px] text-[15px] leading-relaxed text-[#55513F]">
          The customer this campaign is built around. Ocean uses the website
          to find lookalikes.
        </p>

        <div className="rounded-[10px] border border-line bg-white p-5 sm:p-7">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-5">
            <label className="flex flex-col gap-[7px]">
              <span className="font-mono text-[10.5px] tracking-[0.12em] text-[#6E6A5C] uppercase">
                Company name
              </span>
              <input
                value={seedName}
                onChange={(e) => setSeedName(e.target.value)}
                placeholder="Customer company name"
                className="rounded-md border border-line bg-paper px-[13px] py-[11px] text-[14.5px]"
              />
            </label>
            <label className="flex flex-col gap-[7px]">
              <span className="font-mono text-[10.5px] tracking-[0.12em] text-[#6E6A5C] uppercase">
                Website
              </span>
              <input
                value={seedWebsite}
                onChange={(e) => setSeedWebsite(e.target.value)}
                placeholder="example.com"
                className="rounded-md border border-line bg-paper px-[13px] py-[11px] font-mono text-[14.5px]"
              />
            </label>
            <label className="flex flex-col gap-[7px]">
              <span className="font-mono text-[10.5px] tracking-[0.12em] text-[#6E6A5C] uppercase">
                Extra title keywords (optional)
              </span>
              <input
                value={targetTitles}
                onChange={(e) => setTargetTitles(e.target.value)}
                placeholder="e.g. Head, Director"
                className="rounded-md border border-line bg-paper px-[13px] py-[11px] text-[14.5px]"
              />
              <span className="text-[11.5px] text-muted">
                Comma-separated. Added to the HR roles below.
              </span>
            </label>
          </div>

          <div className="mt-6 flex flex-col gap-3.5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[10.5px] tracking-[0.12em] text-[#6E6A5C] uppercase">
                Target HR roles
              </span>
              <span className="text-xs text-muted">
                {targetRoles.length} of {ALL_HR_ROLES.length} selected
              </span>
              <button
                type="button"
                onClick={() => setTargetRoles([...ALL_HR_ROLES])}
                className="cursor-pointer text-xs text-teal underline"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setTargetRoles([])}
                className="cursor-pointer text-xs text-muted underline"
              >
                Clear
              </button>
            </div>
            {HR_ROLE_GROUPS.map((group) => (
              <div key={group.level} className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-medium text-[#55513F]">{group.level}</span>
                <div className="flex flex-wrap gap-1.5">
                  {group.roles.map((r) => {
                    const on = targetRoles.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleRole(r)}
                        className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs ${
                          on
                            ? "border-ink bg-ink text-paper"
                            : "border-line bg-white text-[#55513F]"
                        }`}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3.5">
          <Link
            href="/campaigns/new/case"
            className="cursor-pointer rounded-md bg-teal px-[22px] py-3 text-sm font-semibold text-paper"
          >
            Continue to case study
          </Link>
          <span className="text-[12.5px] text-muted">
            {seedWebsite || "No website yet"} · Ocean seed domain
          </span>
        </div>
      </div>
    </div>
  );
}
