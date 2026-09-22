import { NextRequest, NextResponse } from "next/server";
import { resolveReveal } from "@/lib/reveal-store";

type EmailResult = { personId: string; address?: string };
type PhoneResult = { personId: string; numbers?: string[] };

// Ocean posts here twice per reveal we requested in /api/contacts (see
// requestReveals() there) — once from the Reveal Emails webhook, once from
// Reveal Phones — each keyed by the personId we originally submitted.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const emails: EmailResult[] = Array.isArray(body.emails) ? body.emails : [];
  const phones: PhoneResult[] = Array.isArray(body.phones) ? body.phones : [];

  for (const e of emails) {
    if (e?.personId) resolveReveal(e.personId, { email: e.address });
  }
  for (const p of phones) {
    if (p?.personId) resolveReveal(p.personId, { phone: p.numbers?.[0] });
  }

  return NextResponse.json({ ok: true });
}
