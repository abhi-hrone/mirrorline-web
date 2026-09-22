"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WIZARD_STEPS } from "@/lib/mock-data";

export default function WizardStepper() {
  const pathname = usePathname();
  const currentIndex = WIZARD_STEPS.findIndex((s) =>
    pathname.endsWith(`/${s.key}`)
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {WIZARD_STEPS.map((step, i) => {
        const active = i === currentIndex;
        const done = currentIndex > -1 && i < currentIndex;
        return (
          <Link
            key={step.key}
            href={`/campaigns/new/${step.key}`}
            className={`flex items-center gap-[7px] rounded-full border px-[11px] py-1.5 text-xs font-medium whitespace-nowrap ${
              active
                ? "border-ink bg-ink text-paper"
                : "border-line bg-white text-[#6E6A5C]"
            }`}
          >
            <span
              className={`grid h-4 w-4 place-items-center rounded-full font-mono text-[9.5px] ${
                active
                  ? "bg-accent text-ink"
                  : done
                    ? "bg-[#E7F0EC] text-teal"
                    : "bg-canvas text-[#A39D8C]"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            {step.label}
          </Link>
        );
      })}
    </div>
  );
}
