"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { ALL_HR_ROLES } from "./hr-roles";
import { DEFAULT_CAMPAIGN_TYPE, campaignTypeById, type FrameworkId } from "./sequence-options";
import {
  CASE_QS,
  REVIEW_CHECKS,
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
  // Shown on the review page and used as the Smartlead campaign name.
  campaignName: string;
  // HR designations picked on the seed step; sent as the people-search titles.
  targetRoles: string[];
  toggleRole: (r: string) => void;
  setTargetRoles: (v: string[]) => void;

  answers: Record<string, string>;
  setAnswer: (id: string, value: string) => void;

  caseStudyOptions: CaseStudyOption[];
  caseStudyStatus: "idle" | "loading" | "error";
  caseStudyError: string | null;
  selectedCaseStudyUrl: string | null;
  findCaseStudies: () => Promise<void>;
  selectCaseStudy: (cs: CaseStudyOption) => void;

  caseContent: string;
  setCaseContent: (v: string) => void;
  fillStatus: "idle" | "loading" | "error";
  fillError: string | null;
  fillFromContent: () => Promise<void>;

  companies: Company[];
  lookalikeStatus: "idle" | "loading" | "error";
  lookalikeError: string | null;
  findLookalikes: () => Promise<void>;

  minScore: number;
  setMinScore: (v: number) => void;
  headcountBand: string;
  setHeadcountBand: (v: string) => void;
  region: string;
  setRegion: (v: string) => void;
  picked: Record<string, boolean>;
  togglePicked: (id: string) => void;
  setPickedMany: (ids: string[], value: boolean) => void;

  contactGroups: ContactGroup[];
  contactStatus: "idle" | "loading" | "error";
  contactError: string | null;
  findContacts: () => Promise<void>;
  // Step 2 of contact finding: emails are only revealed for ticked contacts.
  selectedContacts: Record<string, boolean>;
  toggleContactSelected: (id: string) => void;
  setContactsSelected: (ids: string[], value: boolean) => void;
  revealStatus: "idle" | "loading" | "error";
  revealError: string | null;
  revealSelected: () => Promise<void>;
  removeContact: (domain: string, index: number) => void;
  addContact: (
    domain: string,
    person: { name: string; title: string; email: string; phone?: string; linkedin?: string }
  ) => void;

  // One sequence per target company, keyed by domain (SHARED_SEQUENCE when
  // there are no companies yet). `emails` is the active company's sequence.
  sequenceCompanies: SequenceCompany[];
  sequences: Record<string, SequenceStep[]>;
  activeSequenceDomain: string;
  setActiveSequenceDomain: (domain: string) => void;
  sequenceProgress: { done: number; total: number };
  redraftCompany: (domain: string) => Promise<void>;
  emails: SequenceStep[];
  setEmailField: (
    index: number,
    field: "subject" | "preheader" | "hook" | "content" | "cta" | "ps",
    value: string
  ) => void;
  sequenceStatus: "idle" | "loading" | "error";
  sequenceError: string | null;
  generateSequence: () => Promise<void>;
  campaignTypeId: string;
  setCampaignTypeId: (id: string) => void;
  stepFrameworks: FrameworkId[];
  setStepFramework: (index: number, framework: FrameworkId) => void;
  campaignBrief: string;
  setCampaignBrief: (v: string) => void;

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

export type SequenceCompany = {
  name: string;
  domain: string;
  size: string;
  region: string;
  fit: string;
};

// Key for the one template sequence drafted when no companies are picked yet.
export const SHARED_SEQUENCE = "";

// Drafting runs one model call per company; cap how many run at once so a
// 30-company campaign doesn't fire 30 parallel requests at Azure OpenAI.
const SEQUENCE_CONCURRENCY = 3;

const WizardContext = createContext<WizardState | null>(null);

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const [seedName, setSeedName] = useState("Salesforce");
  const [seedWebsite, setSeedWebsite] = useState("www.salesforce.com");
  const [targetTitles, setTargetTitles] = useState("");
  const [targetRoles, setTargetRoles] = useState<string[]>([...ALL_HR_ROLES]);
  const campaignName = `${seedName.trim() || "Campaign"} lookalikes · HR leaders · India`;
  const toggleRole = (r: string) =>
    setTargetRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  // Picked roles plus any free-text keywords, de-duplicated.
  const searchTitles = () => [
    ...new Set([
      ...targetRoles,
      ...targetTitles.split(",").map((t) => t.trim()).filter(Boolean),
    ]),
  ];

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

  const [caseContent, setCaseContent] = useState("");
  const [fillStatus, setFillStatus] = useState<"idle" | "loading" | "error">("idle");
  const [fillError, setFillError] = useState<string | null>(null);

  const fillFromContent = async () => {
    const content = caseContent.trim();
    if (!content) return;
    setFillStatus("loading");
    setFillError(null);
    try {
      const res = await fetch("/api/case-studies/fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");
      setAnswers((prev) => ({ ...prev, ...data.answers }));
      setFillStatus("idle");
    } catch (err) {
      setFillError(
        err instanceof Error
          ? err.message
          : "That didn't have enough detail to fill the form. Add more and try again."
      );
      setFillStatus("error");
    }
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

  const [minScore, setMinScore] = useState(0);
  const [headcountBand, setHeadcountBand] = useState("All");
  const [region, setRegion] = useState("India");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const togglePicked = (id: string) =>
    setPicked((prev) => ({ ...prev, [id]: !prev[id] }));
  const setPickedMany = (ids: string[], value: boolean) =>
    setPicked((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, value])) }));

  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  // Latest groups, readable from the polling timer without a stale closure.
  const contactGroupsRef = useRef<ContactGroup[]>([]);
  useEffect(() => {
    contactGroupsRef.current = contactGroups;
  }, [contactGroups]);
  const [contactStatus, setContactStatus] = useState<"idle" | "loading" | "error">("idle");
  const [contactError, setContactError] = useState<string | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<Record<string, boolean>>({});
  const toggleContactSelected = (id: string) =>
    setSelectedContacts((prev) => ({ ...prev, [id]: !prev[id] }));
  const setContactsSelected = (ids: string[], value: boolean) =>
    setSelectedContacts((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, value])) }));
  const [revealStatus, setRevealStatus] = useState<"idle" | "loading" | "error">("idle");
  const [revealError, setRevealError] = useState<string | null>(null);

  const findContacts = async () => {
    setContactStatus("loading");
    setContactError(null);
    setSelectedContacts({});
    setRevealError(null);
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
          titles: searchTitles(),
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
    } catch (err) {
      setContactError(err instanceof Error ? err.message : "Search failed");
      setContactStatus("error");
    }
  };

  // Step 2: reveal emails for the ticked contacts only. Unticked contacts are
  // never sent, so nothing is looked up or paid for on them.
  const revealSelected = async () => {
    const people = contactGroupsRef.current.flatMap((g) =>
      g.people
        .filter((p) => p.id && selectedContacts[p.id] && !p.email)
        .map((p) => ({
          id: p.id as string,
          name: p.name,
          linkedin: p.linkedin ?? "",
          domain: g.domain,
          source: g.source ?? "",
        }))
    );
    if (people.length === 0) {
      setRevealError("Tick at least one contact that hasn't been revealed yet.");
      setRevealStatus("error");
      return;
    }
    setRevealStatus("loading");
    setRevealError(null);
    try {
      const res = await fetch("/api/contacts/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ people }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reveal failed");
      const results: Record<
        string,
        {
          name: string;
          linkedin: string;
          email: string;
          phone: string;
          conf: ContactGroup["people"][number]["conf"];
          revealStatus: "pending" | "unavailable";
        }
      > = data.results ?? {};

      const next = contactGroupsRef.current.map((g) => ({
        ...g,
        people: g.people.map((p) => {
          const r = p.id ? results[p.id] : undefined;
          if (!r) return p;
          return {
            ...p,
            name: r.name || p.name,
            linkedin: r.linkedin || p.linkedin,
            email: r.email || p.email,
            phone: r.phone || p.phone,
            conf: r.conf,
            revealStatus: r.revealStatus,
          };
        }),
      }));
      contactGroupsRef.current = next;
      setContactGroups(next);
      setRevealStatus("idle");
      pollReveals(next);
    } catch (err) {
      setRevealError(err instanceof Error ? err.message : "Reveal failed");
      setRevealStatus("error");
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
            p.revealStatus === "pending"
              ? { ...p, revealStatus: undefined, conf: p.email ? p.conf : ("No email" as const) }
              : p
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

        // Computed outside a setState updater on purpose: the next poll used to
        // be scheduled from inside the updater, and React runs updaters twice
        // in dev (StrictMode), so every round doubled the number of polling
        // chains until the attempt cap.
        const next = contactGroupsRef.current.map((g) => ({
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
        contactGroupsRef.current = next;
        setContactGroups(next);
        pollReveals(next, attempt + 1);
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

  // The companies that will actually be emailed: those with contacts found,
  // else the picked lookalikes. Size/region/fit come from the lookalike row.
  const companyByDomain = new Map(companies.map((c) => [c.domain, c]));
  const sequenceCompanies: SequenceCompany[] = (
    contactGroups.length > 0
      ? contactGroups.map((g) => ({ name: g.company, domain: g.domain }))
      : pickedCompanies(companies, picked).map((c) => ({ name: c.name, domain: c.domain }))
  ).map(({ name, domain }) => {
    const c = companyByDomain.get(domain);
    return { name, domain, size: c?.size ?? "", region: c?.region ?? "", fit: c?.fit ?? "" };
  });

  const [sequences, setSequences] = useState<Record<string, SequenceStep[]>>({});
  const [activeDomainState, setActiveSequenceDomain] = useState<string | null>(null);
  // Falls back to the first company with a draft, so the page never shows an
  // empty pane while drafts exist.
  const activeSequenceDomain =
    activeDomainState !== null && sequences[activeDomainState]
      ? activeDomainState
      : (sequenceCompanies.find((c) => sequences[c.domain])?.domain ??
        Object.keys(sequences)[0] ??
        SHARED_SEQUENCE);
  const emails = sequences[activeSequenceDomain] ?? [];
  const setEmailField = (
    index: number,
    field: "subject" | "preheader" | "hook" | "content" | "cta" | "ps",
    value: string
  ) =>
    setSequences((prev) => ({
      ...prev,
      [activeSequenceDomain]: (prev[activeSequenceDomain] ?? []).map((e, i) =>
        i === index ? { ...e, [field]: value } : e
      ),
    }));
  const [sequenceProgress, setSequenceProgress] = useState({ done: 0, total: 0 });

  const [sequenceStatus, setSequenceStatus] = useState<"idle" | "loading" | "error">(
    "idle"
  );
  const [sequenceError, setSequenceError] = useState<string | null>(null);

  // Picking a campaign type resets the per-step frameworks to that type's
  // recommended plan; the user can then override any single step.
  const [campaignTypeId, setCampaignTypeIdState] = useState(DEFAULT_CAMPAIGN_TYPE.id);
  const [stepFrameworks, setStepFrameworks] = useState<FrameworkId[]>(
    DEFAULT_CAMPAIGN_TYPE.plan.map((s) => s.framework)
  );
  const [campaignBrief, setCampaignBrief] = useState("");
  const setCampaignTypeId = (id: string) => {
    const type = campaignTypeById(id);
    setCampaignTypeIdState(type.id);
    setStepFrameworks(type.plan.map((s) => s.framework));
  };
  const setStepFramework = (index: number, framework: FrameworkId) =>
    setStepFrameworks((prev) => prev.map((f, i) => (i === index ? framework : f)));

  const draftSequence = async (company: SequenceCompany | null): Promise<SequenceStep[]> => {
    const res = await fetch("/api/sequence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seedName,
        answers,
        targetTitles: searchTitles().join(", "),
        campaignType: campaignTypeId,
        frameworks: stepFrameworks,
        brief: campaignBrief,
        company,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Sequence generation failed");
    return data.steps ?? [];
  };

  // Drafts every company's sequence, a few at a time. Each draft lands as
  // soon as it's ready, and one company failing doesn't lose the others.
  const generateSequence = async () => {
    setSequenceStatus("loading");
    setSequenceError(null);
    const targets: (SequenceCompany | null)[] =
      sequenceCompanies.length > 0 ? sequenceCompanies : [null];
    setSequences({});
    setActiveSequenceDomain(null);
    setSequenceProgress({ done: 0, total: targets.length });

    const failed: { name: string; error: string }[] = [];
    let next = 0;
    const worker = async () => {
      while (next < targets.length) {
        const company = targets[next++];
        try {
          const steps = await draftSequence(company);
          setSequences((prev) => ({ ...prev, [company?.domain ?? SHARED_SEQUENCE]: steps }));
        } catch (err) {
          failed.push({
            name: company?.name ?? "the campaign",
            error: err instanceof Error ? err.message : "Sequence generation failed",
          });
        }
        setSequenceProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(SEQUENCE_CONCURRENCY, targets.length) }, worker)
    );

    if (failed.length === 0) {
      setSequenceStatus("idle");
    } else {
      // Every company fails the same way on a config or input problem, so
      // show that message once rather than a list of identical errors.
      setSequenceError(
        failed.length === targets.length
          ? failed[0].error
          : `Couldn't draft for ${failed.map((f) => f.name).join(", ")}. Redraft them from the company list.`
      );
      setSequenceStatus("error");
    }
  };

  const redraftCompany = async (domain: string) => {
    const company = sequenceCompanies.find((c) => c.domain === domain) ?? null;
    setSequenceStatus("loading");
    setSequenceError(null);
    setSequenceProgress({ done: 0, total: 1 });
    try {
      const steps = await draftSequence(company);
      setSequences((prev) => ({ ...prev, [company?.domain ?? SHARED_SEQUENCE]: steps }));
      setActiveSequenceDomain(company?.domain ?? SHARED_SEQUENCE);
      setSequenceStatus("idle");
    } catch (err) {
      setSequenceError(err instanceof Error ? err.message : "Sequence generation failed");
      setSequenceStatus("error");
    }
    setSequenceProgress({ done: 1, total: 1 });
  };

  const [checks, setChecks] = useState(REVIEW_CHECKS.map(() => false));
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
          campaignName,
          seedName,
          seedWebsite,
          sequences: Object.fromEntries(
            Object.entries(sequences).map(([domain, steps]) => [
              domain,
              steps.map(({ day, subject, preheader, hook, content, cta, ps }) => ({
                day,
                subject,
                preheader,
                hook,
                content,
                cta,
                ps,
              })),
            ])
          ),
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
        campaignName,
        targetRoles,
        toggleRole,
        setTargetRoles,
        answers,
        setAnswer,
        caseStudyOptions,
        caseStudyStatus,
        caseStudyError,
        selectedCaseStudyUrl,
        findCaseStudies,
        selectCaseStudy,
        caseContent,
        setCaseContent,
        fillStatus,
        fillError,
        fillFromContent,
        companies,
        lookalikeStatus,
        lookalikeError,
        findLookalikes,
        minScore,
        setMinScore,
        headcountBand,
        setHeadcountBand,
        region,
        setRegion,
        picked,
        togglePicked,
        setPickedMany,
        contactGroups,
        contactStatus,
        contactError,
        findContacts,
        selectedContacts,
        toggleContactSelected,
        setContactsSelected,
        revealStatus,
        revealError,
        revealSelected,
        removeContact,
        addContact,
        sequenceCompanies,
        sequences,
        activeSequenceDomain,
        setActiveSequenceDomain,
        sequenceProgress,
        redraftCompany,
        emails,
        setEmailField,
        sequenceStatus,
        sequenceError,
        generateSequence,
        campaignTypeId,
        setCampaignTypeId,
        stepFrameworks,
        setStepFramework,
        campaignBrief,
        setCampaignBrief,
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
