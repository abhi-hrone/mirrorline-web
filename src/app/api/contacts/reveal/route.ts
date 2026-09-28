import { NextRequest, NextResponse } from "next/server";
import { withRequestLog, createLogger } from "@/lib/logger";
import { revealContacts, type RevealTarget } from "@/lib/contact-reveal";

export const maxDuration = 120;

// Step 2 of "find contacts": reveals emails only for the people the user
// ticked. /api/contacts (step 1) returns names and titles and spends nothing
// on reveals.
const MAX_PEOPLE = 100;

const log = createLogger("contacts-reveal");

export const POST = withRequestLog("contacts-reveal", async (req: NextRequest) => {
  if (!process.env.OCEAN_API_TOKEN && !process.env.APOLLO_API_KEY && !process.env.DISCOLIKE_API_KEY) {
    return NextResponse.json(
      {
        error:
          "None of OCEAN_API_TOKEN, APOLLO_API_KEY, or DISCOLIKE_API_KEY is set on the server.",
      },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const seen = new Set<string>();
  const targets: RevealTarget[] = [];
  for (const raw of Array.isArray(body.people) ? body.people : []) {
    const id = str(raw?.id);
    const domain = str(raw?.domain);
    if (!id || !domain || seen.has(id)) continue;
    seen.add(id);
    targets.push({
      domain,
      source: str(raw?.source),
      person: {
        id,
        name: str(raw?.name),
        linkedin: str(raw?.linkedin),
        email: "",
        phone: "",
        conf: "Not revealed",
        revealStatus: "unavailable",
      },
    });
  }

  if (targets.length === 0) {
    return NextResponse.json({ error: "Select at least one contact to reveal." }, { status: 400 });
  }
  if (targets.length > MAX_PEOPLE) {
    return NextResponse.json(
      { error: `Select at most ${MAX_PEOPLE} contacts at a time.` },
      { status: 400 }
    );
  }

  log.info(`revealing ${targets.length} selected contacts`);
  await revealContacts(targets);

  return NextResponse.json({
    results: Object.fromEntries(
      targets.map(({ person: p }) => [
        p.id,
        {
          name: p.name,
          linkedin: p.linkedin,
          email: p.email,
          phone: p.phone,
          conf: p.conf,
          revealStatus: p.revealStatus,
        },
      ])
    ),
  });
});
