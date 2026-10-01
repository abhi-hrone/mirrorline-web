import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createLogger, withRequestLog } from "@/lib/logger";
import { OAUTH_COOKIE, SCOPES, authorityUrl, microsoftConfig, redirectUri } from "@/lib/microsoft-auth";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken } from "@/lib/session";

const log = createLogger("auth");

// Starts the Entra sign-in: remembers a fresh state/nonce/PKCE verifier in a
// short-lived cookie, then sends the browser to Microsoft's authorize page.
export const GET = withRequestLog("auth", async (req: NextRequest) => {
  // Local testing without an Entra app registration: AUTH_MOCK=true skips
  // Microsoft and signs straight in as a dummy user. Never honoured in a
  // production build, so a stray env var can't open up a deployed app.
  if (process.env.AUTH_MOCK === "true" && process.env.NODE_ENV !== "production") {
    const session = createSessionToken({
      oid: "mock-user",
      name: process.env.AUTH_MOCK_NAME || "Test User",
      email: process.env.AUTH_MOCK_EMAIL || "test.user@hrone.cloud",
    });
    if (!session) {
      log.error("Cannot sign sessions: SECURITY_ACCESS_KEY is not set");
      return NextResponse.redirect(new URL("/?error=not_configured", req.url));
    }
    log.warn("Signed in as mock user (AUTH_MOCK=true)");
    const res = NextResponse.redirect(new URL("/campaigns", req.url));
    res.cookies.set(SESSION_COOKIE, session, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  }

  const result = microsoftConfig();
  if ("missing" in result) {
    log.error(`Microsoft sign-in is not configured: ${result.missing.join(", ")} not set`);
    return NextResponse.redirect(new URL("/?error=not_configured", req.url));
  }
  const { tenantId, clientId } = result.config;

  const state = randomBytes(16).toString("base64url");
  const nonce = randomBytes(16).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  const url = new URL(`${authorityUrl(tenantId)}/authorize`);
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri(req),
    response_mode: "query",
    scope: SCOPES,
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, nonce, verifier }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/microsoft",
    maxAge: 60 * 10,
  });
  return res;
});
