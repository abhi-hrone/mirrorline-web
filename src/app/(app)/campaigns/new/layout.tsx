"use client";

import { usePathname } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import WizardStepper from "@/components/WizardStepper";
import WizardBackLink from "@/components/WizardBackLink";
import { WizardProvider, useWizard } from "@/lib/wizard-context";
import { WIZARD_TITLES, WizardStepKey } from "@/lib/mock-data";

export default function NewCampaignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WizardProvider>
      <WizardHeader />
      <WizardBackLink />
      {children}
    </WizardProvider>
  );
}

// Inside the provider so the crumb and title follow the campaign's mode.
function WizardHeader() {
  const pathname = usePathname();
  const { mode, steps } = useWizard();
  const stepKey = pathname.split("/").pop() as WizardStepKey;
  const index = steps.findIndex((s) => s.key === stepKey);
  const title = WIZARD_TITLES[mode][stepKey];
  if (index === -1 || !title) return null;

  return (
    <PageHeader
      crumb={`New campaign · ${index + 1} of ${steps.length}`}
      title={title}
      right={<WizardStepper />}
    />
  );
}
