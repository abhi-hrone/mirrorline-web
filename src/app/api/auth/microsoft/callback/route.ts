import { NextRequest, NextResponse } from "next/server";
import { createLogger, withRequestLog } from "@/lib/logger";
import { OAUTH_COOKIE, SCOPES, authorityUrl, microsoftConfig, redirectUri } from "@/lib/microsoft-auth";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken } from "@/lib/session";

const log = createLogger("auth");

type IdTokenClaims = {
  aud?: string;
  iss?: string;
  tid?: string;
  oid?: string;
  nonce?: string;
  exp?: number;
  name?: string;
  email?: string;
  preferred_username?: string;
};

function fail(req: NextRequest, error: string) {
  const res = NextResponse.redirect(new URL(`/?error=${error}`, req.url));
  res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth/microsoft" });
  return res;
}

// Microsoft redirects here with a one-time code. We exchange it (with our
// client secret and the PKCE verifier) for an ID token, check it was issued
// for this app by this tenant for this sign-in, then set the session cookie.
export const GET = withRequestLog("auth", async (req: NextRequest) => {
  const params = req.nextUrl.searchParams;
  if (params.get("error")) {
    log.warn("Microsoft returned an error", {
      error: params.get("error") ?? undefined,
      description: params.get("error_description") ?? undefined,
    });
    return fail(req, "denied");
  }

  let saved: { state?: string; nonce?: string; verifier?: string } = {};
  try {
    saved = JSON.parse(req.cookies.get(OAUTH_COOKIE)?.value ?? "{}");
  } catch {}
  const code = params.get("code");
  if (!code || !saved.state || !saved.verifier || params.get("state") !== saved.state) {
    log.warn("Sign-in callback had a missing code or mismatched state");
    return fail(req, "state");
  }

  const result = microsoftConfig();
  if ("missing" in result) {
    log.error(`Microsoft sign-in is not configured: ${result.missing.join(", ")} not set`);
    return fail(req, "not_configured");
  }
  const { tenantId, clientId, clientSecret } = result.config;

  const tokenRes = await fetch(`${authorityUrl(tenantId)}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(req),
      code_verifier: saved.verifier,
      scope: SCOPES,
    }),
  });
  const tokens = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || typeof tokens.id_token !== "string") {
    log.error("Token exchange with Microsoft failed", undefined, {
      status: tokenRes.status,
      error: tokens.error,
      description: tokens.error_description,
    });
    return fail(req, "token");
  }

  // The ID token came straight from Microsoft's token endpoint over TLS in
  // exchange for our client secret, so its signature doesn't need checking
  // against Entra's published keys (OpenID Connect Core §3.1.3.7). The claims
  // below still have to match this app, this tenant and this sign-in.
  let claims: IdTokenClaims;
  try {
    claims = JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64url").toString());
  } catch {
    log.error("Could not decode the ID token");
    return fail(req, "token");
  }

  const tenantOk = claims.tid === tenantId || claims.iss === `https://login.microsoftonline.com/${tenantId}/v2.0`;
  if (
    claims.aud !== clientId ||
    !tenantOk ||
    claims.nonce !== saved.nonce ||
    !claims.oid ||
    (claims.exp ?? 0) < Date.now() / 1000
  ) {
    log.warn("ID token failed validation", { aud: claims.aud, tid: claims.tid });
    return fail(req, "tenant");
  }

  const email = claims.email ?? claims.preferred_username ?? "";
  const session = createSessionToken({ oid: claims.oid, name: claims.name ?? email, email });
  if (!session) {
    log.error("Cannot sign sessions: SECURITY_ACCESS_KEY is not set");
    return fail(req, "not_configured");
  }

  log.info("Signed in", { email });
  const res = NextResponse.redirect(new URL("/campaigns", req.url));
  res.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth/microsoft" });
  res.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
});
