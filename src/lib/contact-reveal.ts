import { setPending } from "@/lib/reveal-store";
import { getCachedReveals, saveReveal } from "@/lib/research-cache";
import { apolloRevealEmail } from "@/lib/apollo";
import { discolikeRevealEmail } from "@/lib/discolike";
import { revealWebhookToken } from "@/lib/webhook-auth";
import { createLogger } from "@/lib/logger";

const OCEAN_REVEAL_EMAILS_URL = "https://api.ocean.io/v2/reveal/emails";
const OCEAN_REVEAL_PHONES_URL = "https://api.ocean.io/v2/reveal/phones";

const logger = createLogger("contact-reveal");
const log = (msg: string) => logger.info(msg);

export type ContactConfidence = "Verified" | "Risky" | "Guessed" | "No email" | "Not revealed";

// A contact being revealed. Fields are filled in place by revealContacts().
export type RevealPerson = {
  id: string;
  name: string;
  linkedin: string;
  email: string;
  phone: string;
  conf: ContactConfidence;
  revealStatus: "pending" | "unavailable";
};

export type RevealTarget = {
  person: RevealPerson;
  domain: string;
  // Which provider's search produced person.id ("Apollo", "Ocean", ...). IDs
  // are only meaningful to the provider that issued them.
  source: string;
};

// Kicks off an async email/phone reveal for a batch of people via Ocean's
// Reveal Emails/Phones APIs. Ocean delivers results later as webhook POSTs to
// our own /api/contacts/reveal-webhook route, so this only works once
// APP_BASE_URL points somewhere Ocean's servers can reach (not localhost).
// Returns whether at least one of the two reveal requests was accepted.
async function requestOceanReveals(token: string, personIds: string[]): Promise<boolean> {
  const base = process.env.APP_BASE_URL;
  if (!base) {
    log("Ocean reveal skipped: APP_BASE_URL is not set, so Ocean has no webhook to call back");
    return false;
  }
  if (personIds.length === 0) return false;

  const webhookToken = revealWebhookToken();
  if (!webhookToken) {
    log("Ocean reveal skipped: SECURITY_ACCESS_KEY is not set, so the webhook can't be authenticated");
    return false;
  }
  const webhookUrl = `${base.replace(/\/$/, "")}/api/contacts/reveal-webhook?token=${webhookToken}`;
  const headers = { "Content-Type": "application/json", "x-api-token": token };
  const body = JSON.stringify({ personIds, webhookUrl });

  try {
    const [emailRes, phoneRes] = await Promise.all([
      fetch(OCEAN_REVEAL_EMAILS_URL, { method: "POST", headers, body }),
      fetch(OCEAN_REVEAL_PHONES_URL, { method: "POST", headers, body }),
    ]);
    if (!emailRes.ok) {
      logger.error("Ocean reveal emails request failed", await emailRes.text(), { status: emailRes.status });
    }
    if (!phoneRes.ok) {
      logger.error("Ocean reveal phones request failed", await phoneRes.text(), { status: phoneRes.status });
    }
    log(
      `Ocean reveal request for ${personIds.length} people: emails=${emailRes.status}, phones=${phoneRes.status} -> webhook ${base.replace(/\/$/, "")}/api/contacts/reveal-webhook`
    );
    return emailRes.ok || phoneRes.ok;
  } catch (err) {
    logger.error("Ocean reveal request failed", err);
    return false;
  }
}

// Reveals emails (and, via Ocean, phones) for exactly the given people —
// nothing else is looked up or paid for. Waterfall: Apollo, then Ocean, then
// DiscoLike. Mutates each target's person in place.
export async function revealContacts(targets: RevealTarget[]): Promise<void> {
  const oceanToken = process.env.OCEAN_API_TOKEN;
  const apolloKey = process.env.APOLLO_API_KEY;
  const discolikeKey = process.env.DISCOLIKE_API_KEY;

  const cachedReveals = await getCachedReveals(targets.map((t) => t.person.id)).catch((err) => {
    logger.error("Reveal cache lookup failed", err);
    return new Map<string, { status: string; email?: string; phone?: string }>();
  });

  // A cached "revealed" contact already has its final email/phone from a
  // prior run — reuse it instead of spending another reveal credit.
  // Anything not fully revealed yet (or never requested) gets a fresh ask.
  const toRequest = targets.filter(({ person: p }) => {
    const cached = cachedReveals.get(p.id);
    if (!cached || cached.status !== "revealed") return true;
    p.email = cached.email ?? "";
    p.phone = cached.phone ?? "";
    p.conf = cached.email ? "Verified" : p.conf;
    p.revealStatus = "unavailable";
    return false;
  });
  log(
    `reveal: ${targets.length} requested, ${targets.length - toRequest.length} reused from cache, ${toRequest.length} need a fresh reveal`
  );

  const markRevealed = async (p: RevealPerson, email: string) => {
    p.email = email;
    p.conf = "Verified";
    await saveReveal(p.id, {
      status: "revealed",
      email,
      emailDone: true,
      phoneDone: false,
    }).catch((err) => logger.error("Reveal cache save failed", err, { personId: p.id }));
  };

  // Step 1 — Apollo: synchronous per-person email match. For people Apollo
  // itself found we match by Apollo id (their search results only carry a first
  // name, so name + domain can't match); for people from another provider we
  // fall back to name + domain (+ LinkedIn) matching.
  // Apollo can reveal phones too, but only via its own async webhook, which
  // isn't wired up here, so phone stays unrevealed on this path.
  if (!apolloKey && toRequest.length > 0) log("reveal step 1/3 Apollo: skipped (APOLLO_API_KEY not set)");
  else if (toRequest.length > 0) log(`reveal step 1/3 Apollo: matching ${toRequest.length} people`);
  await Promise.all(
    toRequest.map(async ({ person: p, domain, source }) => {
      p.revealStatus = "unavailable";
      if (!apolloKey) return;
      const [firstName, ...rest] = p.name.trim().split(/\s+/);
      const viaId = source === "Apollo";
      try {
        const match = await apolloRevealEmail(apolloKey, {
          id: viaId ? p.id : undefined,
          first_name: firstName,
          last_name: rest.join(" "),
          domain,
          linkedin_url: p.linkedin || undefined,
        });
        // The match carries the full name and LinkedIn URL that the search
        // withheld, so the contact list shows more than a first name.
        if (match.name) p.name = match.name;
        if (match.linkedin_url && !p.linkedin) p.linkedin = match.linkedin_url;
        const { email } = match;
        if (email) await markRevealed(p, email);
        logger.info(`  Apollo ${email ? "revealed email for" : "found no email for"} ${p.name} @ ${domain}`, {
          viaId,
          matched: match.matched,
          emailStatus: match.emailStatus,
        });
      } catch (err) {
        logger.error(`  Apollo reveal failed for ${p.name} @ ${domain}`, err);
      }
    })
  );

  // Step 2 — Ocean fallback for anyone Apollo couldn't reveal. Ocean's reveal
  // APIs only recognize person IDs that Ocean itself issued: sending Apollo/
  // DiscoLike IDs makes Ocean "accept" the request (it queues the lookup
  // regardless) while the webhook never delivers real data, silently starving
  // those contacts forever. So only Ocean-sourced people go here. Ocean
  // replies asynchronously via the reveal webhook, and also fills in phones.
  const oceanTargets = oceanToken
    ? toRequest.filter((t) => t.source === "Ocean" && !t.person.email)
    : [];
  if (toRequest.length > 0) {
    const unrevealed = toRequest.filter((t) => !t.person.email);
    log(
      !oceanToken
        ? `reveal step 2/3 Ocean: skipped (OCEAN_API_TOKEN not set), ${unrevealed.length} still without email`
        : `reveal step 2/3 Ocean: ${unrevealed.length} still without email after Apollo, ` +
            `${oceanTargets.length} of them Ocean-sourced (eligible), ` +
            `${unrevealed.length - oceanTargets.length} not eligible (ids from another provider)`
    );
  }
  const accepted =
    oceanToken && oceanTargets.length > 0
      ? await requestOceanReveals(
          oceanToken,
          oceanTargets.map((t) => t.person.id)
        )
      : false;

  if (accepted) {
    await Promise.all(oceanTargets.map(({ person: p }) => setPending(p.id)));
    oceanTargets.forEach(({ person: p }) => {
      p.revealStatus = "pending";
    });
    log(`  Ocean accepted reveal for ${oceanTargets.length} people; results arrive via webhook`);
  } else if (oceanTargets.length > 0) {
    log(`  Ocean reveal NOT accepted for ${oceanTargets.length} people; they fall through to DiscoLike`);
  }

  // Step 3 — DiscoLike, last resort, for anyone still without an email and not
  // waiting on an Ocean webhook.
  const discolikeTargets = toRequest.filter(
    ({ person: p }) => !p.email && p.revealStatus !== "pending"
  );
  if (discolikeTargets.length > 0) {
    log(
      discolikeKey
        ? `reveal step 3/3 DiscoLike: trying ${discolikeTargets.length} people`
        : `reveal step 3/3 DiscoLike: skipped (DISCOLIKE_API_KEY not set), ${discolikeTargets.length} stay without email`
    );
  }
  if (discolikeKey) {
    await Promise.all(
      discolikeTargets.map(async ({ person: p, domain }) => {
        try {
          const { email } = await discolikeRevealEmail(discolikeKey, { name: p.name, domain });
          if (email) await markRevealed(p, email);
          log(`  DiscoLike ${email ? "revealed email for" : "found no email for"} ${p.name} @ ${domain}`);
        } catch (err) {
          logger.error(`  DiscoLike reveal failed for ${p.name} @ ${domain}`, err);
        }
      })
    );
  }

  // Anyone still empty-handed and not waiting on Ocean's webhook is a miss.
  for (const { person: p } of targets) {
    if (!p.email && p.revealStatus !== "pending") p.conf = "No email";
  }

  log(
    `reveal done: ${targets.length} people | ` +
      `emails=${targets.filter((t) => t.person.email).length}, ` +
      `pending Ocean webhook=${targets.filter((t) => t.person.revealStatus === "pending").length}, ` +
      `no email=${targets.filter((t) => !t.person.email && t.person.revealStatus !== "pending").length}`
  );
}
