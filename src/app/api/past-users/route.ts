import { NextRequest, NextResponse } from "next/server";
import { withRequestLog } from "@/lib/logger";
import { isPersonalEmail, lookupPastUser } from "@/lib/past-users";

export const maxDuration = 60;

// Finds where one past HROne user works now (see lib/past-users.ts).
export const POST = withRequestLog("past-users", async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = str(body.name);
  const email = str(body.email);
  const oldCompanyName = str(body.oldCompanyName);
  const oldCompanyDomain = str(body.oldCompanyDomain);
  const oldTitle = str(body.oldTitle);

  // The email is optional: name + the old company's website finds them too.
  if (!name || (!email && !/\.[a-z]{2,}/i.test(oldCompanyDomain))) {
    return NextResponse.json(
      { error: "Enter the past user's name, and their old company's website or the email they used there." },
      { status: 400 }
    );
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
  }
  if (email && isPersonalEmail(email) && !oldCompanyDomain) {
    return NextResponse.json(
      {
        error:
          "That's a personal email, so it doesn't tell us their old company. Add the old company's website.",
      },
      { status: 400 }
    );
  }

  try {
    const match = await lookupPastUser({ name, email, oldCompanyName, oldCompanyDomain, oldTitle });
    return NextResponse.json({ match });
  } catch (err) {
    console.error("Past user lookup failed", err);
    const message = err instanceof Error && err.message.includes("not set") ? err.message : null;
    return NextResponse.json(
      { error: message ?? "Lookup failed. Check server logs." },
      { status: message ? 500 : 502 }
    );
  }
});
