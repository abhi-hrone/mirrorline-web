import { createHmac, timingSafeEqual } from "node:crypto";

// Ocean's servers call /api/contacts/reveal-webhook without our session cookie,
// so the proxy lets that path through and the route itself checks this token
// instead. It's an HMAC of SECURITY_ACCESS_KEY (never the key itself, which
// would end up in Ocean's logs), so no extra env var is needed.
export function revealWebhookToken(): string | null {
  const secret = process.env.SECURITY_ACCESS_KEY;
  if (!secret) return null;
  return createHmac("sha256", secret).update("reveal-webhook").digest("hex");
}

export function isValidRevealWebhookToken(candidate: string | null): boolean {
  const expected = revealWebhookToken();
  if (!expected || !candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
