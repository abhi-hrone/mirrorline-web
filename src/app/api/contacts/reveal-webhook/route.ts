import { NextRequest, NextResponse } from "next/server";
import { resolveReveal } from "@/lib/reveal-store";

// Ocean posts here once an email/phone reveal we requested in
// /api/contacts finishes (see requestReveal() there). Exact payload field
// names aren't confirmed against live traffic yet — Ocean's docs site
// wouldn't render for us — so this reads a few plausible shapes rather than
// assuming one exact schema.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const id: string | undefined = body.personId ?? body.id ?? body.person?.id;
  if (!id) return NextResponse.json({ error: "Missing person id" }, { status: 400 });

  const email: string | undefined =
    body.email?.address ?? (typeof body.email === "string" ? body.email : undefined);
  const phone: string | undefined =
    body.phone?.number ?? (typeof body.phone === "string" ? body.phone : undefined);

  resolveReveal(id, { email, phone });
  return NextResponse.json({ ok: true });
}
