export type RevealResult = {
  status: "pending" | "revealed" | "unavailable";
  email?: string;
  phone?: string;
};

// Module-level Map, so it only holds state within a single server process —
// fine for `next dev` or a single-instance deployment, but a multi-instance
// deployment needs a real store (Redis, a DB row) instead.
const store = new Map<string, RevealResult>();

export function setPending(id: string) {
  if (!store.has(id)) store.set(id, { status: "pending" });
}

export function resolveReveal(id: string, patch: { email?: string; phone?: string }) {
  const prev = store.get(id) ?? { status: "pending" as const };
  store.set(id, { ...prev, ...patch, status: "revealed" });
}

export function getReveal(id: string): RevealResult | undefined {
  return store.get(id);
}
