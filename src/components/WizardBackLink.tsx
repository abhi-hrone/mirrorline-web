"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WIZARD_STEPS } from "@/lib/mock-data";
import { useWizard } from "@/lib/wizard-context";

// Steps back one wizard page; the first step backs out to the campaigns list.
export default function WizardBackLink() {
  const pathname = usePathname();
  const { launched } = useWizard();
  const currentIndex = WIZARD_STEPS.findIndex((s) => pathname.endsWith(`/${s.key}`));

  // The launched screen has its own "Back to campaigns"; stepping back into
  // the wizard after a campaign is already live would only invite a re-launch.
  if (currentIndex === -1 || launched) return null;

  const prev = WIZARD_STEPS[currentIndex - 1];
  const href = prev ? `/campaigns/new/${prev.key}` : "/campaigns";
  const label = prev ? prev.label : "Campaigns";

  return (
    <div className="px-5 pt-5 sm:px-10">
      <Link
        href={href}
        className="inline-flex items-center gap-2 rounded-md border border-teal/30 bg-[#E7F0EC] px-3.5 py-2 text-[13px] font-semibold text-teal shadow-sm transition-colors hover:border-teal hover:bg-teal hover:text-paper"
      >
        <span aria-hidden>←</span>
        Back to {label.toLowerCase()}
      </Link>
    </div>
  );
}
