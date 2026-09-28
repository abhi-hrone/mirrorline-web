import { NextRequest, NextResponse } from "next/server";
import Exa from "exa-js";
import { normalizeDomain } from "@/lib/domain";
import { getCachedCaseStudies, saveCaseStudies } from "@/lib/research-cache";
import { withRequestLog } from "@/lib/logger";

export const maxDuration = 300;

const OUTPUT_SCHEMA = {
  type: "object",
  required: ["caseStudies"],
  properties: {
    caseStudies: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        required: ["customerName", "sourceUrl"],
        properties: {
          customerName: { type: "string" },
          customerDomain: { type: "string" },
          industry: { type: "string", description: "The industry the customer operates in" },
          headcount: {
            type: "string",
            description: "How many employees the customer has",
          },
          locations: {
            type: "string",
            description: "How many locations, cities or states the customer operates in",
          },
          beforeHrone: {
            type: "string",
            description: "How the customer managed HR and payroll before HROne",
          },
          problems: {
            type: "string",
            description: "The problems they were facing before HROne",
          },
          modules: {
            type: "string",
            description: "Which HROne modules were implemented",
          },
          solution: {
            type: "string",
            description: "How HROne solved those problems",
          },
          benefits: {
            type: "string",
            description: "Results after go-live, with numbers wherever they are stated",
          },
          clientRole: {
            type: "string",
            description: "Role of the customer contact quoted or interviewed",
          },
          sourceUrl: { type: "string", format: "uri" },
        },
      },
    },
  },
} as const;

function buildQuery(prospectUrl: string) {
  return (
    "Find case studies published by hrone.cloud (HROne, an HR and payroll " +
    `SaaS platform for Indian businesses) about customers whose profile is ` +
    `relevant to the prospect at ${prospectUrl}. For each relevant case ` +
    "study, return the customer, their industry, employee headcount, number " +
    "of locations or states, how they managed HR and payroll before HROne, " +
    "the problems they faced, which HROne modules were implemented, how " +
    "HROne solved those problems, the results after go-live with any numbers " +
    "stated, the role of the customer contact quoted, and the source URL. " +
    "Only include case studies you can cite a real source URL for."
  );
}

export const POST = withRequestLog("case-studies", async (req: NextRequest) => {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "EXA_API_KEY is not set on the server." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const prospectUrl = typeof body.prospectUrl === "string" ? body.prospectUrl.trim() : "";
  if (!prospectUrl) {
    return NextResponse.json({ error: "prospectUrl is required." }, { status: 400 });
  }

  const domain = normalizeDomain(prospectUrl);
  const cached = await getCachedCaseStudies(domain).catch((err) => {
    console.error("Case studies cache lookup failed", err);
    return null;
  });
  if (cached) {
    return NextResponse.json({ caseStudies: cached, cached: true });
  }

  const exa = new Exa(apiKey);

  try {
    const run = await exa.agent.runs.create({
      query: buildQuery(prospectUrl),
      outputSchema: OUTPUT_SCHEMA,
    });
    const completed = await exa.agent.runs.pollUntilFinished(run.id);

    const structured = completed.output?.structured as
      | { caseStudies?: unknown[] }
      | undefined;
    const caseStudies = structured?.caseStudies ?? [];

    await saveCaseStudies(domain, caseStudies).catch((err) =>
      console.error("Case studies cache save failed", err)
    );

    return NextResponse.json({ caseStudies });
  } catch (err) {
    console.error("Exa case study search failed", err);
    return NextResponse.json(
      { error: "Case study search failed. Check server logs." },
      { status: 502 }
    );
  }
});
