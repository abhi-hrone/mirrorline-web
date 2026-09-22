"use client";

import { usePathname } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import WizardStepper from "@/components/WizardStepper";
import { WizardProvider } from "@/lib/wizard-context";
import { WIZARD_META, WizardStepKey } from "@/lib/mock-data";

export default function NewCampaignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const stepKey = pathname.split("/").pop() as WizardStepKey;
  const meta = WIZARD_META[stepKey];

  return (
    <WizardProvider>
      {meta && (
        <PageHeader
          crumb={meta.crumb}
          title={meta.title}
          right={<WizardStepper />}
        />
      )}
      {children}
    </WizardProvider>
  );
}
