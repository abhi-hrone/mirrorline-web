// Runs providers in order, falling through to the next on any failure or if
// a provider isn't configured (pass `undefined`/`null` in its place). Used to
// chain providers (e.g. Apollo -> Ocean -> DiscoLike) for a single piece of data, since any
// one of them can be down, rate-limited, or simply not have an API key set.
// Like withFallback, but also reports which provider's result was used —
// needed when the caller has to treat providers differently afterwards (e.g.
// contacts/route.ts only trusts Ocean person IDs for Ocean's own reveal API).
export async function withFallbackTagged<T>(
  providers: Array<{ name: string; run: () => Promise<T> } | null | undefined | false>
): Promise<{ name: string; value: T }> {
  const usable = providers.filter(
    (p): p is { name: string; run: () => Promise<T> } => !!p
  );
  if (usable.length === 0) {
    throw new Error("No provider is configured.");
  }

  console.log(`[fallback] provider order: ${usable.map((p) => p.name).join(" -> ")}`);

  let lastErr: unknown;
  for (const [i, p] of usable.entries()) {
    const started = Date.now();
    console.log(`[fallback] trying ${p.name} (${i + 1}/${usable.length})`);
    try {
      const value = await p.run();
      console.log(`[fallback] ${p.name} succeeded in ${Date.now() - started}ms`);
      return { name: p.name, value };
    } catch (err) {
      const next = usable[i + 1];
      console.error(
        `[fallback] ${p.name} failed after ${Date.now() - started}ms${
          next ? `, falling back to ${next.name}` : ", no providers left"
        }:`,
        err instanceof Error ? err.message : err
      );
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("All providers failed.");
}

export async function withFallback<T>(
  providers: Array<{ name: string; run: () => Promise<T> } | null | undefined | false>
): Promise<T> {
  return (await withFallbackTagged(providers)).value;
}
