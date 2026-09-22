import { NextRequest, NextResponse } from "next/server";
import { getReveal } from "@/lib/reveal-store";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids)
    ? body.ids.filter((id: unknown): id is string => typeof id === "string")
    : [];

  const results = Object.fromEntries(
    ids.map((id) => [id, getReveal(id) ?? { status: "pending" as const }])
  );
  return NextResponse.json({ results });
}
