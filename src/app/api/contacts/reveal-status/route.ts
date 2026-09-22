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
  return NextResponse.json({ results });
}
