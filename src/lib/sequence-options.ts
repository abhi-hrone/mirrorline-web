// Campaign types and copywriting frameworks offered on the Sequence step,
// adapted from the "Marketing Email Campaigns for a SaaS Company in India"
// reference. Each `instruction` is sent to the model verbatim (see
// /api/sequence), so edit them as prompt text. docs/sequence-prompt.md
// explains the choices.

export type FrameworkId =
  | "AIDA"
  | "PAS"
  | "BAB"
  | "4Ps"
  | "FAB"
  | "Storytelling"
  | "Founder note"
  | "Curiosity-led"
  | "Scarcity & urgency"
  | "Social proof-led";

export type Framework = {
  id: FrameworkId;
  structure: string;
  bestFor: string;
  instruction: string;
};

export const FRAMEWORKS: Framework[] = [
  {
    id: "AIDA",
    structure: "Attention → Interest → Desire → Action",
    bestFor: "Launches, offers, invites",
    instruction:
      "Open with the one fact most likely to stop this reader. Build interest with what changed for the case study client, make them want the same result for their own team, then make the ask.",
  },
  {
    id: "PAS",
    structure: "Problem → Agitate → Solution",
    bestFor: "Cold emails, pain points",
    instruction:
      "Open on a problem this recipient likely has, drawn from the case study's problems. Agitate with what it costs to leave it alone — a missed payroll date, a revised filing, HR's month buried in queries. Land the case study's result in one line.",
  },
  {
    id: "BAB",
    structure: "Before → After → Bridge",
    bestFor: "Case studies",
    instruction:
      "Tell the case study as a short before/after story built on the strongest number in the results. The bridge is the one thing that made the change possible. Ask whether they recognise the \"before\".",
  },
  {
    id: "4Ps",
    structure: "Picture → Promise → Prove → Push",
    bestFor: "Sales-driven nurture",
    instruction:
      "Picture the recipient's month-end as it could look, promise that outcome in one line, prove it with the case study's numbers, then push for the ask.",
  },
  {
    id: "FAB",
    structure: "Features → Advantages → Benefits",
    bestFor: "Objections, feature news",
    instruction:
      "Take the likely objection — switching effort, data migration, cost, time to go live — and answer it with the modules implemented, what each one removes, and the result.",
  },
  {
    id: "Storytelling",
    structure: "Character → Struggle → Discovery → Result",
    bestFor: "Customer stories",
    instruction:
      "Tell the case study client's story in a few short lines: who they are (within the naming permission), what they struggled with, what they found, and the result in numbers.",
  },
  {
    id: "Founder note",
    structure: "Plain-text, personal note",
    bestFor: "Closing / breakup emails",
    instruction:
      "Short, polite, plain text, no guilt and no new pitch. Leave the door open. It still opens on the recipient, never on HROne or on who the sender is.",
  },
  {
    id: "Curiosity-led",
    structure: "Open with a question or unexpected fact",
    bestFor: "First touches, re-engagement",
    instruction:
      "Open with a question or an unexpected fact from the case study that the reader can't answer without reading on, and answer it in the body.",
  },
  {
    id: "Scarcity & urgency",
    structure: "Deadline or limit + one clear CTA",
    bestFor: "Offers, last reminders",
    instruction:
      "Lead with a real deadline or limit from the campaign brief, then one clear ask. If the brief gives none, make the urgency the cost of waiting — the next payroll cycle, the next filing date — never an invented deadline.",
  },
  {
    id: "Social proof-led",
    structure: "Lead with numbers, testimonials or logos",
    bestFor: "Building trust",
    instruction:
      "Lead with the case study's strongest number, or the client contact's role and outcome, then say what it would mean for the reader's own team.",
  },
];

export const FRAMEWORK_BY_ID = Object.fromEntries(FRAMEWORKS.map((f) => [f.id, f])) as Record<
  FrameworkId,
  Framework
>;

export function isFrameworkId(v: unknown): v is FrameworkId {
  return typeof v === "string" && v in FRAMEWORK_BY_ID;
}

export type PlanStep = {
  day: number;
  // Short label shown on the Sequence page and sent to the model.
  purpose: string;
  // Extra instruction for the model only, where the label alone misleads it.
  note?: string;
  framework: FrameworkId;
};

export type CampaignType = {
  id: string;
  label: string;
  goal: string;
  // What every CTA in the sequence points at.
  ask: string;
  guidance: string;
  // Types that depend on facts the case study can't supply (an event, an
  // offer, a launch) need the brief filled before a sequence can be drafted.
  needsBrief: boolean;
  briefHint: string;
  plan: PlanStep[];
};

// Only the types that fit this wizard's audience: decision-makers at
// lookalike companies who are not HROne customers yet. Lifecycle types from
// the reference (welcome, trial, renewal, win-back, NPS…) need an existing
// user relationship and are left out on purpose.
export const CAMPAIGN_TYPES: CampaignType[] = [
  {
    id: "cold_outreach",
    label: "Cold outreach / ABM",
    goal: "Book a 15-minute demo with target accounts.",
    ask: "a 15-minute call",
    guidance:
      "These people have never heard from HROne. Keep the tone respectful and personalize by role, industry and company.",
    needsBrief: false,
    briefHint: "Optional — anything every email should mention",
    plan: [
      { day: 0, purpose: "First touch", framework: "PAS" },
      { day: 3, purpose: "The customer story", framework: "BAB" },
      { day: 7, purpose: "Answer the likely objection", framework: "FAB" },
      { day: 12, purpose: "Closing note", framework: "Founder note" },
    ],
  },
  {
    id: "case_study",
    label: "Case study / social proof",
    goal: "Build trust with an Indian customer's results before a sales call.",
    ask: "a 15-minute call to walk through how the client did it",
    guidance:
      "Indian customer proof with ROI stated in ₹ lands far better than global examples. Lean on the case study's own numbers.",
    needsBrief: false,
    briefHint: "Optional — anything every email should mention",
    plan: [
      { day: 0, purpose: "Lead with the result", framework: "Social proof-led" },
      { day: 4, purpose: "The full story", framework: "Storytelling" },
      { day: 9, purpose: "Before and after, for their team", framework: "BAB" },
      { day: 14, purpose: "Closing note", framework: "Founder note" },
    ],
  },
  {
    id: "lead_nurture",
    label: "B2B lead nurture drip",
    goal: "Keep HROne in the conversation through a long, multi-stakeholder buying cycle.",
    ask: "a 15-minute call",
    guidance:
      "Indian B2B deals involve several decision-makers. Give the recipient's role something to take to the others: HR — effort and employee experience, finance — accuracy and cost, founders — scale and risk.",
    needsBrief: false,
    briefHint: "Optional — anything every email should mention",
    plan: [
      { day: 0, purpose: "Open a question", framework: "Curiosity-led" },
      { day: 5, purpose: "What good looks like", framework: "4Ps" },
      { day: 12, purpose: "Proof", framework: "Social proof-led" },
      { day: 19, purpose: "Answer the likely objection", framework: "FAB" },
      { day: 26, purpose: "Closing note", framework: "Founder note" },
    ],
  },
  {
    id: "webinar",
    label: "Webinar / event invite",
    goal: "Get registrations for an HROne event.",
    ask: "registering for the event",
    guidance:
      "Give every time in IST. Schedule around Indian work hours, e.g. 4–5 PM IST.",
    needsBrief: true,
    briefHint: "Event name, date and time (IST), registration link, and what attendees will learn",
    plan: [
      { day: 0, purpose: "Invite, 2 weeks before", framework: "AIDA" },
      { day: 12, purpose: "Reminder, 2 days before", framework: "Curiosity-led" },
      {
        day: 14,
        purpose: "Last call, on the day",
        note: "Sent on the morning of the event — the event is today, not tomorrow.",
        framework: "Scarcity & urgency",
      },
      {
        day: 15,
        purpose: "Follow-up, the day after",
        note: "Most recipients did not attend. Offer the recording only if the brief gives a recording link; otherwise offer a 15-minute call instead.",
        framework: "Founder note",
      },
    ],
  },
  {
    id: "product_launch",
    label: "Product launch / update",
    goal: "Announce a new HROne capability to prospects it's relevant to.",
    ask: "a 15-minute walkthrough of what's new",
    guidance:
      "Highlight what's built for India — statutory compliance, Tally integration, e-invoicing — only where the brief says so.",
    needsBrief: true,
    briefHint: "What launched, who it's for, and anything specific the emails must say",
    plan: [
      { day: 0, purpose: "The announcement", framework: "FAB" },
      { day: 4, purpose: "Proof it works", framework: "Social proof-led" },
      { day: 9, purpose: "Closing note", framework: "Founder note" },
    ],
  },
  {
    id: "promotional",
    label: "Promotional / festive offer",
    goal: "Drive sign-ups with a time-bound offer.",
    ask: "claiming the offer on a 15-minute call",
    guidance:
      "Tie the offer to its occasion — Diwali, New Year, or financial year-end (Jan–March), when budgets get spent before March 31. Always show ₹ and +GST.",
    needsBrief: true,
    briefHint: "The offer, its price or discount in ₹, the deadline, and the occasion",
    plan: [
      { day: 0, purpose: "The offer", framework: "AIDA" },
      { day: 3, purpose: "Proof", framework: "Social proof-led" },
      { day: 6, purpose: "Last call before the deadline", framework: "Scarcity & urgency" },
    ],
  },
];

export const DEFAULT_CAMPAIGN_TYPE = CAMPAIGN_TYPES[0];

// The past user's own track in past-user mode. Not offered in the campaign
// type picker: it only makes sense written to someone who has used HROne
// before, and its plan is fixed. The HR team at their new company gets the
// type picked on the Sequence step, starting a few days later.
export const PAST_USER_CAMPAIGN_TYPE: CampaignType = {
  id: "past_user",
  label: "Past HROne user",
  goal: "Get someone who used HROne at their previous company to bring it to their new one.",
  ask: "a 15-minute call to see how HROne would fit their new company",
  guidance:
    "This person already knows HROne from their previous employer, so never explain what HROne is from scratch. Write like someone picking up an old professional relationship: warm, brief, specific to their move.",
  needsBrief: false,
  briefHint: "Optional — anything every email should mention",
  plan: [
    {
      day: 0,
      purpose: "Congratulate the move, connect it to HROne",
      note: "Open on their new role at {{company}}. Remind them, in one line, of what HROne did at their previous company, then ask how HR and payroll run at the new one.",
      framework: "Curiosity-led",
    },
    {
      day: 4,
      purpose: "What it took at their old company",
      note: "Retell the old company's before/after in a few lines, as something they saw first-hand — without claiming they led the project.",
      framework: "BAB",
    },
    { day: 9, purpose: "Closing note", framework: "Founder note" },
  ],
};

export function campaignTypeById(id: unknown): CampaignType {
  if (id === PAST_USER_CAMPAIGN_TYPE.id) return PAST_USER_CAMPAIGN_TYPE;
  return CAMPAIGN_TYPES.find((t) => t.id === id) ?? DEFAULT_CAMPAIGN_TYPE;
}
