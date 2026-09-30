# Sequence prompt

The prompt behind **Sequence → Generate sequence**. The live copy is split across two files:

- [`src/app/api/sequence/route.ts`](../src/app/api/sequence/route.ts) holds the system prompt
  (the constant `SYSTEM_PROMPT`) and assembles the user prompt per request from the case
  study record, the targeting, the campaign type, the brief and the per-email plan.
- [`src/lib/sequence-options.ts`](../src/lib/sequence-options.ts) holds the campaign types and
  frameworks. Each framework's `instruction`, each type's goal, ask and guidance, and each
  step's purpose and note are sent to the model word for word — edit them as prompt text.

This file is the standalone version, for editing and for pasting into any other tool.
Everything below is adapted from the reference deck *Marketing Email Campaigns for a SaaS
Company in India*.

## What the user chooses

On the Sequence step the user picks:

1. **A campaign type.** This sets the goal, the ask every CTA points at, and the send days.
   It also sets a recommended framework for each email.
2. **A framework per email.** Each email has a dropdown of all ten frameworks, with the
   recommended one marked. Days and step purposes stay fixed by the type.
3. **A campaign brief.** This is free text for facts the case study can't supply: event
   details, an offer, a launch. It's required for the three types that depend on it.
   Otherwise it's optional.

## Campaign types

Of the deck's 15 types, only those that fit this wizard's audience are offered. Recipients
are decision-makers at lookalike companies who **are not HROne customers yet**. Welcome,
trial, feature adoption, newsletter, upsell, renewal, win-back, NPS and referral all need an
existing user relationship, so they're left out on purpose.

| Type | Goal | Ask | Brief | Plan (day · framework) |
| --- | --- | --- | --- | --- |
| Cold outreach / ABM (default) | Book a 15-minute demo with target accounts | a 15-minute call | Optional | 0 · PAS → 3 · BAB → 7 · FAB → 12 · Founder note |
| Case study / social proof | Build trust with an Indian customer's results before a sales call | a call to walk through how the client did it | Optional | 0 · Social proof-led → 4 · Storytelling → 9 · BAB → 14 · Founder note |
| B2B lead nurture drip | Stay in a long, multi-stakeholder buying cycle | a 15-minute call | Optional | 0 · Curiosity-led → 5 · 4Ps → 12 · Social proof-led → 19 · FAB → 26 · Founder note |
| Webinar / event invite | Get registrations | registering for the event | **Required** | 0 · AIDA (2 weeks before) → 12 · Curiosity-led (2 days before) → 14 · Scarcity & urgency (on the day) → 15 · Founder note (day after) |
| Product launch / update | Announce a new capability | a walkthrough of what's new | **Required** | 0 · FAB → 4 · Social proof-led → 9 · Founder note |
| Promotional / festive offer | Drive sign-ups with a time-bound offer | claiming the offer on a call | **Required** | 0 · AIDA → 3 · Social proof-led → 6 · Scarcity & urgency |

Each type also carries India-specific guidance from the deck. Examples: ROI in ₹ for case
studies, IST and 4–5 PM slots for webinars, financial year-end budget spend for offers, and
several decision-makers for nurture drips.

## Frameworks

| Framework | Structure | Recommended for |
| --- | --- | --- |
| AIDA | Attention → Interest → Desire → Action | Launches, offers, invites |
| PAS | Problem → Agitate → Solution | Cold emails, pain points |
| BAB | Before → After → Bridge | Case studies. The case study record is literally a before (`before_hrone`, `problems`) and an after (`solution`, `benefits`) |
| 4Ps | Picture → Promise → Prove → Push | Sales-driven nurture |
| FAB | Features → Advantages → Benefits | Objections, feature news. `modules` are the features, `benefits` the proof |
| Storytelling | Character → Struggle → Discovery → Result | Customer stories |
| Founder note | Plain-text, personal note | Closing / breakup emails |
| Curiosity-led | Open with a question or unexpected fact | First touches |
| Scarcity & urgency | Deadline or limit + one clear CTA | Offers, last reminders. Only a deadline stated in the brief; otherwise the cost of waiting, never an invented one |
| Social proof-led | Lead with numbers, testimonials or logos | Building trust |

Part 3 of the deck (email parts) applies to every email: a preheader that extends the
subject, one CTA as a question, and a P.S., the second-most-read line. The India specifics
come from the Quick Tips: short paragraphs for mobile, ₹ and "+GST" whenever pricing
appears, and a DPDP-safe opt-out.

## The prompt

System prompt:

```text
You are an expert B2B email writer for HROne, an HR and payroll software company selling to
Indian businesses. You write email sequences to decision-makers at Indian companies that are
not HROne customers yet, built on one approved customer case study.

Each request gives you the campaign type, its goal, the one thing every email asks for, and
a plan: for each email, its send day, its purpose in the sequence, and the copywriting
framework it must follow, with that framework's structure spelled out. Write each email's
body to its own framework — the structure is the skeleton, not a set of labels to print.
Return exactly as many emails as the plan lists, in that order — no extra step, no repeated
step.

FIRST SUBJECT: email 1's subject names a concrete outcome the recipient's own company could
get, taken from the case study's results — what could be true at {{company}}, not the
problem and not the product. For example "payroll in 2 days at {{company}}" or "zero revised
pf filings". Still 2 to 5 words, lowercase, and only an outcome the case study achieved.

ONE CONVERSATION: the sequence reads as one thread, not separate emails. From email 2 on,
first fill "connection" with the specific point, number or question from the previous email
that this one carries forward. Then the hook's first sentence must name that same point
explicitly — for example "That 2-day payroll cycle usually raises one question: what happens
to the plants still on spreadsheets?" A reader who missed the earlier email must still
follow. Never "as I mentioned", "following up on my last email", "circling back", "just
checking in". Don't re-introduce HROne or the case study client from scratch after email 1.

WHOSE NUMBERS: the case study's headcount, locations, problems and results belong to the
case study client, never to the recipient. Don't tell the recipient how many employees or
plants they have. Say what the client had, and ask or imagine what the recipient's version
looks like.

EMAIL PARTS: every email has a subject, a preheader that extends the subject instead of
repeating it, a hook, a body, one CTA, and an optional P.S. Only the P.S. may be empty —
every other part is filled in every email, including the closing note. The P.S. is the
second-most-read line — use it for the offer or the proof, not for a second ask. Subjects
are about the recipient's situation, never about the sender or about HROne.

RULES:
- Under 90 words per email body. Plain text, no formatting, no emojis, no exclamation points.
- Write like a person, not a marketer. Simple, direct Indian business English.
- The hook must be about the recipient, never about HROne or the sender. Make it concrete —
  what their month-end, their plants, their states or their headcount actually looks like.
- This is a template sent to many recipients. Personalize with {{firstName}}, {{title}} and
  {{company}} — never invent a recipient's name or company.
- Speak to the recipient's role: HR cares about effort and employee experience, finance
  about accuracy and cost, founders and COOs about scale and risk.
- Exactly one call to action per email, framed as a question, pointing at the campaign's
  ask. Never leave it out, including in the closing note.
- Subject lines: 2 to 5 words, lowercase, no clickbait, no "Re:" tricks.
- Every claim must trace back to a case study answer or to the campaign brief. Never invent
  a metric, quote, name, module, or outcome. If a field is empty, write around it.
- Event names, dates, times, links, offers, discounts, prices and deadlines come only from
  the campaign brief or the HROne context, word for word. Never invent one. Times in IST.
- Name the client only if naming is cleared. Otherwise use the exact description given, and
  keep every number attached to it.
- Amounts in INR with "+GST" where pricing comes up. Never quote a price that is not in the
  HROne context or the campaign brief.
- Vary the angle across steps, and never repeat the same number in the same words twice.
- Avoid: revolutionize, cutting-edge, seamless, game-changing, streamline, leverage,
  empower, "just following up", "quick question", "I hope this email finds you well",
  "imagine if".
```

User prompt (filled per request):

```text
CASE STUDY (from the implementation consultant):
- <label> <answer>          ← one line per filled case study field

HRONE CONTEXT AND PERMISSIONS:
- <client role>, naming permission, HROne context

WHO IS RECEIVING THIS:
- Titles: <target HR roles>
- The same sequence goes to every recipient — write to the role, use the merge tokens.

CAMPAIGN:
- Type: <type label>
- Goal: <type goal>
- Every email asks for: <type ask>
- Guidance: <type guidance>

CAMPAIGN BRIEF (facts you may state as given):
<brief, or "None. Do not mention events, offers, launches, prices or deadlines.">

SEQUENCE TO WRITE:
- Email 1 (Day <day>, <purpose>) — <framework>: <structure>. <framework instruction> <step note>
- Email 2 ...

SOURCING: for each email, "sources" lists where its claims came from, copied word for word
from this list — <case study labels>, "Campaign brief". Do not invent a label.

Write exactly <n> emails, in that order, using only the facts above. The goal: <type goal>
```

## How the app enforces it

- **Continuity is generated before the copy.** Each step's structured output starts with a
  `connection` field: the point from the previous email that this one carries forward.
  Structured output is written top to bottom, so the model commits to the link before it
  writes the hook. The plan line for each email after the first also says "Picks up where
  email N left off". The Sequence page shows the connection above each email ("↳ Picks up
  from Step N").
- **The reviewer sees the real email.** Each drafted step opens in **Preview**. The preview
  shows the greeting, hook, body, CTA and P.S. assembled exactly as Smartlead receives them,
  via `emailParagraphs` in [`src/lib/email-render.ts`](../src/lib/email-render.ts), which the
  launch route also uses. Merge fields are filled in from a real contact found on the
  Contacts step. **Edit** switches to the raw fields.

- **The schedule is the app's, not the model's.** Days, purposes and the step count come
  from the campaign type. The framework per step comes from the user's choice, and an
  unknown value falls back to the recommended one. The route overwrites whatever day and
  framework the model returns with the plan's.
- **Brief-dependent types can't run without a brief.** The Generate button is disabled on
  the page, and the route also rejects the request with a 400 if it's called without one.
- **Naming permission is resolved server-side.** `name_allowed` decides whether the model
  gets the client's name at all, rather than trusting it to honour a condition.
- **Steps missing a CTA or sources are flagged "Needs edit"** for the reviewer instead of
  passing as drafted.
- **No single prospect.** One sequence goes to every contact, so emails use `{{firstName}}`,
  `{{title}}` and `{{company}}`. Smartlead rewrites those to its own merge fields at launch.

## Known model behaviour (gpt-4o-mini)

Seen in testing on 30 September 2026. The draft is a starting point for the reviewer, not
final copy.

- It sometimes breaks the style rules: an exclamation point in a subject, or banned words
  like "imagine" and "streamlined".
- The closing founder note can come back with an empty subject or no sources. The
  "Needs edit" flag catches this.
- The links between emails are good for emails 2–3 and weaker in the closing note. The model
  sometimes copies the example phrasing from the prompt into `connection`.
- Before the WHOSE NUMBERS rule, it told recipients the case study client's headcount as if
  it were theirs. That hasn't appeared since the rule was added, but reviewers should check.
- A stronger Azure deployment than gpt-4o-mini would follow these rules more reliably, still
  for a fraction of a cent per generation.
