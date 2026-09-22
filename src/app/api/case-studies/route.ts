import { NextRequest, NextResponse } from "next/server";
import Exa from "exa-js";
import { normalizeDomain } from "@/lib/domain";
import { getCachedCaseStudies, saveCaseStudies } from "@/lib/research-cache";

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
          industry: { type: "string" },
          previousSolution: {
            type: "string",
            description: "What the customer used before HROne",
          },
          sponsor: {
            type: "string",
            description: "Who signed or championed the deal, if mentioned",
          },
          whatWeDelivered: {
            type: "string",
            description: "What HROne's team built, configured, or implemented",
          },
          timeToValue: {
            type: "string",
            description: "Time from contract/signup to first measurable value",
          },
          challenge: {
            type: "string",
            description: "Any obstacle encountered and how it was handled",
          },
          headlineNumber: {
            type: "string",
            description: "The single most quotable metric or result",
          },
          quote: { type: "string" },
          quotableContact: {
            type: "string",
            description: "Name and title of the person quoted",
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
    `SaaS platform) about customers whose profile is relevant to the ` +
    `prospect at ${prospectUrl}. For each relevant case study, return the ` +
    "customer, what they used before HROne, who sponsored or championed the " +
    "deal, what HROne delivered, the time to first value, any challenges and " +
    "how they were handled, the headline metric, a quotable line with " +
    "attribution, and the source URL. Only include case studies you can cite " +
    "a real source URL for."
  );
}

export async function POST(req: NextRequest) {
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
}
