// Runs providers in order, falling through to the next on any failure or if
// a provider isn't configured (pass `undefined`/`null` in its place). Used to
// chain Ocean -> Apollo -> DiscoLike for a single piece of data, since any
// one of them can be down, rate-limited, or simply not have an API key set.
export async function withFallback<T>(
  providers: Array<{ name: string; run: () => Promise<T> } | null | undefined | false>
): Promise<T> {
  const usable = providers.filter(
    (p): p is { name: string; run: () => Promise<T> } => !!p
  );
  if (usable.length === 0) {
    throw new Error("No provider is configured.");
  }

  let lastErr: unknown;
  for (const p of usable) {
    try {
      return await p.run();
    } catch (err) {
      console.error(`${p.name} failed`, err);
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("All providers failed.");
}
