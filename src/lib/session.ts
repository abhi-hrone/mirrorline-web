import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "mirrorline_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export type SessionUser = {
  oid: string;
  name: string;
  email: string;
};

type SessionPayload = SessionUser & { exp: number };

// Derived from SECURITY_ACCESS_KEY (already required for the Ocean webhook,
// see lib/webhook-auth.ts) so signing sessions needs no extra env var. The
// different label keeps session signatures and webhook tokens unrelated.
function signingKey(): string | null {
  const secret = process.env.SECURITY_ACCESS_KEY;
  if (!secret) return null;
  return createHmac("sha256", secret).update("session").digest("hex");
}

function sign(data: string, key: string): string {
  return createHmac("sha256", key).update(data).digest("base64url");
}

export function createSessionToken(user: SessionUser): string | null {
  const key = signingKey();
  if (!key) return null;
  const payload: SessionPayload = { ...user, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, key)}`;
}

export function readSessionToken(token: string | undefined): SessionUser | null {
  const key = signingKey();
  if (!key || !token) return null;

  const [data, signature] = token.split(".");
  if (!data || !signature) return null;
  const a = Buffer.from(signature);
  const b = Buffer.from(sign(data, key));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    return { oid: payload.oid, name: payload.name, email: payload.email };
  } catch {
    return null;
  }
}
