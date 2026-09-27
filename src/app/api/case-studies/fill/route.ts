import { NextRequest, NextResponse } from "next/server";
import { AzureOpenAI } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod/v4";

export const maxDuration = 120;

const FillSchema = z.object({
  sufficient: z
    .boolean()
    .describe(
      "True only if the content has enough concrete detail about a customer's situation, problems, HROne's solution, and results to fill out most of a case study record. False if it is too vague, off-topic, or missing the client's actual story."
    ),
  reason: z
    .string()
    .describe(
      "If not sufficient, a short, specific note on what's missing (e.g. 'no mention of results or numbers after go-live'). Empty string when sufficient."
    ),
  industry: z.string().nullable().describe("The industry the client is in, or null if not stated"),
  headcount: z.string().nullable().describe("How many employees the client has, or null if not stated"),
  locations: z
    .string()
    .nullable()
    .describe("How many locations or states the client operates in, or null if not stated"),
  before_hrone: z
    .string()
    .nullable()
    .describe("How the client managed HR and payroll before HROne, or null if not stated"),
  problems: z.string().nullable().describe("The problems the client was facing, or null if not stated"),
  modules: z.string().nullable().describe("Which HROne modules were implemented, or null if not stated"),
  solution: z.string().nullable().describe("How HROne solved those problems, or null if not stated"),
  benefits: z
    .string()
    .nullable()
    .describe("Results after go-live, with numbers wherever stated, or null if not stated"),
  client_role: z
    .string()
    .nullable()
    .describe("Role of the client contact quoted or referenced, or null if not stated"),
});

const FIELD_IDS = [
  "industry",
  "headcount",
  "locations",
  "before_hrone",
  "problems",
  "modules",
  "solution",
  "benefits",
  "client_role",
] as const;

const SYSTEM_PROMPT = `You extract structured case-study facts from raw text a sales rep pastes in — notes, a call transcript, an email thread, or a draft write-up about a customer's HROne implementation.

Only use facts stated in the content. Never invent a number, a module, a quote, or an outcome. If a field isn't stated, return null for it — do not guess or generalize.

Judge "sufficient" strictly: it must describe a specific customer's before-state, at least one concrete problem, and ideally what was done and what changed. General marketing copy, a product description with no customer in it, or a one-line summary is NOT sufficient.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.AZURE_OPENAI_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_MODEL;
  const apiVersion = process.env.AZURE_OPENAI_VERSION;
  const missing = [
    "AZURE_OPENAI_KEY",
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_MODEL",
    "AZURE_OPENAI_VERSION",
  ].filter((name) => !process.env[name]);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `${missing.join(", ")} not set on the server.` },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "Paste some content first." }, { status: 400 });
  }

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
        { role: "user", content },
      ],
      response_format: zodResponseFormat(FillSchema, "case_study_fields"),
    });

    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) {
      return NextResponse.json(
        { error: "Model did not return a parseable result. Try again." },
        { status: 502 }
      );
    }

    if (!parsed.sufficient) {
      return NextResponse.json(
        {
          error:
            parsed.reason ||
            "That content doesn't have enough detail to fill out the case study. Add more specifics about the client's situation, problems, and results, then try again.",
        },
        { status: 422 }
      );
    }

    const answers: Record<string, string> = {};
    for (const id of FIELD_IDS) {
      const value = parsed[id];
      if (value && value.trim().length > 0) answers[id] = value.trim();
    }

    if (Object.keys(answers).length === 0) {
      return NextResponse.json(
        {
          error:
            "Couldn't find any usable case study facts in that content. Add more specifics and try again.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ answers });
  } catch (err) {
    console.error("Case study extraction failed", err);
    return NextResponse.json(
      { error: "Extraction failed. Check server logs." },
      { status: 502 }
    );
  }
}
