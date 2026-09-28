import { NextRequest, NextResponse } from "next/server";
import { resolveEmail, resolvePhone } from "@/lib/reveal-store";
import { isValidRevealWebhookToken } from "@/lib/webhook-auth";
import { createLogger, withRequestLog } from "@/lib/logger";

const log = createLogger("reveal-webhook");

type EmailResult = { personId: string; address?: string };
type PhoneResult = { personId: string; numbers?: string[] };

// Ocean posts here twice per reveal we requested in /api/contacts (see
// requestReveals() there) — once from the Reveal Emails webhook, once from
// Reveal Phones — each keyed by the personId we originally submitted.
export const POST = withRequestLog("reveal-webhook", async (req: NextRequest) => {
  if (!isValidRevealWebhookToken(req.nextUrl.searchParams.get("token"))) {
    log.warn("rejected: missing or invalid token");
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const emails: EmailResult[] = Array.isArray(body.emails) ? body.emails : [];
  const phones: PhoneResult[] = Array.isArray(body.phones) ? body.phones : [];
  log.info("received", {
    emails: emails.length,
    emailsWithAddress: emails.filter((e) => e?.address).length,
    phones: phones.length,
    phonesWithNumber: phones.filter((p) => p?.numbers?.length).length,
  });

  // Awaited so the Mongo writes finish before the response: on serverless the
  // function can be frozen right after responding, dropping pending writes.
  await Promise.all([
    ...emails.filter((e) => e?.personId).map((e) => resolveEmail(e.personId, e.address)),
    ...phones.filter((p) => p?.personId).map((p) => resolvePhone(p.personId, p.numbers?.[0])),
  ]);

  return NextResponse.json({ ok: true });
});
