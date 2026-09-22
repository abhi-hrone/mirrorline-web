export const WIZARD_STEPS = [
  { key: "seed", label: "Customer" },
  { key: "case", label: "Case study" },
  { key: "lookalikes", label: "Lookalikes" },
  { key: "contacts", label: "Contacts" },
  { key: "sequence", label: "Sequence" },
  { key: "review", label: "Review" },
] as const;

export type WizardStepKey = (typeof WIZARD_STEPS)[number]["key"];

export const WIZARD_META: Record<WizardStepKey, { crumb: string; title: string }> = {
  seed: { crumb: "New campaign · 1 of 6", title: "Which customer are we cloning?" },
  case: { crumb: "New campaign · 2 of 6", title: "Case study record" },
  lookalikes: { crumb: "New campaign · 3 of 6", title: "Ocean lookalikes" },
  contacts: { crumb: "New campaign · 4 of 6", title: "Contacts" },
  sequence: { crumb: "New campaign · 5 of 6", title: "Sequence draft" },
  review: { crumb: "New campaign · 6 of 6", title: "Review & approve" },
};

export type CaseQuestion = {
  section: 0 | 1 | 2;
  id: string;
  label: string;
  value: string;
  long?: boolean;
  hint?: string;
};

export const CASE_SECTIONS = [
  { section: 0, title: "The customer" },
  { section: 1, title: "What we delivered" },
  { section: 2, title: "Proof & permission" },
] as const;

export const CASE_QS: CaseQuestion[] = [
  { section: 0, id: "q1", label: "Which customer is this, and who owns the relationship?", value: "Veldhoven Freight — Marcus Beaulieu (CS), Priya Venkat (marketing)" },
  { section: 0, id: "q2", label: "What were they using before us?", value: "Excel rate cards, a legacy TMS from 2011, and email for exceptions.", long: true },
  { section: 0, id: "q3", label: "Who signed, and who actually pushed it through?", value: "COO signed. Dock operations manager was the internal champion." },
  { section: 1, id: "q4", label: "What did the onboarding team build or configure?", value: "Migrated 14,000 historic loads, built the carrier scorecard, wired two EDI partners, trained 40 dock staff over three sessions.", long: true },
  { section: 1, id: "q5", label: "How long from contract to first value?", value: "31 days to first automated invoice" },
  { section: 1, id: "q6", label: "What went wrong, and how was it handled?", value: "EDI mapping for one partner took three weeks longer than planned. We ran it manually in parallel so nothing stalled.", long: true },
  { section: 1, id: "q7", label: "Anything unusual we would not do again?", value: "", long: true, hint: "Optional, but it is the field reps trust most" },
  { section: 2, id: "q8", label: "The headline number", value: "Dock-to-invoice down from 9 days to 2" },
  { section: 2, id: "q9", label: "A quote we are cleared to use", value: "We stopped chasing paperwork and started chasing margin. Two weeks in, my team asked why we waited.", long: true },
  { section: 2, id: "q10", label: "Who is quotable, with title", value: "Anneke de Vries, COO, Veldhoven Freight" },
  { section: 2, id: "q11", label: "Approved for external use?", value: "Yes — logo and quote, name in subject lines allowed" },
];

export type CaseStudyOption = {
  customerName: string;
  customerDomain?: string;
  industry?: string;
  previousSolution?: string;
  sponsor?: string;
  whatWeDelivered?: string;
  timeToValue?: string;
  challenge?: string;
  headlineNumber?: string;
  quote?: string;
  quotableContact?: string;
  sourceUrl: string;
};

export function caseStudyToAnswers(cs: CaseStudyOption): Record<string, string> {
  const answers: Record<string, string> = {};
  const set = (id: string, value: string | undefined) => {
    if (value && value.trim().length > 0) answers[id] = value;
  };

  set(
    "q1",
    [cs.customerName, cs.customerDomain].filter(Boolean).join(" — ") +
      (cs.sponsor ? ` (${cs.sponsor})` : "")
  );
  set("q2", cs.previousSolution);
  set("q3", cs.sponsor);
  set("q4", cs.whatWeDelivered);
  set("q5", cs.timeToValue);
  set("q6", cs.challenge);
  set("q8", cs.headlineNumber);
  set("q9", cs.quote);
  set("q10", cs.quotableContact);

  return answers;
}

export type Company = {
  id: string;
  name: string;
  domain: string;
  score: number;
  size: string;
  region: string;
  fit: string;
};

export const COMPANIES: Company[] = [
  { id: "c1", name: "Rhenus Bulk Services", domain: "rhenus-bulk.de", score: 94, size: "400–600", region: "DACH", fit: "Veldhoven — dock-to-invoice" },
  { id: "c2", name: "Cotrans Belgium", domain: "cotrans.be", score: 91, size: "200–400", region: "Benelux", fit: "Veldhoven — dock-to-invoice" },
  { id: "c3", name: "Ostkust Logistik", domain: "ostkust.se", score: 88, size: "200–400", region: "Nordics", fit: "Nordkapp — cold chain claims" },
  { id: "c4", name: "Trasporti Maletti", domain: "maletti.it", score: 84, size: "600–900", region: "Southern EU", fit: "Harbourline — depot consolidation" },
  { id: "c5", name: "Kellerman Freight Partners", domain: "kellermanfp.nl", score: 82, size: "100–200", region: "Benelux", fit: "Veldhoven — dock-to-invoice" },
  { id: "c6", name: "Baltic Lane Carriers", domain: "balticlane.lv", score: 79, size: "200–400", region: "Nordics", fit: "Nordkapp — cold chain claims" },
  { id: "c7", name: "Alpenroute Spedition", domain: "alpenroute.at", score: 76, size: "100–200", region: "DACH", fit: "Veldhoven — dock-to-invoice" },
  { id: "c8", name: "Iberia Carga Directa", domain: "iberiacarga.es", score: 71, size: "400–600", region: "Southern EU", fit: "Harbourline — depot consolidation" },
];

export const COMPANY_MATCH_DETAIL: Record<
  string,
  {
    industry: string;
    revenue: string;
    tech: string;
    matchAgainst: string;
    signals: { label: string; pct: number; note: string }[];
  }
> = {
  c1: {
    industry: "Freight brokerage",
    revenue: "€85–110M",
    tech: "Legacy TMS, SAP",
    matchAgainst: "Veldhoven Freight",
    signals: [
      { label: "Same legacy TMS vendor", pct: 92, note: "Detected on careers and integration pages." },
      { label: "Headcount and depot count", pct: 84, note: "11 depots, 480 staff — Veldhoven had 9 and 340." },
      { label: "Hiring ops and EDI roles", pct: 71, note: "Three open roles mentioning manual invoicing." },
      { label: "Carrier mix overlap", pct: 58, note: "Six shared carriers with Veldhoven." },
    ],
  },
};

export type ContactConfidence = "Verified" | "Risky" | "Guessed" | "No email";

export const CONTACT_CONFIDENCE_STYLES: Record<ContactConfidence, string> = {
  Verified: "bg-[#E7F0EC] text-teal",
  Risky: "bg-[#F7E6DC] text-[#A0522D]",
  Guessed: "bg-[#F2EDDF] text-[#7A5B27]",
  "No email": "bg-[#EEEBE3] text-[#6E6A5C]",
};

export type ContactGroup = {
  company: string;
  domain: string;
  score: number;
  people: {
    name: string;
    title: string;
    email: string;
    phone?: string;
    linkedin?: string;
    conf: ContactConfidence;
    // Ocean person id used to correlate the async email/phone reveal (see
    // /api/contacts/reveal-webhook); "pending" while we're waiting on that.
    id?: string | null;
    revealStatus?: "pending" | "unavailable";
  }[];
};

export const CONTACT_GROUPS: ContactGroup[] = [
  {
    company: "Rhenus Bulk Services",
    domain: "rhenus-bulk.de",
    score: 94,
    people: [
      { name: "Katrin Böhme", title: "Head of Operations", email: "k.boehme@rhenus-bulk.de", conf: "Verified" },
      { name: "Jonas Reiter", title: "Director, Supply Chain", email: "jonas.reiter@rhenus-bulk.de", conf: "Verified" },
      { name: "Marta Kowal", title: "Dock Operations Manager", email: "m.kowal@rhenus-bulk.de", conf: "Verified" },
      { name: "Stefan Auer", title: "CFO", email: "s.auer@rhenus-bulk.de", conf: "Risky" },
    ],
  },
  {
    company: "Cotrans Belgium",
    domain: "cotrans.be",
    score: 91,
    people: [
      { name: "Wim Declercq", title: "COO", email: "w.declercq@cotrans.be", conf: "Verified" },
      { name: "Els Vermeulen", title: "Head of Transport Planning", email: "els.vermeulen@cotrans.be", conf: "Verified" },
      { name: "Tom Peeters", title: "IT Manager", email: "t.peeters@cotrans.be", conf: "Guessed" },
    ],
  },
  {
    company: "Ostkust Logistik",
    domain: "ostkust.se",
    score: 88,
    people: [
      { name: "Annika Lund", title: "Operations Director", email: "annika.lund@ostkust.se", conf: "Verified" },
      { name: "Petter Ohlsson", title: "Warehouse Lead", email: "p.ohlsson@ostkust.se", conf: "Verified" },
    ],
  },
  {
    company: "Kellerman Freight Partners",
    domain: "kellermanfp.nl",
    score: 82,
    people: [
      { name: "Joost Kellerman", title: "Managing Director", email: "joost@kellermanfp.nl", conf: "Verified" },
      { name: "Fenna Bakker", title: "Invoicing Supervisor", email: "f.bakker@kellermanfp.nl", conf: "Risky" },
    ],
  },
];

export type SequenceStep = {
  step: string;
  day: string;
  subject: string;
  body: string;
  sources: string[];
  state: "Drafted" | "Needs edit";
};

export const SEQUENCE_STYLES: Record<SequenceStep["state"], string> = {
  Drafted: "bg-[#E7F0EC] text-teal",
  "Needs edit": "bg-[#F2EDDF] text-[#7A5B27]",
};

export const INITIAL_SEQUENCE: SequenceStep[] = [
  {
    step: "Step 1",
    day: "Day 0",
    subject: "Veldhoven cut dock-to-invoice from 9 days to 2",
    body: "Katrin — we spent this spring inside Veldhoven Freight, a Dutch broker about your size running the same legacy TMS most of the market is still on.\n\nTheir dock-to-invoice cycle was nine days. It is two now. The work was unglamorous: migrating 14,000 historic loads, building a carrier scorecard, wiring two EDI partners.\n\nWorth 20 minutes to compare notes on where your cycle actually stalls?",
    sources: ["Headline number", "What we configured"],
    state: "Drafted",
  },
  {
    step: "Step 2",
    day: "Day 3",
    subject: "The part that took three weeks longer",
    body: "One thing I left out: Veldhoven's EDI mapping for a single partner ran three weeks past plan. We kept that lane manual in parallel so nothing stalled.\n\nI mention it because every broker I talk to has one partner that will not behave. Which is yours?",
    sources: ["What went wrong"],
    state: "Drafted",
  },
  {
    step: "Step 3",
    day: "Day 7",
    subject: "Anneke de Vries, COO",
    body: '"We stopped chasing paperwork and started chasing margin. Two weeks in, my team asked why we waited."\n\nThat is Veldhoven\'s COO, six months after go-live. Happy to put you two on a call instead of hearing it from me.',
    sources: ["Approved quote", "Quotable contact"],
    state: "Drafted",
  },
  {
    step: "Step 4",
    day: "Day 14",
    subject: "Closing the loop",
    body: "I will stop here. If the nine-days-to-two story is interesting later in the year, the door is open — and I can still arrange the Veldhoven intro.\n\nEither way, good luck with peak season.",
    sources: ["Headline number"],
    state: "Needs edit",
  },
];

export const REVIEW_CHECKS = [
  { label: "Quote and logo cleared for external use", note: "Confirmed by Priya on the case study record" },
  { label: "Every claim traces to a filled field", note: "No invented metrics in the four steps" },
  { label: "Contacts verified, risky addresses removed", note: "Stefan Auer excluded — risky" },
  { label: "Referral credit split agreed", note: "Marcus 60 / Priya 40" },
];

export const STATS = [
  { label: "Live campaigns", value: "6", note: "from 4 customers" },
  { label: "Case studies", value: "11", note: "3 awaiting sign-off" },
  { label: "Reply rate", value: "9.4%", note: "vs 3.1% cold" },
  { label: "Referral payouts", value: "₹45k", note: "3 closed-won" },
];

export type CampaignStatus = "Sending" | "In review" | "Draft";

export const STATUS_STYLES: Record<CampaignStatus, string> = {
  Sending: "bg-[#E7F0EC] text-teal",
  "In review": "bg-[#F2EDDF] text-[#7A5B27]",
  Draft: "bg-canvas text-[#6E6A5C]",
};

export const INTEGRATIONS: {
  name: string;
  role: string;
  state: "Connected" | "Pending";
  key: string;
}[] = [
  {
    name: "Ocean.io",
    role: "Lookalike discovery from a seed domain.",
    state: "Connected",
    key: "sk_live_··· 8f21",
  },
  {
    name: "Findymail",
    role: "Contact discovery and email verification.",
    state: "Connected",
    key: "fm_··· 4c07",
  },
  {
    name: "Sending tool",
    role: "Not chosen yet. Sequences export as CSV meanwhile.",
    state: "Pending",
    key: "—",
  },
];

export const INTEGRATION_STATE_STYLES: Record<"Connected" | "Pending", string> = {
  Connected: "bg-[#E7F0EC] text-teal",
  Pending: "bg-[#F2EDDF] text-[#7A5B27]",
};

export const CAMPAIGNS: {
  name: string;
  seed: string;
  owner: string;
  targets: string;
  replies: string;
  status: CampaignStatus;
  openStep: WizardStepKey;
}[] = [
  {
    name: "Veldhoven × freight brokers, EU",
    seed: "Veldhoven Freight",
    owner: "Marcus · Priya",
    targets: "41",
    replies: "6",
    status: "Sending",
    openStep: "review",
  },
  {
    name: "Harbourline × UK 3PL",
    seed: "Harbourline Group",
    owner: "Sana · Priya",
    targets: "58",
    replies: "4",
    status: "Sending",
    openStep: "review",
  },
  {
    name: "Nordkapp × cold chain",
    seed: "Nordkapp Cold Chain",
    owner: "Marcus · Dev",
    targets: "22",
    replies: "0",
    status: "In review",
    openStep: "review",
  },
  {
    name: "Harbourline × Irish depots",
    seed: "Harbourline Group",
    owner: "Sana",
    targets: "—",
    replies: "—",
    status: "Draft",
    openStep: "case",
  },
];
