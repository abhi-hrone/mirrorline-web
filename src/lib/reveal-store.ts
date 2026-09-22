import { getCachedReveal, saveReveal } from "@/lib/research-cache";

export type RevealResult = {
  status: "pending" | "revealed" | "unavailable";
  email?: string;
  phone?: string;
};

type StoreEntry = RevealResult & { emailDone?: boolean; phoneDone?: boolean };

// Module-level Map so lookups within a request/poll cycle are instant. Mongo
// behind it is the durable copy: it survives a server restart and is what
// lets a re-searched contact skip Ocean's reveal call entirely (see
// getCachedReveal() used in /api/contacts).
const store = new Map<string, StoreEntry>();

export function setPending(id: string) {
  if (!store.has(id)) {
    const entry: StoreEntry = { status: "pending" };
    store.set(id, entry);
    saveReveal(id, entry).catch((err) => console.error("Reveal cache save failed", err));
  }
}

// Ocean sends emails and phones as two separate webhook calls that can land
// in either order, minutes apart — and if Ocean has no phone (or no email)
// for someone, that webhook just never fires for their id at all, so waiting
// for both before calling it "revealed" left plenty of contacts stuck at
// "pending" forever even though the other channel had already resolved.
// "revealed" now means at least one channel came back; pollReveals() in
// wizard-context.tsx keeps polling the still-missing channel independently
// until it arrives or its attempt budget runs out.
function markDone(id: string, doneKey: "emailDone" | "phoneDone", patch: { email?: string; phone?: string }) {
  const prev = store.get(id) ?? { status: "pending" as const };
  const next: StoreEntry = { ...prev, ...patch, [doneKey]: true };
  next.status = next.emailDone || next.phoneDone ? "revealed" : "pending";
  store.set(id, next);
  saveReveal(id, next).catch((err) => console.error("Reveal cache save failed", err));
}

export function resolveEmail(id: string, email?: string) {
  markDone(id, "emailDone", { email });
}

export function resolvePhone(id: string, phone?: string) {
  markDone(id, "phoneDone", { phone });
}

export async function getReveal(id: string): Promise<RevealResult | undefined> {
  const inMemory = store.get(id);
  if (inMemory) return inMemory;

  const cached = await getCachedReveal(id).catch((err) => {
    console.error("Reveal cache lookup failed", err);
    return null;
  });
  if (!cached) return undefined;
  store.set(id, cached);
  return cached;
}
