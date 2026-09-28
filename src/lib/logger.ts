import { AsyncLocalStorage } from "node:async_hooks";
import type { NextRequest } from "next/server";

// One log format for everything that shows up in Vercel's runtime logs:
//
//   [scope] message key=value key="value with spaces"
//
// Vercel colors lines by console method (log/warn/error) and its search box
// matches on plain text, so this stays greppable: `[contacts]`, `rid=ab12cd`,
// `level`-style filtering via the Vercel severity dropdown, or a key like
// `status=502`. Every line emitted while a request is being handled also
// carries that request's `rid` (ours) and `vercel` (x-vercel-id, the same ID
// shown in Vercel's request list), so one search finds the whole story of a
// single request even when several run in parallel.

type Fields = Record<string, unknown>;

const requestContext = new AsyncLocalStorage<Fields>();

function formatValue(v: unknown): string {
  if (v instanceof Error) return JSON.stringify(v.message);
  if (typeof v === "string") return /^[\w./:@+-]+$/.test(v) ? v : JSON.stringify(v);
  if (v !== null && typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function formatFields(fields: Fields): string {
  const parts = Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${formatValue(v)}`);
  return parts.length ? ` ${parts.join(" ")}` : "";
}

export function createLogger(scope: string) {
  const emit = (level: "log" | "warn" | "error", message: string, fields: Fields = {}) => {
    // Request fields first so they lead every line and are easy to scan.
    console[level](`[${scope}] ${message}${formatFields({ ...requestContext.getStore(), ...fields })}`);
  };
  return {
    info: (message: string, fields?: Fields) => emit("log", message, fields),
    warn: (message: string, fields?: Fields) => emit("warn", message, fields),
    // `err` is flattened to its message (plus cause) so it stays on one line.
    error: (message: string, err?: unknown, fields?: Fields) =>
      emit("error", message, {
        ...(err !== undefined && {
          error: err instanceof Error ? err.message : String(err),
          ...(err instanceof Error && err.cause ? { cause: String(err.cause) } : {}),
        }),
        ...fields,
      }),
  };
}

// Wraps a route handler so every call logs `start` and `done` (with status
// and duration), tags all logs under it with rid/vercel ids, and logs any
// uncaught exception before rethrowing so Next still returns its 500.
export function withRequestLog<C>(
  scope: string,
  handler: (req: NextRequest, ctx: C) => Promise<Response>
) {
  const log = createLogger(scope);
  return async (req: NextRequest, ctx: C): Promise<Response> => {
    const fields: Fields = {
      rid: Math.random().toString(36).slice(2, 8),
      vercel: req.headers.get("x-vercel-id") ?? undefined,
    };
    return requestContext.run(fields, async () => {
      const started = Date.now();
      log.info(`${req.method} ${req.nextUrl.pathname} start`);
      try {
        const res = await handler(req, ctx);
        const meta = { status: res.status, ms: Date.now() - started };
        if (res.status >= 500) log.error("done", undefined, meta);
        else if (res.status >= 400) log.warn("done", meta);
        else log.info("done", meta);
        return res;
      } catch (err) {
        log.error("unhandled exception", err, { ms: Date.now() - started });
        throw err;
      }
    });
  };
}
