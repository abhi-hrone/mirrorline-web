"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { ALL_HR_ROLES } from "./hr-roles";
import { DEFAULT_CAMPAIGN_TYPE, campaignTypeById, type FrameworkId } from "./sequence-options";
import {
  CASE_QS,
  CONTEXT_QS,
  REVIEW_CHECKS,
  WIZARD_STEPS_BY_MODE,
  Company,
  ContactGroup,
  SequenceStep,
  ResearchSource,
  CaseStudyOption,
  PastUserMatch,
  DirectorMatch,
  WizardMode,
  caseStudyToAnswers,
} from "./mock-data";
import { normalizeDomain } from "./domain";

type WizardState = {
  mode: WizardMode;
  setMode: (m: WizardMode) => void;
  steps: (typeof WIZARD_STEPS_BY_MODE)[WizardMode];

  // Past-user mode: the person we're following, and where they are now.
  pastUserInput: PastUserInput;
  setPastUserInput: (field: keyof PastUserInput, value: string) => void;
  pastUserMatch: PastUserMatch | null;
  setPastUserCurrent: (field: keyof NonNullable<PastUserMatch["current"]>, value: string) => void;
  pastUserStatus: "idle" | "loading" | "error";
  pastUserError: string | null;
  lookupPastUser: () => Promise<void>;
  // When Apollo has no match or hasn't seen the move, the rep types the
  // new company in by hand.
  enterPastUserManually: () => void;
  // Locks in the match: the old company becomes the case study, the new one
  // the only company the campaign writes to.
  confirmPastUser: () => void;
  pastUserConfirmed: boolean;
  // The published case study about the one known customer behind the
  // campaign: the past user's old company, or the director's HROne company.
  knownCaseStatus: "idle" | "loading" | "found" | "none" | "error";
  findKnownCaseStudy: () => Promise<void>;

  // Director mode: a director of an HROne customer, and the other companies
  // they sit on. Each picked company becomes a target.
  directorInput: DirectorInput;
  setDirectorInput: (field: keyof DirectorInput, value: string) => void;
  directorMatch: DirectorMatch | null;
  directorStatus: "idle" | "loading" | "error";
  directorError: string | null;
  lookupDirector: () => Promise<void>;
  directorPicked: Record<string, boolean>;
  toggleDirectorCompany: (id: string) => void;
  // For board seats Apollo doesn't know about (e.g. from MCA filings).
  addDirectorCompany: (company: { name: string; domain: string; title: string }) => void;
  // Whether the emails may name the director, or only say a company that
  // shares their board already uses HROne.
  directorNamed: boolean;
  setDirectorNamed: (v: boolean) => void;
  confirmDirector: () => void;

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
  // What the web search turned up for each company, keyed by domain.
  companyResearch: Record<string, ResearchSource[]>;
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
  // Redrafts the past user's own track (past-user mode).
  redraftPastUserTrack: () => Promise<void>;
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
  pastUserCampaignUrl: string | null;
  leadsSent: number;
  sendingStarted: boolean;
  launch: () => Promise<void>;
};

export type DirectorInput = {
  name: string;
  customerDomain: string;
  linkedin: string;
};

// Either the email they had at the old company or its website is enough;
// the position is checked against their job history.
export type PastUserInput = {
  name: string;
  email: string;
  oldCompanyName: string;
  oldCompanyDomain: string;
  oldTitle: string;
};

// Key in `sequences` for the past user's own track. Company domains can't
// look like this, so it never collides with a company's sequence.
export const PAST_USER_SEQUENCE = "__pastuser__";

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
  const [mode, setMode] = useState<WizardMode>("customer");
  const steps = WIZARD_STEPS_BY_MODE[mode];
  const [seedName, setSeedName] = useState("Salesforce");
  const [seedWebsite, setSeedWebsite] = useState("www.salesforce.com");
  const [targetTitles, setTargetTitles] = useState("");
  const [targetRoles, setTargetRoles] = useState<string[]>([...ALL_HR_ROLES]);

  const [pastUserInput, setPastUserInputState] = useState<PastUserInput>({
    name: "",
    email: "",
    oldCompanyName: "",
    oldCompanyDomain: "",
    oldTitle: "",
  });
  const setPastUserInput = (field: keyof PastUserInput, value: string) =>
    setPastUserInputState((prev) => ({ ...prev, [field]: value }));
  const [pastUserMatch, setPastUserMatch] = useState<PastUserMatch | null>(null);
  const [pastUserStatus, setPastUserStatus] = useState<"idle" | "loading" | "error">("idle");
  const [pastUserError, setPastUserError] = useState<string | null>(null);
  const [pastUserConfirmed, setPastUserConfirmed] = useState(false);
  const [knownCaseStatus, setKnownCaseStatus] = useState<
    "idle" | "loading" | "found" | "none" | "error"
  >("idle");

  const [directorInput, setDirectorInputState] = useState<DirectorInput>({
    name: "",
    customerDomain: "",
    linkedin: "",
  });
  const setDirectorInput = (field: keyof DirectorInput, value: string) =>
    setDirectorInputState((prev) => ({ ...prev, [field]: value }));
  const [directorMatch, setDirectorMatch] = useState<DirectorMatch | null>(null);
  const [directorStatus, setDirectorStatus] = useState<"idle" | "loading" | "error">("idle");
  const [directorError, setDirectorError] = useState<string | null>(null);
  const [directorPicked, setDirectorPicked] = useState<Record<string, boolean>>({});
  const [directorNamed, setDirectorNamed] = useState(false);

  const campaignName =
    mode === "pastUser" && pastUserMatch?.current
      ? `${pastUserMatch.name} · ${pastUserMatch.oldCompany.name} → ${pastUserMatch.current.company} · past HROne user`
      : mode === "director" && directorMatch
        ? `${directorMatch.name} · director at ${directorMatch.customer.name} · other boards`
        : `${seedName.trim() || "Campaign"} lookalikes · HR leaders · India`;
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

  // Rep-side corrections to the match (a better email, the right domain).
  const setPastUserCurrent = (
    field: keyof NonNullable<PastUserMatch["current"]>,
    value: string
  ) =>
    setPastUserMatch((prev) =>
      prev?.current ? { ...prev, current: { ...prev.current, [field]: value } } : prev
    );

  const enterPastUserManually = () =>
    setPastUserMatch((prev) =>
      prev
        ? {
            ...prev,
            status: "moved",
            current:
              prev.status === "moved" && prev.current
                ? prev.current
                : { company: "", domain: "", title: "", email: "", linkedin: "", employees: "", location: "" },
            emailWarning: undefined,
          }
        : prev
    );

  const lookupPastUser = async () => {
    setPastUserStatus("loading");
    setPastUserError(null);
    setPastUserConfirmed(false);
    try {
      const res = await fetch("/api/past-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pastUserInput),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      setPastUserMatch(data.match);
      setPastUserStatus("idle");
    } catch (err) {
      setPastUserError(err instanceof Error ? err.message : "Lookup failed");
      setPastUserStatus("error");
    }
  };

  // Looks for HROne's published case study about one known customer: the
  // past user's old company, or the director's HROne company. Found → it
  // fills the case study record; not found → the rep pastes notes, or the
  // emails go out on the bare fact that the company uses HROne.
  const findKnownCaseStudy = async (
    customer = mode === "director" ? directorMatch?.customer : pastUserMatch?.oldCompany
  ) => {
    if (!customer) return;
    setKnownCaseStatus("loading");
    try {
      const res = await fetch("/api/case-studies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerDomain: customer.domain,
          customerName: customer.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      const found: CaseStudyOption | undefined = (data.caseStudies ?? [])[0];
      if (found) {
        selectCaseStudy(found);
        setKnownCaseStatus("found");
      } else {
        setKnownCaseStatus("none");
      }
    } catch (err) {
      console.error("Known customer case study search failed", err);
      setKnownCaseStatus("error");
    }
  };

  const confirmPastUser = () => {
    const match = pastUserMatch;
    if (!match?.current) return;
    const company: Company = {
      id: `pastuser-${match.current.domain}`,
      name: match.current.company,
      domain: match.current.domain,
      score: 100,
      size: match.current.employees,
      region: match.current.location,
      fit: `${match.name} used HROne at ${match.oldCompany.name} and now works here`,
    };
    setPastUserConfirmed(true);
    startKnownCustomerCampaign(match.oldCompany, [company]);
  };

  // Shared by past-user and director mode: one known customer becomes the
  // case study, and `targets` are the only companies the campaign writes to.
  const startKnownCustomerCampaign = (
    customer: { name: string; domain: string },
    targets: Company[]
  ) => {
    setSeedName(customer.name);
    setSeedWebsite(customer.domain);
    setCompanies(targets);
    setPicked(Object.fromEntries(targets.map((c) => [c.id, true])));
    // A fresh record for the customer: drop the client facts carried over
    // from any earlier campaign, keep the HROne context, and allow naming —
    // the emails are built on a known link to that company.
    setAnswers((prev) => ({
      ...Object.fromEntries(
        CASE_QS.filter((q) => !CONTEXT_QS.includes(q.id)).map((q) => [q.id, ""])
      ),
      client_role: "",
      name_allowed: "yes",
      hrone_context: prev.hrone_context,
    }));
    setSelectedCaseStudyUrl(null);
    setCaseContent("");
    setContactGroups([]);
    setSequences({});
    setCompanyResearch({});
    findKnownCaseStudy(customer);
  };

  const lookupDirector = async () => {
    setDirectorStatus("loading");
    setDirectorError(null);
    try {
      const res = await fetch("/api/directors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(directorInput),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      const match: DirectorMatch = data.match;
      setDirectorMatch(match);
      // Board seats start ticked; roles that read like a job don't.
      setDirectorPicked(
        Object.fromEntries(match.companies.map((c) => [c.id, c.kind !== "job" && !!c.domain]))
      );
      setDirectorStatus("idle");
    } catch (err) {
      setDirectorError(err instanceof Error ? err.message : "Lookup failed");
      setDirectorStatus("error");
    }
  };

  const toggleDirectorCompany = (id: string) =>
    setDirectorPicked((prev) => ({ ...prev, [id]: !prev[id] }));

  const addDirectorCompany = (company: { name: string; domain: string; title: string }) => {
    const domain = normalizeDomain(company.domain);
    if (!directorMatch || !domain) return;
    if (directorMatch.companies.some((c) => c.domain === domain)) return;
    const id = `manual-${domain}`;
    setDirectorMatch({
      ...directorMatch,
      companies: [
        ...directorMatch.companies,
        {
          id,
          name: company.name.trim() || domain,
          domain,
          title: company.title.trim() || "Director",
          kind: "board",
          employees: "",
          location: "",
          industry: "",
          manual: true,
        },
      ],
    });
    setDirectorPicked((prev) => ({ ...prev, [id]: true }));
  };

  const confirmDirector = () => {
    const match = directorMatch;
    if (!match) return;
    const targets: Company[] = match.companies
      .filter((c) => directorPicked[c.id] && c.domain)
      .map((c) => ({
        id: `director-${c.domain}`,
        name: c.name,
        domain: c.domain,
        score: 100,
        size: c.employees,
        region: c.location,
        fit: `Shares a director with ${match.customer.name}, which already uses HROne`,
      }));
    if (targets.length === 0) return;
    startKnownCustomerCampaign(match.customer, targets);
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
      const groups = withPastUser(data.groups ?? []);
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

  // Past-user mode: the person we're following always sits at the top of
  // their new company's contacts, tagged so they get their own track — even
  // when the HR search finds nobody else there.
  const withPastUser = (groups: ContactGroup[]): ContactGroup[] => {
    const current = pastUserMatch?.current;
    if (mode !== "pastUser" || !current || !pastUserMatch) return groups;
    const person = {
      name: pastUserMatch.name,
      title: current.title,
      email: current.email,
      linkedin: current.linkedin,
      conf: current.email ? ("Verified" as const) : ("No email" as const),
      pastUser: true,
    };
    const sameName = (n: string) => n.trim().toLowerCase() === person.name.trim().toLowerCase();
    const existing = groups.find((g) => g.domain === current.domain);
    if (!existing) {
      return [
        { company: current.company, domain: current.domain, score: 100, people: [person] },
        ...groups,
      ];
    }
    return groups.map((g) =>
      g === existing ? { ...g, people: [person, ...g.people.filter((p) => !sameName(p.name))] } : g
    );
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
  const [companyResearch, setCompanyResearch] = useState<Record<string, ResearchSource[]>>({});
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

  // In past-user mode every company sequence is the HR team's track, and
  // the person themselves gets the "pastUser" track.
  const draftSequence = async (
    company: SequenceCompany | null,
    track: "team" | "pastUser" = "team"
  ): Promise<SequenceStep[]> => {
    const pastUser =
      mode === "pastUser" && pastUserMatch?.current
        ? {
            name: pastUserMatch.name,
            title: pastUserMatch.current.title,
            oldCompany: pastUserMatch.oldCompany.name,
          }
        : null;
    // Director mode: who links this company to the HROne customer, and
    // their title here.
    const director =
      mode === "director" && directorMatch
        ? {
            name: directorMatch.name,
            customer: directorMatch.customer.name,
            titleHere:
              directorMatch.companies.find((c) => c.domain === company?.domain)?.title ?? "",
            named: directorNamed,
          }
        : null;
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
        ...(pastUser && { pastUser, track }),
        ...(director && { director }),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Sequence generation failed");
    if (company) setCompanyResearch((prev) => ({ ...prev, [company.domain]: data.research ?? [] }));
    return data.steps ?? [];
  };

  // Drafts every company's sequence, a few at a time. Each draft lands as
  // soon as it's ready, and one company failing doesn't lose the others.
  // Past-user mode adds one more job: the past user's own track.
  const generateSequence = async () => {
    setSequenceStatus("loading");
    setSequenceError(null);
    type Job = { company: SequenceCompany | null; track: "team" | "pastUser" };
    const companyTargets: (SequenceCompany | null)[] =
      sequenceCompanies.length > 0 ? sequenceCompanies : [null];
    const targets: Job[] = [
      ...(mode === "pastUser" && sequenceCompanies[0]
        ? [{ company: sequenceCompanies[0], track: "pastUser" as const }]
        : []),
      ...companyTargets.map((company) => ({ company, track: "team" as const })),
    ];
    setSequences({});
    setActiveSequenceDomain(null);
    setSequenceProgress({ done: 0, total: targets.length });

    const failed: { name: string; error: string }[] = [];
    let next = 0;
    const worker = async () => {
      while (next < targets.length) {
        const { company, track } = targets[next++];
        try {
          const steps = await draftSequence(company, track);
          const key =
            track === "pastUser" ? PAST_USER_SEQUENCE : (company?.domain ?? SHARED_SEQUENCE);
          setSequences((prev) => ({ ...prev, [key]: steps }));
        } catch (err) {
          failed.push({
            name:
              track === "pastUser"
                ? `${pastUserMatch?.name ?? "the past user"}'s own track`
                : (company?.name ?? "the campaign"),
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

  const redraftPastUserTrack = async () => {
    const company = sequenceCompanies[0];
    if (!company) return;
    setSequenceStatus("loading");
    setSequenceError(null);
    setSequenceProgress({ done: 0, total: 1 });
    try {
      const steps = await draftSequence(company, "pastUser");
      setSequences((prev) => ({ ...prev, [PAST_USER_SEQUENCE]: steps }));
      setActiveSequenceDomain(PAST_USER_SEQUENCE);
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
  const [pastUserCampaignUrl, setPastUserCampaignUrl] = useState<string | null>(null);
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
    const toStepsIn = (steps: SequenceStep[]) =>
      steps.map(({ day, subject, preheader, hook, content, cta, ps }) => ({
        day,
        subject,
        preheader,
        hook,
        content,
        cta,
        ps,
      }));
    // Past-user mode: the person goes to Smartlead with their own track.
    const pastUserPerson =
      mode === "pastUser"
        ? contactGroups.flatMap((g) => g.people).find((p) => p.pastUser && p.email)
        : undefined;
    const pastUser =
      pastUserPerson && pastUserMatch?.current && sequences[PAST_USER_SEQUENCE]
        ? {
            name: pastUserPerson.name,
            title: pastUserPerson.title,
            email: pastUserPerson.email,
            company: pastUserMatch.current.company,
            steps: toStepsIn(sequences[PAST_USER_SEQUENCE]),
          }
        : undefined;
    try {
      const res = await fetch("/api/smartlead/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignName,
          seedName,
          seedWebsite,
          sequences: Object.fromEntries(
            Object.entries(sequences)
              .filter(([key]) => key !== PAST_USER_SEQUENCE)
              .map(([domain, steps]) => [domain, toStepsIn(steps)])
          ),
          groups: contactGroups.map(({ company, domain, people }) => ({
            company,
            domain,
            people: people.map(({ name, title, email, phone, pastUser }) => ({
              name,
              title,
              email,
              phone,
              pastUser,
            })),
          })),
          pastUser,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Smartlead launch failed");
      setSmartleadCampaignUrl(data.teamCampaignUrl ?? data.campaignUrl ?? null);
      setPastUserCampaignUrl(data.pastUserCampaignUrl ?? null);
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
        mode,
        setMode,
        steps,
        pastUserInput,
        setPastUserInput,
        pastUserMatch,
        setPastUserCurrent,
        pastUserStatus,
        pastUserError,
        lookupPastUser,
        enterPastUserManually,
        confirmPastUser,
        pastUserConfirmed,
        knownCaseStatus,
        findKnownCaseStudy: () => findKnownCaseStudy(),
        directorInput,
        setDirectorInput,
        directorMatch,
        directorStatus,
        directorError,
        lookupDirector,
        directorPicked,
        toggleDirectorCompany,
        addDirectorCompany,
        directorNamed,
        setDirectorNamed,
        confirmDirector,
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
        companyResearch,
        activeSequenceDomain,
        setActiveSequenceDomain,
        sequenceProgress,
        redraftCompany,
        emails,
        setEmailField,
        sequenceStatus,
        sequenceError,
        generateSequence,
        redraftPastUserTrack,
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
        pastUserCampaignUrl,
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
