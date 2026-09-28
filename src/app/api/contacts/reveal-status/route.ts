import { NextRequest, NextResponse } from "next/server";
import { getReveal } from "@/lib/reveal-store";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids)
    ? body.ids.filter((id: unknown): id is string => typeof id === "string")
    : [];

  const entries = await Promise.all(
    ids.map(async (id) => [id, (await getReveal(id)) ?? { status: "pending" as const }] as const)
  );
  const results = Object.fromEntries(entries);
  const values = entries.map(([, r]) => r);
  console.log(
    `[reveal-status] ${ids.length} ids: ` +
      `${values.filter((r) => r.status === "revealed").length} revealed, ` +
      `${values.filter((r) => r.email).length} with email, ` +
      `${values.filter((r) => r.phone).length} with phone, ` +
      `${values.filter((r) => r.status === "pending").length} still pending`
  );
  return NextResponse.json({ results });
}
