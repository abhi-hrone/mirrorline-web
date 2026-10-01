import { NextRequest, NextResponse } from "next/server";
import { AzureOpenAI } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod/v4";
import { withRequestLog } from "@/lib/logger";

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
  industry: z
    .string()
    .nullable()
    .describe(
      "The client's industry and sub-segment exactly as described (e.g. 'Manufacturing — auto components, Tier-1 supplier'), plus any other company context given (name, type of business, growth stage), on a single line. Null if not stated."
    ),
  headcount: z
    .string()
    .nullable()
    .describe(
      "Employee count with every breakdown given — total, by category (blue/white collar, contract, field staff), by location, and any growth over time, on a single line. Null if not stated."
    ),
  locations: z
    .string()
    .nullable()
    .describe(
      "Number of locations, offices, plants, branches, states or countries, naming them wherever the content does, on a single line. Null if not stated."
    ),
  before_hrone: z
    .string()
    .nullable()
    .describe(
      "Everything about how HR and payroll were run before HROne: tools, spreadsheets, previous vendors or software, manual processes, team size, how long tasks took, and why they decided to switch. Null if not stated."
    ),
  problems: z
    .string()
    .nullable()
    .describe(
      "Every problem or pain point mentioned, one per line as a bullet, each with its specifics (who was affected, how often, how long it took, errors, compliance risk, costs, numbers). Do not merge or drop any. Null if not stated."
    ),
  modules: z
    .string()
    .nullable()
    .describe(
      "Every HROne module, feature, integration, or app mentioned as implemented or used, as a comma-separated list, including any notes on rollout order or customisation. Null if not stated."
    ),
  solution: z
    .string()
    .nullable()
    .describe(
      "A detailed account of how HROne solved each problem: the specific features, workflows, configuration, integrations, implementation timeline, go-live date, and support involved. Map solutions to the problems where the content allows. Null if not stated."
    ),
  benefits: z
    .string()
    .nullable()
    .describe(
      "Every result after go-live, one per line as a bullet, keeping every number, percentage, time saving, cost saving, before/after comparison and timeframe exactly as stated. Include qualitative outcomes and any direct quotes (verbatim, in quotes, attributed). Null if not stated."
    ),
  client_role: z
    .string()
    .nullable()
    .describe(
      "Name (if given), designation and department of each client contact quoted or referenced, comma-separated on a single line. Null if not stated."
    ),
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

const SYSTEM_PROMPT = `You extract structured case-study facts from raw text a sales rep pastes in — notes, a call transcript, an email thread, or a draft write-up about a customer's HROne implementation. Your output fills a case study form, and the rep wants that form as complete and detailed as the content allows.

Capture everything:
- Read the whole content and carry every relevant fact into the matching field. Do not summarize, shorten, or pick "the main points" — if the content lists five problems, return all five; if it gives three metrics, return all three.
- Keep specifics exactly as written: numbers, percentages, durations, dates, names of tools, vendors, modules, locations, and team sizes. Keep units and timeframes ("from 5 days to 4 hours", "within 3 months of go-live").
- Keep direct quotes verbatim, in quotation marks, with who said them.
- Industry, headcount, locations and client_role are single-line fields: pack all their details into one line, separated by commas or semicolons. The other fields can be multi-line.
- Write full, clear sentences or bullet lists ("- " per line) rather than terse fragments. Long fields are fine.
- If a fact fits more than one field, put it in the most specific one, and repeat it elsewhere only when it's needed for that field to make sense.
- Pull facts from anywhere in the content, including asides and side comments in a transcript, not just the obvious sections.

Never invent:
- Only use facts stated or clearly implied in the content. Never make up a number, a module, a quote, a name, or an outcome, and never add generic marketing claims.
- If a field genuinely isn't covered, return null for it — do not guess or pad.

Judge "sufficient" strictly: it must describe a specific customer's before-state, at least one concrete problem, and ideally what was done and what changed. General marketing copy, a product description with no customer in it, or a one-line summary is NOT sufficient.`;

export const POST = withRequestLog("case-studies-fill", async (req: NextRequest) => {
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
});
