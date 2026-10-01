import { NextRequest, NextResponse } from "next/server";
import { withRequestLog } from "@/lib/logger";
import { SESSION_COOKIE } from "@/lib/session";

// Only ends the Mirrorline session. The Microsoft session stays signed in, so
// the next sign-in shows the account picker rather than a password prompt.
export const POST = withRequestLog("auth", async (req: NextRequest) => {
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
});
