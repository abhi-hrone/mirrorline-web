import { NextRequest, NextResponse } from "next/server";
import { withRequestLog } from "@/lib/logger";
import { lookupDirector } from "@/lib/directors";

export const maxDuration = 60;

// Finds the other companies a director of an HROne customer sits on (see
// lib/directors.ts).
export const POST = withRequestLog("directors", async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = str(body.name);
  const customerDomain = str(body.customerDomain);
  const linkedin = str(body.linkedin);

  if (!name || !/\.[a-z]{2,}/i.test(customerDomain)) {
    return NextResponse.json(
      { error: "Enter the director's name and the website of the HROne customer they're a director of." },
      { status: 400 }
    );
  }

  try {
    const match = await lookupDirector({ name, customerDomain, linkedin });
    return NextResponse.json({ match });
  } catch (err) {
    console.error("Director lookup failed", err);
    const message = err instanceof Error && err.message.includes("not set") ? err.message : null;
    return NextResponse.json(
      { error: message ?? "Lookup failed. Check server logs." },
      { status: message ? 500 : 502 }
    );
  }
});
