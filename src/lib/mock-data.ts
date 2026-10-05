// Two ways to start a campaign. "customer" clones a seed customer into
// lookalike companies; "pastUser" follows one person who used HROne at a
// previous employer to the company they work at now. Both share the
// Contacts → Sequence → Review back half.
export type WizardMode = "customer" | "pastUser" | "director";

export const WIZARD_STEPS_BY_MODE = {
  customer: [
    { key: "seed", label: "Customer" },
    { key: "case", label: "Case study" },
    { key: "lookalikes", label: "Lookalikes" },
    { key: "contacts", label: "Contacts" },
    { key: "sequence", label: "Sequence" },
    { key: "review", label: "Review" },
  ],
  pastUser: [
    { key: "pastuser", label: "Past user" },
    { key: "case", label: "Case study" },
    { key: "contacts", label: "Contacts" },
    { key: "sequence", label: "Sequence" },
    { key: "review", label: "Review" },
  ],
  director: [
    { key: "director", label: "Director" },
    { key: "case", label: "Case study" },
    { key: "contacts", label: "Contacts" },
    { key: "sequence", label: "Sequence" },
    { key: "review", label: "Review" },
  ],
} as const;

export type WizardStepKey = (typeof WIZARD_STEPS_BY_MODE)[WizardMode][number]["key"];

export const WIZARD_TITLES: Record<WizardMode, Partial<Record<WizardStepKey, string>>> = {
  customer: {
    seed: "Which customer are we cloning?",
    case: "Case study record",
    lookalikes: "Lookalikes",
    contacts: "Contacts",
    sequence: "Sequence draft",
    review: "Review & approve",
  },
  pastUser: {
    pastuser: "Who used HROne before?",
    case: "Their old company's case study",
    contacts: "Contacts at their new company",
    sequence: "Sequence draft",
    review: "Review & approve",
  },
  director: {
    director: "Which director are we following?",
    case: "Their HROne company's case study",
    contacts: "Contacts at their other companies",
    sequence: "Sequence draft",
    review: "Review & approve",
  },
};

// A director of an HROne customer, and the other companies Apollo lists
// them at. Board seats come from their public profile, so the rep can add
// companies Apollo missed.
export type DirectorCompany = {
  id: string;
  name: string;
  domain: string;
  // Their title at this company, e.g. "Executive Director".
  title: string;
  // "board": reads as a board seat or ownership. "maybe": a director title
  // that could be a job ("Director of Sales"). "job": anything else.
  kind: "board" | "maybe" | "job";
  employees: string;
  location: string;
  industry: string;
  manual?: boolean;
};

export type DirectorMatch = {
  status: "found" | "not_found";
  name: string;
  // Their title at the HROne customer.
  title: string;
  linkedin: string;
  location: string;
  customer: { name: string; domain: string };
  companies: DirectorCompany[];
  checkedAt: string;
};

// A person who used HROne at a previous employer, and where Apollo says they
// work now. "moved" is the only status a campaign can be built on.
export type PastUserMatch = {
  status: "moved" | "same" | "not_found";
  name: string;
  oldCompany: { name: string; domain: string };
  current?: {
    company: string;
    domain: string;
    title: string;
    email: string;
    linkedin: string;
    employees: string;
    location: string;
  };
  // Set when the email Apollo returned doesn't sit on the new company's
  // domain — it may be stale, so the rep should check it.
  emailWarning?: string;
  // Whether their job history shows them at the old company, in the
  // position the rep gave. Matters most without an email, when Apollo
  // matches on name + company and could pick a namesake.
  verification?: {
    // confirmed: a role at the old company, in a matching position (or any
    // position, if the rep gave none). title_differs: at the old company,
    // but not in that position. unconfirmed: the old company isn't there.
    status: "confirmed" | "title_differs" | "unconfirmed";
    // The matching role, e.g. "Human Resources Manager at Walsons, 2023–2026".
    role?: string;
  };
  checkedAt: string;
};

export type CaseQuestion = {
  section: number;
  id: string;
  label: string;
  value: string;
  long?: boolean;
  hint?: string;
};

export const CASE_SECTIONS = [
  { section: 0, title: "The client" },
  { section: 1, title: "Before HROne" },
  { section: 2, title: "What HROne did" },
  { section: 3, title: "Permission & HROne context" },
] as const;

// Pre-filled and editable — this is the one block that is about us, not the
// client, so the sequence writer has something to close on. Reps should swap
// the proof points for whatever is current before launching.
export const HRONE_CONTEXT_DEFAULT = `HROne is a full-suite HCM platform built for Indian businesses. Modules: core HR, payroll with statutory compliance (PF, ESI, PT, LWF, TDS), attendance and leave, shift and roster, recruitment, performance, expense and travel, employee helpdesk, and the InboxHR mobile app.
Differentiators: inbox-style HR that works like email, India-first statutory compliance across states, configurable policies without custom development, biometric and Tally/ERP integrations, go-live in weeks rather than quarters.
Proof points: <add the two strongest current ones, e.g. customer count, average payroll-cycle reduction>.
Call to action: a 15-minute call to see the payroll and compliance flow on their own headcount and states.`;

export const CASE_QS: CaseQuestion[] = [
  { section: 0, id: "industry", label: "What industry is the client in?", value: "Auto components manufacturing" },
  { section: 0, id: "headcount", label: "How many employees do they have?", value: "1,200 — 900 on the shop floor, 300 staff" },
  { section: 0, id: "locations", label: "How many locations or states do they operate in?", value: "5 plants across 3 states (Maharashtra, Gujarat, Tamil Nadu)" },
  { section: 1, id: "before_hrone", label: "How were they managing HR and payroll before?", value: "Excel payroll sheets per plant, a 2014 desktop payroll tool at head office, biometric punches exported manually, leave over email.", long: true },
  { section: 1, id: "problems", label: "What problems were they facing?", value: "Payroll took 9 days and still ran late. Overtime and shift allowances were calculated by hand per plant. Multi-state PT and LWF rules were tracked in a spreadsheet, and two PF filings were revised after errors. HR spent most of the month answering payslip queries.", long: true },
  { section: 2, id: "modules", label: "Which HROne modules did you implement?", value: "Payroll with statutory compliance, attendance and shift management, leave, core HR, employee helpdesk, InboxHR mobile app.", long: true },
  { section: 2, id: "solution", label: "How did HROne solve those problems?", value: "Biometric devices at all 5 plants now push punches straight into attendance. Shift and OT rules are configured per plant, so payroll inputs are locked automatically. State-wise PT, LWF, PF and ESI rules run inside payroll with ready challans. Employees see payslips and raise queries in the mobile app instead of walking into HR.", long: true },
  { section: 2, id: "benefits", label: "What results did they see after go-live? Include numbers if possible.", value: "Payroll cycle down from 9 days to 2. Zero revised statutory filings in the last 3 quarters. Around 70% fewer payslip queries to the HR team. Live on the first plant in 3 weeks, all 5 plants inside 8 weeks.", long: true },
  { section: 3, id: "client_role", label: "Whose experience is this — role of the client contact?", value: "Head of HR" },
  { section: 3, id: "name_allowed", label: "Cleared to name the client in emails? (yes / no)", value: "no", hint: "If no, emails say \"a 1,200-employee manufacturer\" instead" },
  { section: 3, id: "hrone_context", label: "HROne context — products, differentiators, proof points, call to action", value: HRONE_CONTEXT_DEFAULT, long: true },
];

// Fields we ask the sequence writer to treat as background about HROne and
// about what we may say, rather than as facts drawn from the client's story.
export const CONTEXT_QS = ["client_role", "name_allowed", "hrone_context"];

export type CaseStudyOption = {
  customerName: string;
  customerDomain?: string;
  industry?: string;
  headcount?: string;
  locations?: string;
  beforeHrone?: string;
  problems?: string;
  modules?: string;
  solution?: string;
  benefits?: string;
  clientRole?: string;
  sourceUrl: string;
};

export function caseStudyToAnswers(cs: CaseStudyOption): Record<string, string> {
  const answers: Record<string, string> = {};
  const set = (id: string, value: string | undefined) => {
    if (value && value.trim().length > 0) answers[id] = value;
  };

  set("industry", cs.industry);
  set("headcount", cs.headcount);
  set("locations", cs.locations);
  set("before_hrone", cs.beforeHrone);
  set("problems", cs.problems);
  set("modules", cs.modules);
  set("solution", cs.solution);
  set("benefits", cs.benefits);
  set("client_role", cs.clientRole);
  // A published case study on hrone.cloud is already public, so the client
  // can be named in outreach that cites it.
  set("name_allowed", "yes");

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

export type ContactConfidence = "Verified" | "Risky" | "Guessed" | "No email" | "Not revealed";

export const CONTACT_CONFIDENCE_STYLES: Record<ContactConfidence, string> = {
  Verified: "bg-[#E7F0EC] text-teal",
  Risky: "bg-[#F7E6DC] text-[#A0522D]",
  Guessed: "bg-[#F2EDDF] text-[#7A5B27]",
  "No email": "bg-[#EEEBE3] text-[#6E6A5C]",
  "Not revealed": "bg-transparent text-[#9C978A]",
};

export type ContactGroup = {
  company: string;
  domain: string;
  score: number;
  // Provider whose search produced these people's ids (e.g. "Apollo"); the
  // reveal step needs it because ids only mean something to their issuer.
  source?: string;
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
    // The past HROne user this campaign follows (past-user mode only). They
    // get their own email track rather than the HR team's.
    pastUser?: boolean;
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

// One web page found while researching a target company.
export type ResearchSource = {
  title: string;
  url: string;
  publishedDate: string;
  source: "website" | "news";
  summary?: string;
};

export type SequenceStep = {
  step: string;
  day: string;
  framework: string;
  subject: string;
  preheader: string;
  hook: string;
  content: string;
  cta: string;
  ps: string;
  sources: string[];
  // Web pages behind any company research this step mentions.
  research?: ResearchSource[];
  // What this step picks up from the one before it (empty for step 1).
  connection?: string;
  state: "Drafted" | "Needs edit";
};

export const SEQUENCE_STYLES: Record<SequenceStep["state"], string> = {
  Drafted: "bg-[#E7F0EC] text-teal",
  "Needs edit": "bg-[#F2EDDF] text-[#7A5B27]",
};

// The copywriting framework each step is written to. Kept in one place so the
// generator prompt and the reviewer's UI label the steps the same way.
export const INITIAL_SEQUENCE: SequenceStep[] = [
  {
    step: "Step 1",
    day: "Day 0",
    framework: "PAS",
    subject: "payroll across 3 states",
    preheader: "What 5 plants on spreadsheets usually costs by the 7th",
    hook: "{{firstName}}, running payroll for plants in three states usually means three sets of PT and LWF rules and one spreadsheet holding it together.",
    content: "One mismatch in shift or OT inputs and the cycle slips past the 7th, then the revised filing follows. A 1,200-employee manufacturer we work with was spending 9 days a month on exactly that. It is 2 days now.",
    cta: "Is payroll at {{company}} still running on plant-wise sheets?",
    ps: "",
    sources: ["Problems", "Benefits"],
    state: "Drafted",
  },
  {
    step: "Step 2",
    day: "Day 3",
    framework: "BAB",
    subject: "9 days to 2 days",
    preheader: "How a 5-plant manufacturer closed payroll in two days",
    hook: "Before: Excel payroll per plant, punches exported by hand, PT and LWF tracked in a sheet, two PF filings revised.",
    content: "After: biometric punches flow straight into attendance, shift and OT rules are configured per plant, and state-wise statutory runs inside payroll with ready challans. Payroll went from 9 days to 2, with no revised filings in three quarters.",
    cta: "Does month-end at {{company}} look closer to the before or the after?",
    ps: "",
    sources: ["Before HROne", "Solution", "Benefits"],
    state: "Drafted",
  },
  {
    step: "Step 3",
    day: "Day 7",
    framework: "FAB",
    subject: "switching mid-year",
    preheader: "First plant live in 3 weeks, the rest inside 8",
    hook: "The usual worry at this point is the switch itself, {{firstName}} — mid-year migration, biometric devices, past payroll data.",
    content: "We went plant by plant: payroll with statutory compliance, attendance, leave and the mobile app on the first plant in 3 weeks, all 5 inside 8. Shop floor never saw a gap, and HR stopped fielding payslip queries once employees had them in the app.",
    cta: "Want me to walk you through how that sequencing would work for {{company}}'s sites?",
    ps: "",
    sources: ["Modules automated", "Solution", "Benefits"],
    state: "Drafted",
  },
  {
    step: "Step 4",
    day: "Day 12",
    framework: "Founder note",
    subject: "closing this off",
    preheader: "No follow-ups after this one",
    hook: "{{firstName}}, I will stop writing after this.",
    content: "If multi-state payroll is not the thing worth fixing at {{company}} this year, that is fair — most teams pick it up when a plant is added or an audit lands.",
    cta: "Should I close this off, or check back after the financial year end?",
    ps: "Happy to send the 5-plant story as a one-pager either way, no call needed.",
    sources: ["Locations", "Benefits"],
    state: "Needs edit",
  },
];

export const REVIEW_CHECKS = [
  { label: "Quote and logo cleared for external use", note: "Confirmed by Priya on the case study record" },
];

export type CampaignStatus =
  | "Sending"
  | "In review"
  | "Draft"
  | "Paused"
  | "Stopped"
  | "Completed";

export const STATUS_STYLES: Record<CampaignStatus, string> = {
  Sending: "bg-[#E7F0EC] text-teal",
  "In review": "bg-[#F2EDDF] text-[#7A5B27]",
  Draft: "bg-canvas text-[#6E6A5C]",
  Paused: "bg-[#F2EDDF] text-[#7A5B27]",
  Stopped: "bg-canvas text-[#6E6A5C]",
  Completed: "bg-[#E7F0EC] text-teal",
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
    name: "Smartlead",
    role: "Sends the approved sequence — pushes contacts and steps into a Smartlead campaign draft.",
    state: "Connected",
    key: "sl_··· 91c4",
  },
];

export const INTEGRATION_STATE_STYLES: Record<"Connected" | "Pending", string> = {
  Connected: "bg-[#E7F0EC] text-teal",
  Pending: "bg-[#F2EDDF] text-[#7A5B27]",
};
