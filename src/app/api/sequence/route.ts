import { NextRequest, NextResponse } from "next/server";
import { AzureOpenAI } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod/v4";
import { CASE_QS, CONTEXT_QS, SEQUENCE_FRAMEWORKS } from "@/lib/mock-data";

export const maxDuration = 120;

const StepSchema = z.object({
  day: z.number().int().min(0).describe("Days after the first email sends (0 for the first email)"),
  framework: z
    .string()
    .describe("The copywriting framework this email is written to: PAS, BAB, FAB, or Founder note"),
  subject: z
    .string()
    .describe("2-5 words, lowercase, 30-50 characters, no clickbait and no company name unless naming is cleared"),
  preheader: z
    .string()
    .describe("One short line that extends the subject rather than repeating it — the preview text after the subject"),
  hook: z
    .string()
    .describe("1-2 sentences that earn the next line. Must be about the recipient's situation, never about HROne"),
  content: z
    .string()
    .describe("The body, written to this step's framework. Must only state facts present in the supplied case study answers — never invent metrics, names, or outcomes"),
  cta: z
    .string()
    .describe("Exactly one ask, phrased as a question, pointing at a 15-minute call"),
  ps: z
    .string()
    .describe("Optional P.S. restating the offer or the proof in one line. Empty string when the email is stronger without one"),
  sources: z
    .array(z.string())
    .describe("Which case-study fields this email draws its claims from, by label (e.g. \"What results did they see after go-live?\")"),
});

const SequenceSchema = z.object({
  steps: z.array(StepSchema).min(1).max(6),
});

const SYSTEM_PROMPT = `You are an expert B2B cold email writer for HROne, an HR and payroll software company selling to Indian businesses. You write cold sequences whose only goal is to book a 15-minute meeting, based on one approved customer case study.

STRUCTURE — one copywriting framework per email, in this order:
- Email 1 (Day 0) — PAS (Problem → Agitate → Solution). Open on a problem this recipient likely has, drawn from the case study's problems. Agitate with the cost of leaving it alone. Land the case study's result in one line. Soft ask.
- Email 2 (Day 3) — BAB (Before → After → Bridge). Tell the case study as a short before/after story using the strongest number from the results. The bridge is what made the change possible. Ask whether they recognise the "before".
- Email 3 (Day 7) — FAB (Features → Advantages → Benefits). Take the likely objection — switching effort, data migration, cost, time to go live — and answer it with the modules implemented, what each removes, and the outcome. Offer a short walkthrough.
- Email 4 (Day 12) — Plain-text founder note. Short, polite, no guilt, no new pitch. Leave the door open. It still opens on the recipient, never on HROne or on who the sender is.
Return exactly as many emails as you are asked for — no extra step, no repeated step. If asked for a different number, keep this order and drop or merge from the middle, never the PAS opener or the closing note.

EMAIL PARTS: every email has a subject, a preheader that extends the subject instead of repeating it, a hook, a body, one CTA, and an optional P.S. Only "ps" may be empty — subject, preheader, hook, content and cta are always filled, in every email including the closing note. The P.S. is the second-most-read line — use it for the offer or the proof, not for a second ask. Subjects are about the recipient's situation, never about the sender or about HROne.

RULES:
- Under 90 words in "content". Plain text, no formatting, no emojis, no exclamation points.
- Write like a person, not a marketer. Simple, direct Indian business English.
- The hook must be about the recipient, never about HROne or the sender. Make it concrete — what their month-end, their plants, their states or their headcount actually looks like — not a general observation about HR.
- This is a template sent to many recipients across many companies, not one person. Personalize with the merge tokens {{firstName}}, {{title}} and {{company}} — never invent a recipient's name or company.
- Speak to the recipient's role: HR cares about effort and employee experience, finance cares about accuracy and cost, founders and COOs care about scale and risk.
- Exactly one call to action per email, framed as a question, pointing at a 15-minute call. "cta" is never empty, including in the closing note.
- Subject lines: 2 to 5 words, lowercase, no clickbait, no "Re:" tricks. No question mark unless the subject is genuinely a question.
- Every claim in "content" must trace back to a supplied case study answer. Never invent a metric, quote, name, module, or outcome. If a field is empty, write around it. "sources" is never empty.
- Name the client only if naming is cleared in the case study record. Otherwise use the exact description you are given for them, and keep every number attached to that description — never "one HR team" or "a company we work with".
- Amounts in INR with "+GST" where pricing comes up. Never quote a price that is not in the HROne context.
- Vary the angle across steps so the sequence does not repeat itself, and never repeat the same number in the same words twice.
- Avoid these words and anything built on them: revolutionize, cutting-edge, seamless or seamlessly, game-changing, streamline, leverage, empower, "just following up", "quick question", "I hope this email finds you well", "imagine if".`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.AZURE_OPENAI_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_MODEL;
  const apiVersion = process.env.AZURE_OPENAI_VERSION;
  const missing = ["AZURE_OPENAI_KEY", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_MODEL", "AZURE_OPENAI_VERSION"].filter(
    (name) => !process.env[name]
  );
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `${missing.join(", ")} not set on the server.` },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const seedName = typeof body.seedName === "string" ? body.seedName : "";
  const answers: Record<string, string> =
    body.answers && typeof body.answers === "object" ? body.answers : {};
  const targetTitles = typeof body.targetTitles === "string" ? body.targetTitles : "";
  const targetDepartments: string[] = Array.isArray(body.targetDepartments)
    ? body.targetDepartments.filter((d: unknown) => typeof d === "string")
    : [];
  const numSteps =
    typeof body.numSteps === "number" && body.numSteps >= 1 && body.numSteps <= 6
      ? Math.round(body.numSteps)
      : 4;

  const valueFor = (id: string) => (answers[id] || "").trim();
  const labelFor = (id: string) => CASE_QS.find((q) => q.id === id)?.label ?? id;

  // The case study block is the client's story; the context block is about us
  // and about what we are allowed to say. The prompt treats them differently —
  // only the first may be quoted as fact about a customer.
  const caseFields = CASE_QS.filter((q) => !CONTEXT_QS.includes(q.id));
  const filledAnswers = caseFields
    .map((q) => ({ label: q.label, value: valueFor(q.id) }))
    .filter((a) => a.value.length > 0);

  if (filledAnswers.length === 0) {
    return NextResponse.json(
      { error: "No case study answers to draft from — fill in the case study record first." },
      { status: 400 }
    );
  }

  const nameAllowed = /^y/i.test(valueFor("name_allowed"));
  // When naming isn't cleared, the client can still be described — that
  // description carries every number in the sequence, so build it once here
  // rather than leaving the model to phrase it differently in each email.
  // "1,200 — 900 on the shop floor" becomes "1,200-employee".
  const headcountNumber = valueFor("headcount").match(/[\d,]+/)?.[0];
  const anonymousLabel = [
    "a",
    headcountNumber ? `${headcountNumber}-employee` : "similar-sized",
    valueFor("industry").toLowerCase() || "same-industry",
    "company",
  ].join(" ");
  const clientLabel = nameAllowed ? seedName || "the approved customer" : anonymousLabel;

  const caseStudyText = filledAnswers.map((a) => `- ${a.label} ${a.value}`).join("\n");
  const contextText = [
    valueFor("client_role") && `- ${labelFor("client_role")} ${valueFor("client_role")}`,
    `- Naming: ${
      nameAllowed
        ? `cleared — you may name ${seedName || "the client"} in the emails.`
        : `NOT cleared — never name the client. Refer to them only as "${clientLabel}".`
    }`,
    valueFor("hrone_context") && `- HROne context:
${valueFor("hrone_context")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const targetingText = [
    targetTitles && `- Titles: ${targetTitles}`,
    targetDepartments.length > 0 && `- Departments: ${targetDepartments.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const plan = SEQUENCE_FRAMEWORKS.slice(0, numSteps)
    .map((f, i) => `- Email ${i + 1} (Day ${f.day}): ${f.framework} — ${f.note}`)
    .join("\n");

  const userPrompt = `CASE STUDY (from the implementation consultant):
${caseStudyText}

HRONE CONTEXT AND PERMISSIONS:
${contextText}

WHO IS RECEIVING THIS:
${
  targetingText ||
  "- Decision-makers at companies with a similar profile to the case study client."
}
- The same sequence goes to every recipient, so write to the role, not to a person, and use {{firstName}}, {{title}} and {{company}}.

SEQUENCE TO WRITE:
${plan}

SOURCING: for each email, "sources" lists the case study labels above that its claims came from, copied word for word from this list — ${filledAnswers
    .map((a) => `"${a.label}"`)
    .join(", ")}. Do not invent a label.

Write exactly ${numSteps} emails, in that order, using only the facts above. The only goal is a 15-minute meeting.`;

  const client = new AzureOpenAI({
    apiKey: apiKey as string,
    endpoint: endpoint as string,
    deployment: deployment as string,
    apiVersion: apiVersion as string,
  });

  try {
    const completion = await client.chat.completions.parse({
      model: deployment as string,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: zodResponseFormat(SequenceSchema, "email_sequence"),
    });

    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) {
      return NextResponse.json(
        { error: "Model did not return a parseable sequence. Try again." },
        { status: 502 }
      );
    }

    // The schedule and the framework order are ours, not the model's — it has
    // been seen returning an extra step or restarting the day count midway.
    // Take the plan as written and let the model fill only the copy.
    const steps = parsed.steps.slice(0, numSteps).map((s, i) => ({
      step: `Step ${i + 1}`,
      day: `Day ${SEQUENCE_FRAMEWORKS[i]?.day ?? s.day}`,
      framework: SEQUENCE_FRAMEWORKS[i]?.framework ?? s.framework,
      subject: s.subject,
      preheader: s.preheader,
      hook: s.hook,
      content: s.content,
      cta: s.cta,
      ps: s.ps,
      sources: s.sources,
      // A step missing its ask or its sourcing is the reviewer's problem to
      // fix, so flag it rather than letting it pass as drafted.
      state: s.cta.trim() && s.sources.length > 0 ? ("Drafted" as const) : ("Needs edit" as const),
    }));

    return NextResponse.json({ steps });
  } catch (err) {
    console.error("Sequence generation failed", err);
    return NextResponse.json(
      { error: "Sequence generation failed. Check server logs." },
      { status: 502 }
    );
  }
}
