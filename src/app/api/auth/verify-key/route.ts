import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/proxy";

export async function POST(req: NextRequest) {
  const secret = process.env.SECURITY_ACCESS_KEY;
  if (!secret) {
    return NextResponse.json(
      { error: "SECURITY_ACCESS_KEY is not set on the server." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const key = typeof body.key === "string" ? body.key : "";
  const valid = key === secret;

  const res = NextResponse.json({ valid });
  if (valid) {
    // The proxy checks this cookie's value against SECURITY_ACCESS_KEY on
    // every request, so direct navigation to any protected route without it
    // gets redirected back to "/" instead of only being gated by the button.
    res.cookies.set(SESSION_COOKIE, secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }
  return res;
}
