import { NextRequest, NextResponse } from "next/server";
import { withRequestLog } from "@/lib/logger";

export const maxDuration = 60;

const SMARTLEAD_BASE_URL = "https://server.smartlead.ai/api/v1";

type StepIn = {
  day: string;
  subject: string;
  preheader: string;
  hook: string;
  content: string;
  cta: string;
  ps: string;
};
type PersonIn = { name: string; title: string; email: string; phone?: string };
type GroupIn = { company: string; domain: string; people: PersonIn[] };

function smartleadUrl(path: string, apiKey: string) {
  return `${SMARTLEAD_BASE_URL}${path}?api_key=${encodeURIComponent(apiKey)}`;
}

// Our sequence generator (see /api/sequence) writes {{firstName}}/{{company}};
// Smartlead's merge fields are snake_case ({{first_name}}/{{company_name}}) —
// translate so emails don't go out with literal, unresolved braces.
// {{title}} passes through unchanged since it resolves from the `title`
// custom field attached to each lead below.
function toSmartleadTokens(text: string) {
  return text
    .replace(/{{\s*firstName\s*}}/g, "{{first_name}}")
    .replace(/{{\s*company\s*}}/g, "{{company_name}}");
}

function toEmailBody(step: StepIn) {
  const paragraphs = [step.hook, step.content, step.cta, step.ps && `P.S. ${step.ps}`]
    .filter(Boolean)
    .map((p) => `<p>${toSmartleadTokens(p as string)}</p>`)
    .join("");
  // The generator deliberately keeps "hook" specific rather than a greeting
  // (see /api/sequence's system prompt), so every email reads as a template
  // with no salutation at all — prepend a plain "Hi {{first_name}}," here,
  // guaranteed regardless of what the model drafted.
  // The preheader rides as a hidden first line so inboxes show it as the
  // preview text instead of repeating the opening sentence.
  const preheader = step.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${toSmartleadTokens(step.preheader)}</div>`
    : "";
  return `${preheader}<p>Hi {{first_name}},</p>${paragraphs}`;
}

function parseDay(day: string) {
  const n = parseInt(day.replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

// Smartlead's days_of_the_week uses JS's Sun=0..Sat=6 numbering.
function currentIstWeekday(): number {
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const short = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", weekday: "short" });
  return map[short] ?? new Date().getDay();
}

// Base B2B window is Tue-Thu, but a campaign launched on another weekday
// (e.g. Friday) would otherwise sit idle with "Next Email In: N/A" until the
// following Tuesday — so fold today in if it's a business day.
function sendDaysForLaunch(): number[] {
  const base = [2, 3, 4];
  const today = currentIstWeekday();
  if (today >= 1 && today <= 5 && !base.includes(today)) {
    return [...base, today].sort((a, b) => a - b);
  }
  return base;
}

// The generator writes "Day 0 / 3 / 7 / 12" — days since the first email.
// Smartlead wants the gap since the previous step, so take the difference.
function toStepDelays(steps: StepIn[]) {
  const days = steps.map((s) => parseDay(s.day));
  return days.map((d, i) => (i === 0 ? 0 : Math.max(0, d - days[i - 1])));
}

export const POST = withRequestLog("smartlead", async (req: NextRequest) => {
  const apiKey = process.env.SMARTLEAD_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "SMARTLEAD_API_KEY is not set on the server." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const campaignName = typeof body.campaignName === "string" ? body.campaignName.trim() : "";
  const steps: StepIn[] = Array.isArray(body.steps) ? body.steps : [];
  const groups: GroupIn[] = Array.isArray(body.groups) ? body.groups : [];

  if (!campaignName) {
    console.error("Smartlead launch rejected: campaignName missing", { body });
    return NextResponse.json({ error: "campaignName is required." }, { status: 400 });
  }
  if (steps.length === 0) {
    console.error("Smartlead launch rejected: no sequence steps", { campaignName });
    return NextResponse.json(
      { error: "No sequence steps to send — draft the sequence first." },
      { status: 400 }
    );
  }

  const leadList = groups.flatMap((g) =>
    g.people
      .filter((p) => p.email)
      .map((p) => {
        const [firstName, ...rest] = p.name.trim().split(/\s+/);
        return {
          email: p.email,
          first_name: firstName ?? "",
          last_name: rest.join(" "),
          company_name: g.company,
          phone_number: p.phone || undefined,
          custom_fields: { title: p.title || "" },
        };
      })
  );

  if (leadList.length === 0) {
    console.error("Smartlead launch rejected: no contacts with an email", {
      campaignName,
      groupCount: groups.length,
      totalPeople: groups.reduce((n, g) => n + g.people.length, 0),
    });
    return NextResponse.json(
      {
        error:
          "No contacts with a revealed email yet — wait for reveals to finish, then try again.",
      },
      { status: 400 }
    );
  }

  try {
    // 1. Create the campaign. It starts in DRAFTED status.
    const createRes = await fetch(smartleadUrl("/campaigns/create", apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: campaignName }),
    });
    if (!createRes.ok) {
      console.error("Smartlead campaign create failed", createRes.status, await createRes.text());
      return NextResponse.json(
        { error: `Smartlead returned ${createRes.status} creating the campaign.` },
        { status: 502 }
      );
    }
    const created = (await createRes.json()) as { id?: number };
    const campaignId = created.id;
    if (!campaignId) {
      return NextResponse.json(
        { error: "Smartlead did not return a campaign id." },
        { status: 502 }
      );
    }

    // 2. Push the sequence steps.
    const delays = toStepDelays(steps);
    const sequences = steps.map((s, i) => ({
      seq_number: i + 1,
      subject: toSmartleadTokens(s.subject),
      email_body: toEmailBody(s),
      seq_delay_details: { delay_in_days: delays[i] },
    }));
    const seqRes = await fetch(smartleadUrl(`/campaigns/${campaignId}/sequences`, apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sequences }),
    });
    if (!seqRes.ok) {
      console.error("Smartlead sequence save failed", seqRes.status, await seqRes.text());
      return NextResponse.json(
        { error: `Smartlead returned ${seqRes.status} saving the sequence.`, campaignId },
        { status: 502 }
      );
    }

    // 3. Add the revealed contacts as leads.
    const leadsRes = await fetch(smartleadUrl(`/campaigns/${campaignId}/leads`, apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_list: leadList }),
    });
    if (!leadsRes.ok) {
      console.error("Smartlead add leads failed", leadsRes.status, await leadsRes.text());
      return NextResponse.json(
        { error: `Smartlead returned ${leadsRes.status} adding leads.`, campaignId },
        { status: 502 }
      );
    }

    // 4. Look for mailboxes already connected to this Smartlead account (a
    // one-time OAuth/SMTP setup done in the Smartlead dashboard — this app
    // has no flow for adding mailbox credentials). If any exist, assign them,
    // attach a default send schedule (Smartlead refuses to start without
    // one — "Cron Exp value is empty"), and start sending immediately.
    // Otherwise leave the campaign as a draft for a human to finish.
    const acctRes = await fetch(
      `${smartleadUrl("/email-accounts/", apiKey)}&limit=100&isSmtpSuccess=true`
    );
    let started = false;
    let senderCount = 0;
    if (acctRes.ok) {
      const accounts = (await acctRes.json()) as { id: number }[];
      const accountIds = (Array.isArray(accounts) ? accounts : []).map((a) => a.id);
      senderCount = accountIds.length;

      if (accountIds.length > 0) {
        const assignRes = await fetch(
          smartleadUrl(`/campaigns/${campaignId}/email-accounts`, apiKey),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email_account_ids: accountIds }),
          }
        );
        if (!assignRes.ok) {
          console.error(
            "Smartlead sender assignment failed",
            assignRes.status,
            await assignRes.text()
          );
        } else {
          // Default sending window: Tuesday to Thursday, 10 AM to 5 PM IST —
          // the B2B window that works best for Indian recipients — plus
          // today if launching on some other weekday (see sendDaysForLaunch).
          // There's no UI yet to configure this per campaign.
          const scheduleRes = await fetch(
            smartleadUrl(`/campaigns/${campaignId}/schedule`, apiKey),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                timezone: "Asia/Kolkata",
                days_of_the_week: sendDaysForLaunch(),
                start_hour: "10:00",
                end_hour: "17:00",
                min_time_btw_emails: 15,
                max_new_leads_per_day: 50,
              }),
            }
          );
          if (!scheduleRes.ok) {
            console.error(
              "Smartlead schedule save failed",
              scheduleRes.status,
              await scheduleRes.text()
            );
          }

          const startRes = await fetch(smartleadUrl(`/campaigns/${campaignId}/status`, apiKey), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "START" }),
          });
          if (!startRes.ok) {
            console.error("Smartlead campaign start failed", startRes.status, await startRes.text());
          } else {
            started = true;
          }
        }
      }
    } else {
      console.error("Smartlead email-accounts fetch failed", acctRes.status, await acctRes.text());
    }

    return NextResponse.json({
      campaignId,
      campaignUrl: `https://app.smartlead.ai/app/email-campaigns-v2/${campaignId}/leads`,
      leadsAdded: leadList.length,
      stepsAdded: sequences.length,
      started,
      senderCount,
    });
  } catch (err) {
    console.error("Smartlead launch failed", err);
    return NextResponse.json(
      { error: "Smartlead launch failed. Check server logs." },
      { status: 502 }
    );
  }
});
