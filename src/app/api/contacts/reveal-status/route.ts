import { NextRequest, NextResponse } from "next/server";
import { getReveal } from "@/lib/reveal-store";
import { createLogger, withRequestLog } from "@/lib/logger";

const log = createLogger("reveal-status");

export const POST = withRequestLog("reveal-status", async (req: NextRequest) => {
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids)
    ? body.ids.filter((id: unknown): id is string => typeof id === "string")
    : [];

  const entries = await Promise.all(
    ids.map(async (id) => [id, (await getReveal(id)) ?? { status: "pending" as const }] as const)
  );
  const results = Object.fromEntries(entries);
  const values = entries.map(([, r]) => r);
  log.info("poll", {
    ids: ids.length,
    revealed: values.filter((r) => r.status === "revealed").length,
    withEmail: values.filter((r) => r.email).length,
    withPhone: values.filter((r) => r.phone).length,
    pending: values.filter((r) => r.status === "pending").length,
  });
  return NextResponse.json({ results });
});
