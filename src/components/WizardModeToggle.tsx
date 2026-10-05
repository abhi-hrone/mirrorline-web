"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useWizard } from "@/lib/wizard-context";
import type { WizardMode } from "@/lib/mock-data";

const OPTIONS: { mode: WizardMode; href: string; label: string; note: string }[] = [
  {
    mode: "customer",
    href: "/campaigns/new/seed",
    label: "Clone a customer",
    note: "Find companies like an HROne customer",
  },
  {
    mode: "pastUser",
    href: "/campaigns/new/pastuser",
    label: "Follow a past HROne user",
    note: "Someone who used HROne, now at a new company",
  },
  {
    mode: "director",
    href: "/campaigns/new/director",
    label: "Follow a customer's director",
    note: "The other companies an HROne customer's director sits on",
  },
];

// The first step of each mode shows this; landing on that step puts the
// wizard in its mode, so the step bar and back links follow.
export default function WizardModeToggle({ mode }: { mode: WizardMode }) {
  const { mode: current, setMode } = useWizard();
  useEffect(() => {
    if (current !== mode) setMode(mode);
  }, [current, mode, setMode]);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {OPTIONS.map((o) => {
        const active = o.mode === mode;
        return (
          <Link
            key={o.mode}
            href={o.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col gap-0.5 rounded-[10px] border px-4 py-3 ${
              active ? "border-ink bg-ink text-paper" : "border-line bg-white text-ink hover:border-[#C9C2B0]"
            }`}
          >
            <span className="text-[13.5px] font-semibold">{o.label}</span>
            <span className={`text-[12px] ${active ? "text-[#B5B0A1]" : "text-muted"}`}>{o.note}</span>
          </Link>
        );
      })}
    </div>
  );
}
