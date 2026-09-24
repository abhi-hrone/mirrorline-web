"use client";

import { createContext, useContext, useState } from "react";
import { BUSINESS_DEPARTMENTS } from "./departments";
import {
  CASE_QS,
  Company,
  ContactGroup,
  SequenceStep,
  CaseStudyOption,
  caseStudyToAnswers,
} from "./mock-data";

type WizardState = {
  seedName: string;
  seedWebsite: string;
  setSeedName: (v: string) => void;
  setSeedWebsite: (v: string) => void;
  targetTitles: string;
  setTargetTitles: (v: string) => void;
  targetDepartments: string[];
  toggleDepartment: (d: string) => void;
  setTargetDepartments: (v: string[]) => void;

  answers: Record<string, string>;
  setAnswer: (id: string, value: string) => void;

  caseStudyOptions: CaseStudyOption[];
  caseStudyStatus: "idle" | "loading" | "error";
  caseStudyError: string | null;
  selectedCaseStudyUrl: string | null;
  findCaseStudies: () => Promise<void>;
  selectCaseStudy: (cs: CaseStudyOption) => void;

  companies: Company[];
  lookalikeStatus: "idle" | "loading" | "error";
  lookalikeError: string | null;
  findLookalikes: () => Promise<void>;

  minScore: number;
  setMinScore: (v: number) => void;
  region: string;
  setRegion: (v: string) => void;
  picked: Record<string, boolean>;
  togglePicked: (id: string) => void;

  contactGroups: ContactGroup[];
  contactStatus: "idle" | "loading" | "error";
  contactError: string | null;
  findContacts: () => Promise<void>;
  removeContact: (domain: string, index: number) => void;
  addContact: (
    domain: string,
    person: { name: string; title: string; email: string; phone?: string; linkedin?: string }
  ) => void;

  emails: SequenceStep[];
  setEmailField: (
    index: number,
    field: "subject" | "hook" | "content" | "cta",
    value: string
  ) => void;
  sequenceStatus: "idle" | "loading" | "error";
  sequenceError: string | null;
  generateSequence: () => Promise<void>;

  checks: boolean[];
  toggleCheck: (index: number) => void;
  launched: boolean;
  launchStatus: "idle" | "loading" | "error";
  launchError: string | null;
  smartleadCampaignUrl: string | null;
  leadsSent: number;
  sendingStarted: boolean;
  launch: () => Promise<void>;
};

const WizardContext = createContext<WizardState | null>(null);

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const [seedName, setSeedName] = useState("Salesforce");
  const [seedWebsite, setSeedWebsite] = useState("www.salesforce.com");
  const [targetTitles, setTargetTitles] = useState("");
  const [targetDepartments, setTargetDepartments] = useState<string[]>([
    ...BUSINESS_DEPARTMENTS,
  ]);
  const toggleDepartment = (d: string) =>
    setTargetDepartments((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );

  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(CASE_QS.map((q) => [q.id, q.value]))
  );
  const setAnswer = (id: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [id]: value }));

  const [caseStudyOptions, setCaseStudyOptions] = useState<CaseStudyOption[]>([]);
  const [caseStudyStatus, setCaseStudyStatus] = useState<"idle" | "loading" | "error">(
    "idle"
  );
  const [caseStudyError, setCaseStudyError] = useState<string | null>(null);
  const [selectedCaseStudyUrl, setSelectedCaseStudyUrl] = useState<string | null>(null);

  const findCaseStudies = async () => {
    setCaseStudyStatus("loading");
    setCaseStudyError(null);
    try {
      const res = await fetch("/api/case-studies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectUrl: seedWebsite }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setCaseStudyOptions(data.caseStudies ?? []);
      setCaseStudyStatus("idle");
    } catch (err) {
      setCaseStudyError(err instanceof Error ? err.message : "Search failed");
      setCaseStudyStatus("error");
    }
  };

  const selectCaseStudy = (cs: CaseStudyOption) => {
    const mapped = caseStudyToAnswers(cs);
    setAnswers((prev) => ({ ...prev, ...mapped }));
    setSelectedCaseStudyUrl(cs.sourceUrl);
  };

  const [companies, setCompanies] = useState<Company[]>([]);
  const [lookalikeStatus, setLookalikeStatus] = useState<"idle" | "loading" | "error">(
    "idle"
  );
  const [lookalikeError, setLookalikeError] = useState<string | null>(null);

  const findLookalikes = async () => {
    setLookalikeStatus("loading");
    setLookalikeError(null);
    try {
      const res = await fetch("/api/lookalikes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: seedWebsite }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setCompanies(data.companies ?? []);
      setPicked({});
      setLookalikeStatus("idle");
    } catch (err) {
      setLookalikeError(err instanceof Error ? err.message : "Search failed");
      setLookalikeStatus("error");
    }
  };

  const [minScore, setMinScore] = useState(80);
  const [region, setRegion] = useState("All");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const togglePicked = (id: string) =>
    setPicked((prev) => ({ ...prev, [id]: !prev[id] }));

  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [contactStatus, setContactStatus] = useState<"idle" | "loading" | "error">("idle");
  const [contactError, setContactError] = useState<string | null>(null);

  const findContacts = async () => {
    setContactStatus("loading");
    setContactError(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companies: pickedCompanies(companies, picked).map(({ name, domain, score }) => ({
            name,
            domain,
            score,
          })),
          departments: targetDepartments,
          titles: targetTitles.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      const groups: ContactGroup[] = data.groups ?? [];
      setContactGroups(groups);
      if (!groups.length) {
        setContactError(
          "No contacts matched those titles in India at the selected companies. Pick larger companies or broaden the target titles."
        );
        setContactStatus("error");
        return;
      }
      setContactStatus("idle");
      pollReveals(groups);
    } catch (err) {
      setContactError(err instanceof Error ? err.message : "Search failed");
      setContactStatus("error");
    }
  };

  // Contacts come back with email/phone still "pending" while Ocean works the
  // async reveal in the background (see /api/contacts/reveal-webhook). Poll our
  // own status endpoint until every pending contact resolves or we give up.
  const pollReveals = (groups: ContactGroup[], attempt = 0) => {
    const pendingIds = groups
      .flatMap((g) => g.people)
      .filter((p) => p.revealStatus === "pending" && p.id)
      .map((p) => p.id as string);
    if (pendingIds.length === 0) return;

    if (attempt >= 15) {
      // Give up on whichever channel never arrived (usually because Ocean
      // has no phone, or no email, on file for that person) so the UI stops
      // showing "Revealing…" forever instead of leaving it stuck.
      setContactGroups((prev) =>
        prev.map((g) => ({
          ...g,
          people: g.people.map((p) =>
            p.revealStatus === "pending" ? { ...p, revealStatus: undefined } : p
          ),
        }))
      );
      return;
    }

    setTimeout(async () => {
      try {
        const res = await fetch("/api/contacts/reveal-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: pendingIds }),
        });
        const data = await res.json();
        const results: Record<
          string,
          {
            status: "pending" | "revealed" | "unavailable";
            email?: string;
            phone?: string;
            emailDone?: boolean;
            phoneDone?: boolean;
          }
        > = data.results ?? {};

        setContactGroups((prev) => {
          const next = prev.map((g) => ({
            ...g,
            people: g.people.map((p) => {
              const r = p.id ? results[p.id] : undefined;
              if (!r) return p;
              // Apply whichever channel has resolved so far — don't wait on
              // the other one, it may never arrive. Only stop polling this
              // contact once both channels are accounted for.
              const bothDone = !!r.emailDone && !!r.phoneDone;
              return {
                ...p,
                email: r.email || p.email,
                phone: r.phone || p.phone,
                conf: r.email ? ("Verified" as const) : p.conf,
                revealStatus: bothDone ? undefined : p.revealStatus,
              };
            }),
          }));
          pollReveals(next, attempt + 1);
          return next;
        });
      } catch {
        pollReveals(groups, attempt + 1);
      }
    }, 4000);
  };

  // Lets a reviewer drop a bad match or add someone Ocean missed before the
  // list goes to Smartlead — pure client-side edit, no API call involved.
  const removeContact = (domain: string, index: number) =>
    setContactGroups((prev) =>
      prev.map((g) =>
        g.domain === domain ? { ...g, people: g.people.filter((_, i) => i !== index) } : g
      )
    );

  const addContact = (
    domain: string,
    person: { name: string; title: string; email: string; phone?: string; linkedin?: string }
  ) =>
    setContactGroups((prev) =>
      prev.map((g) =>
        g.domain === domain
          ? { ...g, people: [...g.people, { ...person, conf: "Verified" as const }] }
          : g
      )
    );

  const [emails, setEmails] = useState<SequenceStep[]>([]);
  const setEmailField = (
    index: number,
    field: "subject" | "hook" | "content" | "cta",
    value: string
  ) =>
    setEmails((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    );

  const [sequenceStatus, setSequenceStatus] = useState<"idle" | "loading" | "error">(
    "idle"
  );
  const [sequenceError, setSequenceError] = useState<string | null>(null);

  const generateSequence = async () => {
    setSequenceStatus("loading");
    setSequenceError(null);
    try {
      const res = await fetch("/api/sequence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seedName,
          answers,
          targetTitles,
          targetDepartments,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sequence generation failed");
      setEmails(data.steps ?? []);
      setSequenceStatus("idle");
    } catch (err) {
      setSequenceError(err instanceof Error ? err.message : "Sequence generation failed");
      setSequenceStatus("error");
    }
  };

  const [checks, setChecks] = useState([false, false, false, false]);
  const toggleCheck = (index: number) =>
    setChecks((prev) => prev.map((v, i) => (i === index ? !v : v)));
  const [launched, setLaunched] = useState(false);
  const [launchStatus, setLaunchStatus] = useState<"idle" | "loading" | "error">("idle");
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [smartleadCampaignUrl, setSmartleadCampaignUrl] = useState<string | null>(null);
  const [leadsSent, setLeadsSent] = useState(0);
  const [sendingStarted, setSendingStarted] = useState(false);

  // Pushes the approved sequence + revealed contacts into a real Smartlead
  // campaign. If a mailbox is already connected in Smartlead (one-time setup
  // done in their dashboard), the API route assigns it, sets a default
  // schedule, and starts sending immediately. Otherwise the campaign lands
  // as a draft for a human to assign a sender and start manually.
  const launch = async () => {
    if (!checks.every(Boolean)) return;
    setLaunchStatus("loading");
    setLaunchError(null);
    try {
      const res = await fetch("/api/smartlead/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignName: `${seedName.split(" ")[0]} × freight brokers, EU`,
          steps: emails.map(({ day, subject, hook, content, cta }) => ({
            day,
            subject,
            hook,
            content,
            cta,
          })),
          groups: contactGroups.map(({ company, domain, people }) => ({
            company,
            domain,
            people: people.map(({ name, title, email, phone }) => ({
              name,
              title,
              email,
              phone,
            })),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Smartlead launch failed");
      setSmartleadCampaignUrl(data.campaignUrl ?? null);
      setLeadsSent(data.leadsAdded ?? 0);
      setSendingStarted(!!data.started);
      setLaunchStatus("idle");
      setLaunched(true);
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : "Smartlead launch failed");
      setLaunchStatus("error");
    }
  };

  return (
    <WizardContext.Provider
      value={{
        seedName,
        seedWebsite,
        setSeedName,
        setSeedWebsite,
        targetTitles,
        setTargetTitles,
        targetDepartments,
        toggleDepartment,
        setTargetDepartments,
        answers,
        setAnswer,
        caseStudyOptions,
        caseStudyStatus,
        caseStudyError,
        selectedCaseStudyUrl,
        findCaseStudies,
        selectCaseStudy,
        companies,
        lookalikeStatus,
        lookalikeError,
        findLookalikes,
        minScore,
        setMinScore,
        region,
        setRegion,
        picked,
        togglePicked,
        contactGroups,
        contactStatus,
        contactError,
        findContacts,
        removeContact,
        addContact,
        emails,
        setEmailField,
        sequenceStatus,
        sequenceError,
        generateSequence,
        checks,
        toggleCheck,
        launched,
        launchStatus,
        launchError,
        smartleadCampaignUrl,
        leadsSent,
        sendingStarted,
        launch,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used within a WizardProvider");
  return ctx;
}

export function pickedCompanies(companies: Company[], picked: Record<string, boolean>) {
  return companies.filter((c) => picked[c.id]);
}
