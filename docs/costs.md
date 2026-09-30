# Cost reference

What this app actually spends money on, and where. Three sources: Azure OpenAI (drafting sequences), Smartlead (sending them), and Apollo (company headcounts on the Lookalikes step). Ocean.io and the rest of Apollo's usage (lookalike search, contact search and reveal) aren't covered here yet — ask if you want them added too. Prices as published by each vendor as of **September 2026**; re-check before budgeting, since SaaS/API pricing changes without notice.

## 1. Sequence generation (Azure OpenAI)

[`/api/sequence`](../src/app/api/sequence/route.ts) calls Azure OpenAI once per click of **"Generate sequence"** or **"Regenerate sequence"** on the Sequence step. ("Rewrite this step" in the UI has no handler wired up yet — it doesn't currently call the API or cost anything.)

**Model:** `gpt-4o-mini` (from this app's `AZURE_OPENAI_MODEL` env var). Azure OpenAI pricing for gpt-4o-mini, standard pay-as-you-go deployment:

| | Price |
|---|---|
| Input tokens | $0.15 per 1M tokens |
| Output tokens | $0.60 per 1M tokens |

**What one call costs:** based on what this route actually sends —

| Component | Est. tokens | Why |
|---|---|---|
| System prompt | ~300 | Fixed instructions in [`SYSTEM_PROMPT`](../src/app/api/sequence/route.ts) |
| Structured-output schema | ~400–600 | The Zod `SequenceSchema` sent as a JSON schema (field names + descriptions) so the model returns valid structured JSON |
| User prompt | ~400–500 | Case study answers + targeting text — scales with how much text is filled into the case study fields |
| **Input total** | **~1,200–1,400** | |
| Output (4 steps, the default) | ~1,000–1,100 | Each step: subject, hook, ≤120-word content, CTA, sources |
| Output (6 steps, the max) | ~1,500–1,700 | |

At those volumes: **~$0.0008–0.001 per generation** (4 steps) and **~$0.001–0.0012** at the 6-step max — a fraction of a cent either way. Hitting "Regenerate" ten times in a row while iterating on copy costs roughly a cent total. This is an estimate from the prompt's actual structure, not a metered figure — check the Azure OpenAI resource's usage/cost blade in the Azure portal for real numbers, since exact tokenization depends on the live case-study text.

**Practical takeaway:** sequence drafting cost is negligible next to Smartlead's per-contact/per-send costs below — not worth optimizing unless generation volume grows by orders of magnitude (e.g. an automated bulk-regeneration workflow).

## 2. Sending (Smartlead)

### Scope: what Smartlead does (and doesn't) do here

Smartlead is wired into the **sending step** ([`/api/smartlead/launch`](../src/app/api/smartlead/launch/route.ts), fired from the review page's "Approve & push to Smartlead" button). It creates a Smartlead campaign from the approved sequence + revealed contacts, and — if a mailbox is already connected in your Smartlead account — assigns it, sets a schedule, and starts sending automatically.

Ocean.io still does company lookalike search (`/api/lookalikes`) and people search + email/phone reveal (`/api/contacts`) — Smartlead's API has no equivalent to either (confirmed against its live docs, Sept 2026; its "SmartProspect" lead database is dashboard-only, not exposed via API). See [SmartProspect](#smartprospect-not-integrated) below.

### The three things that cost money

| Term | What it means | What consumes it |
|---|---|---|
| **Contact / active lead** | A unique email address stored in your Smartlead account, counted against your plan's contact cap | Every person `/api/smartlead/launch` adds via `POST /campaigns/{id}/leads` |
| **Email send** | One individual email delivered, across any campaign | Every step × every contact that actually gets sent |
| **Verification credit** | 1 credit = 1 email verified for deliverability | Only spent if you verify contacts inside Smartlead; this app's contacts already come pre-verified from Ocean.io's reveal, so this shouldn't be needed in the normal flow |

Creating a campaign (`/campaigns/create`), saving a sequence (`/campaigns/{id}/sequences`), assigning senders, and setting a schedule are all free API calls — no credits either way.

### Plan tiers

| Plan | Monthly | Annual (~17% off) | Contacts | Emails / month | Free verified emails included |
|---|---|---|---|---|---|
| Base | $39 | ~$32.50/mo ($390/yr) | 2,000 | 6,000 | 2,000 |
| Pro | $94 | ~$78.30/mo ($939.60/yr) | 30,000 | 90,000 | 30,000 |
| Unlimited Smart | $174 | ~$144.50/mo ($1,734/yr) | Unlimited | 150,000 | 50,000 |
| Unlimited Prime | $379 | ~$314.60/mo ($3,775.20/yr) | Unlimited | 500,000 | 170,000 |

All tiers include unlimited mailboxes/warmup and CRM integration. **API access (what this integration needs) requires Pro or higher** — Base does not include API access.

**Overage behavior:** Smartlead doesn't bill overage. Once you hit the monthly send cap, sending pauses until you upgrade or the billing cycle resets — no surprise charges, but a live campaign can stall mid-sequence if nobody's watching usage.

### Cost of what this integration actually does, per campaign

Worked example using this app's own numbers (8 lookalike companies, ~5 contacts each, a 4-step sequence — roughly what a single "New campaign" wizard run produces):

| Step | Smartlead call | Leads consumed | Sends consumed |
|---|---|---|---|
| Create campaign | `POST /campaigns/create` | 0 | 0 |
| Save 4-step sequence | `POST /campaigns/{id}/sequences` | 0 | 0 |
| Add ~40 revealed contacts | `POST /campaigns/{id}/leads` | ~40 contacts against the plan cap | 0 (not sent yet) |
| Assign sender + schedule + start | `POST /campaigns/{id}/email-accounts`, `/schedule`, `/status` | 0 | up to 40 contacts × 4 steps = **160 sends**, fewer if people reply/unsubscribe and stop the sequence early |

So **one campaign this size costs roughly 40 contacts of your storage cap and up to ~160 sends of your monthly send cap** — no direct per-action dollar cost beyond whatever plan tier you're already paying for, as long as you're within its limits.

At the "Veldhoven × freight brokers, EU" campaign's real scale in the mock data (41 targets), that's ~41 contacts and up to ~164 sends for a 4-step sequence — comfortably inside even the Base tier's 6,000/month send cap, though Base lacks API access, so **Pro ($94/mo, or $78.30/mo annual) is the practical floor** for this integration. A team running several campaigns like this per month (the workspace mock shows 6 live campaigns) would land in the low thousands of contacts and tens of thousands of sends/month — still comfortably inside Pro; move to Unlimited Smart once total stored contacts (across all campaigns, since the cap is account-wide, not per-campaign) approach 30,000.

### Add-ons (only relevant if you outgrow what's bundled)

| Add-on | Cost | When you'd need it |
|---|---|---|
| Extra email verification credits | From $32/month (one-time or recurring) | Verifying more contacts/month than your plan's bundled free-verified-emails allotment |
| SmartSenders — buy mailboxes from Smartlead | Google/Outlook: $13/domain/yr + $4.50/mailbox/mo. SMTP: $19/domain/yr + $3.99/mailbox/mo. Pre-warmed: $18/domain/yr + $9/mailbox/mo | Only if you don't bring your own mailboxes — mailboxes you already own and connect are free to use |
| SmartDelivery (deliverability testing/optimization) | $49–$599/month | Diagnosing inbox-placement problems at scale |
| SmartServers (dedicated sending IP) | $39/server/month | High-volume senders needing IP reputation isolation |
| Whitelabel workspace | $29/month per client workspace | Agency use, reselling under your own brand |

### SmartProspect (not integrated)

Smartlead's own lead-finder ("SmartProspect", Engage → Prospect Finder in the dashboard) gives access to a 300M+ contact database — the same category of thing Ocean.io does. Noted here for completeness since it was considered during scoping:

- **$59/month** flat maintenance fee once you go past the trial, no per-lead charge on top — 2,000 free credits to trial it first.
- **1 credit = 1 verified contact revealed.** Your Smartlead plan tier sets the monthly credit allowance (matches the plan's contact cap — e.g. Pro's 30,000).
- **Dashboard-only.** As of September 2026 there is no documented `/prospects` or `/smartprospect` REST endpoint — it can't be called from this app's API routes the way `/api/lookalikes` and `/api/contacts` call Ocean.io. If SmartProspect ships an API later, it'd be the natural replacement for Ocean.io; until then those two routes stay as they are.

## 3. Company headcount (Apollo)

### Why this costs anything

The Lookalikes step shows each company's headcount and lets you filter by it. [`/api/lookalikes`](../src/app/api/lookalikes/route.ts) tries Ocean first, then Apollo, then DiscoLike. Ocean returns a size band with each company; **Apollo's company search does not return an employee count at all** (`estimated_num_employees` is always empty in its search results). So whenever a company comes back without a headcount, the route looks it up with Apollo's [Bulk Organization Enrichment](https://docs.apollo.io/reference/bulk-organization-enrichment) endpoint (`apolloBulkEnrichHeadcounts` in [`lib/apollo.ts`](../src/lib/apollo.ts)).

| | |
|---|---|
| **Price** | **1 Apollo credit per company** looked up (Apollo's API docs) |
| **Batching** | Up to 10 companies per request — batching cuts the number of calls, not the number of credits |
| **Who gets looked up** | Only companies returned **without** a headcount. Ocean results normally already have one, so a search Ocean answers costs ~0 credits here |

### Per search

| Scenario | Credits |
|---|---|
| Ocean answers the search | ~0 (only any Ocean companies missing a size) |
| Apollo answers the search (Ocean failed/unavailable) — the common case as of September 2026 | **~1 per company returned, up to 100** (the search is capped at 100 companies) |
| Re-opening a seed already searched | **0** — results, including headcounts, are cached in Mongo per seed domain. Each company is marked once it's been looked up, so companies Apollo has no headcount for aren't re-billed on every visit |
| Clicking **"Find lookalikes"** again for the same seed | 0 — the cache answers it, same as above |

### One-time backfill of searches cached before this change

Seeds searched before headcount lookups existed get enriched **once**, the first time each seed is opened again. As of 29 September 2026 the cache held 5 such seeds (hrone.cloud, obeetee.in, uber.com, adidas.com, manavrachna.edu.in), all answered by Apollo with no headcounts — **~479 credits in total** if every one of them is reopened.

### What a credit costs you

Apollo doesn't publish per-credit prices on its pricing page — credits come bundled with each seat's plan, and top-up prices are shown in the Apollo billing screen once you're a customer. Check **Settings → Plans & billing** in Apollo for your plan's monthly credit allowance and the top-up price. Credits are shared with everything else this app does on Apollo (contact reveals on the Contacts step spend credits too), so heavy lookalike use competes with reveals for the same allowance.

**Practical takeaway:** at ~100 credits per brand-new seed on Apollo, this is the most credit-hungry thing on the Lookalikes step. Getting Ocean working again as the primary lookalike provider would bring it close to zero, since Ocean already returns size bands.

## Sources

- [Azure OpenAI Service pricing](https://azure.microsoft.com/en-us/pricing/details/azure-openai/)
- [Apollo — Bulk Organization Enrichment API](https://docs.apollo.io/reference/bulk-organization-enrichment)
- [Apollo — Organization Enrichment API](https://docs.apollo.io/reference/organization-enrichment)
- [Smartlead pricing](https://www.smartlead.ai/pricing)
- [Smartlead pricing plans — help center](https://helpcenter.smartlead.ai/en/articles/439-smartlead-pricing-plans)
- [Full API documentation — help center](https://helpcenter.smartlead.ai/en/articles/125-full-api-documentation)
- [Getting started with SmartProspect — help center](https://helpcenter.smartlead.ai/en/articles/420-getting-started-with-smartprospect)
- [SmartProspect — free B2B leads](https://www.smartlead.ai/b2b-lead-finder)
