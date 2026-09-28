import { getCachedReveal, saveReveal, saveRevealChannel } from "@/lib/research-cache";

export type RevealResult = {
  status: "pending" | "revealed" | "unavailable";
  email?: string;
  phone?: string;
};

type StoreEntry = RevealResult & { emailDone?: boolean; phoneDone?: boolean };

// Module-level Map so repeated lookups within one warm instance are instant.
// Mongo behind it is the source of truth: on serverless (Vercel) the request
// that queues a reveal, Ocean's webhook callbacks and the browser's status
// polls can each land on a different instance, so an instance's Map may be
// missing — or stale versus — what another instance already wrote.
const store = new Map<string, StoreEntry>();

export async function setPending(id: string) {
  if (store.has(id)) return;
  const entry: StoreEntry = { status: "pending" };
  store.set(id, entry);
  await saveReveal(id, entry).catch((err) => console.error("Reveal cache save failed", err));
}

// Ocean sends emails and phones as two separate webhook calls that can land
// in either order, minutes apart — and if Ocean has no phone (or no email)
// for someone, that webhook just never fires for their id at all, so waiting
// for both before calling it "revealed" left plenty of contacts stuck at
// "pending" forever even though the other channel had already resolved.
// "revealed" now means at least one channel came back; pollReveals() in
// wizard-context.tsx keeps polling the still-missing channel independently
// until it arrives or its attempt budget runs out.
export async function resolveEmail(id: string, email?: string) {
  await saveRevealChannel(id, "email", email);
  store.delete(id);
}

export async function resolvePhone(id: string, phone?: string) {
  await saveRevealChannel(id, "phone", phone);
  store.delete(id);
}

export async function getReveal(id: string): Promise<RevealResult | undefined> {
  const inMemory = store.get(id);
  // Only a fully resolved entry is safe to serve from this instance's Map;
  // anything partial may already have been completed by another instance.
  if (inMemory?.emailDone && inMemory?.phoneDone) return inMemory;

  const cached = await getCachedReveal(id).catch((err) => {
    console.error("Reveal cache lookup failed", err);
    return null;
  });
  if (cached) {
    store.set(id, cached);
    return cached;
  }
  return inMemory;
}
