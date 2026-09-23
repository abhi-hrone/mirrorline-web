import { NextRequest, NextResponse } from "next/server";
import { AzureOpenAI } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod/v4";
import { CASE_QS } from "@/lib/mock-data";

export const maxDuration = 120;

const StepSchema = z.object({
  day: z.number().int().min(0).describe("Days after the previous step sends (0 for the first email)"),
  subject: z.string(),
  hook: z
    .string()
    .describe("1-2 sentences that earn the next line — a specific, concrete detail, never a generic opener"),
  content: z
    .string()
    .describe("The body proof/value section. Must only state facts present in the supplied case study answers — never invent metrics, names, or outcomes"),
  cta: z.string().describe("A single, low-friction ask — one question or one specific next step, not a menu of options"),
  sources: z
    .array(z.string())
    .describe("Which case-study fields this email draws its claims from, by label (e.g. \"Headline number\")"),
});

const SequenceSchema = z.object({
  steps: z.array(StepSchema).min(1).max(6),
});

const SYSTEM_PROMPT = `You write cold outreach email sequences for HROne, an HR and payroll SaaS platform, based on a single approved customer case study.

Rules:
- Every claim in "content" must trace back to one of the supplied case study answers. Never invent a metric, quote, name, or outcome that isn't in the source data.
- This is a template sent to many different recipients across many different companies, not one specific person. Personalize with the merge tokens {{firstName}}, {{title}}, and {{company}} wherever you'd naturally address the recipient or their company — never invent a recipient's name or company.
- Reference the case study's customer, numbers, and quotes by name (e.g. "Veldhoven Freight") since those are real and approved for external use.
- Each email is short (under 120 words in "content"), written like a founder emailing a peer, not a marketer. No buzzwords, no exclamation points, no "I hope this email finds you well."
- "hook" is the specific detail that opens the email — never a generic "Hi {{firstName}}, hope you're doing well."
- "cta" is exactly one ask — a question or a specific next step, never a list of options.
- Vary the angle across steps (e.g. the headline result, then the specific obstacle overcome, then a customer quote, then a low-pressure close) so the sequence doesn't repeat itself.`;

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

  const filledAnswers = CASE_QS.map((q) => ({ label: q.label, value: answers[q.id] }))
    .filter((a) => a.value && a.value.trim().length > 0);

  if (filledAnswers.length === 0) {
    return NextResponse.json(
      { error: "No case study answers to draft from — fill in the case study record first." },
      { status: 400 }
    );
  }

  const caseStudyText = filledAnswers.map((a) => `${a.label}: ${a.value}`).join("\n");
  const targetingText = [
    targetTitles && `Target titles: ${targetTitles}`,
    targetDepartments.length > 0 && `Target departments: ${targetDepartments.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `Case study source: ${seedName || "the approved customer"}

${caseStudyText}
${targetingText ? `\n${targetingText}` : ""}

Write a ${numSteps}-step cold email sequence based only on the facts above.`;

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

    const steps = parsed.steps.map((s, i) => ({
      step: `Step ${i + 1}`,
      day: `Day ${s.day}`,
      subject: s.subject,
      hook: s.hook,
      content: s.content,
      cta: s.cta,
      sources: s.sources,
      state: "Drafted" as const,
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
