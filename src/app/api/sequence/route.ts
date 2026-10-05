import { NextRequest, NextResponse } from "next/server";
import { AzureOpenAI } from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod/v4";
import { CASE_QS, CONTEXT_QS } from "@/lib/mock-data";
import {
  FRAMEWORK_BY_ID,
  PAST_USER_CAMPAIGN_TYPE,
  campaignTypeById,
  isFrameworkId,
  type PlanStep,
} from "@/lib/sequence-options";
import { withRequestLog } from "@/lib/logger";
import { researchCompany } from "@/lib/company-research";

export const maxDuration = 120;

// Field order matters: structured output is generated top to bottom, so
// "connection" and "research_used" come first to make the model commit to
// how this email continues the last one, and which research finding it
// opens with, before it writes the hook.
const StepSchema = z.object({
  connection: z
    .string()
    .describe("Email 1: empty string. From email 2 on: one line naming the specific point, number or question from the previous email that this one picks up and carries forward"),
  research_used: z
    .array(z.number().int())
    .describe("The number of the web research finding (R1 = 1, R2 = 2, …) this email mentions, as a one-item array, or an empty array when it uses none. Email 1 must use one whenever any web research is supplied"),
  day: z.number().int().min(0).describe("Days after the first email sends (0 for the first email)"),
  framework: z
    .string()
    .describe("The copywriting framework this email is written to, exactly as named in the plan"),
  subject: z
    .string()
    .describe("2-5 words, lowercase, 30-50 characters, no clickbait and no client name unless naming is cleared. Email 1: a concrete outcome the recipient's company could get, e.g. \"payroll in 2 days at {{company}}\""),
  preheader: z
    .string()
    .describe("One short line that extends the subject rather than repeating it — the preview text after the subject"),
  hook: z
    .string()
    .describe("1-2 sentences that earn the next line. Must be about the recipient's situation, never about HROne. When research_used is not empty, the hook mentions that finding. From email 2 on, it picks up naturally from the previous email"),
  content: z
    .string()
    .describe("The body, written to this step's framework. Must only state facts present in the supplied case study answers, campaign brief or web research — never invent metrics, names, dates, prices or outcomes"),
  cta: z
    .string()
    .describe("Exactly one ask, phrased as a question, pointing at the campaign's ask"),
  ps: z
    .string()
    .describe("Optional P.S. restating the offer or the proof in one line. Empty string when the email is stronger without one"),
  sources: z
    .array(z.string())
    .describe("Which case-study fields (or \"Campaign brief\") this email draws its claims from, by label (e.g. \"What results did they see after go-live?\")"),
});

const SequenceSchema = z.object({
  steps: z.array(StepSchema).min(1).max(6),
});

// Past-user mode: one person who used HROne at their previous company, now
// at the target company. "pastUser" is the track written to them; "team" is
// the track written to the HR team at their new company, which names them.
type PastUser = { name: string; title: string; oldCompany: string; track: "pastUser" | "team" };

function pastUserRules(p: PastUser, oldCompanyLabel: string) {
  const first = p.name.split(/\s+/)[0];
  const role = p.title ? ` as ${p.title}` : "";
  return p.track === "pastUser"
    ? `PAST USER TRACK: this sequence goes to one person, ${p.name}, who used HROne at their previous company, ${p.oldCompany}, and recently joined {{company}}${role}. Address them with {{firstName}}. Email 1 opens on their move to {{company}}. The case study is ${p.oldCompany}'s story — always name ${p.oldCompany} to them, they worked there. They likely saw it first-hand, but never claim they led, chose or ran the project, or how they felt about HROne. They already know HROne: never explain it from scratch. The case study's numbers belong to ${p.oldCompany}, never to {{company}}.`
    : `PAST USER: ${p.name} recently joined {{company}}${role} from ${oldCompanyLabel}, where they used HROne. Email 1 must mention this in its hook or body — for example "${first} joined {{company}} from ${oldCompanyLabel}, where the team ran payroll on HROne" — and at most one later email may mention it again. Never claim ${first} recommended HROne, asked us to reach out, knows about this email, or holds any view about HROne; never quote or speak for them. Refer to them by name or as "they" — never "he" or "she", since their pronouns aren't known. ${p.name} does not receive this sequence — the recipient is a colleague of theirs.`;
}

// Director mode: the target company shares a director with an HROne
// customer. The sequence goes to the HR team there, not to the director.
// `named` is the rep's call on whether the emails may name the director.
type Director = { name: string; customer: string; titleHere: string; named: boolean };

function directorRules(d: Director, customerLabel: string) {
  const first = d.name.split(/\s+/)[0];
  const role = d.titleHere ? `, ${d.titleHere} at {{company}},` : "";
  const never = `Never claim the director recommended HROne, asked us to reach out, knows about this email, or holds any view about HROne; never quote or speak for them. Never claim ${customerLabel} and {{company}} share anything else — staff, payroll, systems or ownership. The director does not receive this sequence — the recipient works at {{company}}.`;
  return d.named
    ? `DIRECTOR: ${d.name}${role} is also a director of ${customerLabel}, which runs its HR and payroll on HROne. Email 1 must mention this link in its hook or body — for example "${customerLabel}, where ${first} is also on the board, runs payroll on HROne" — and at most one later email may mention it again. Refer to them by name or as "they" — never "he" or "she", since their pronouns aren't known. ${never}`
    : `SHARED BOARD: {{company}} shares a director with ${customerLabel}, which runs its HR and payroll on HROne. Email 1 must mention this link in its hook or body — for example "${customerLabel}, which shares a board member with {{company}}, runs payroll on HROne" — and at most one later email may mention it again. Never name, describe or hint at who that director is: no name, initials, title or role. ${never}`;
}

// perCompany: the sequence is drafted for one named lookalike company rather
// than as a template for every company in the campaign. extraRules: the
// past-user or director rules, when the campaign has one.
const systemPrompt = (perCompany: boolean, extraRules: string) => `You are an expert B2B email writer for HROne, an HR and payroll software company selling to Indian businesses. You write email sequences to decision-makers at Indian companies that are not HROne customers yet, built on one approved customer case study.

Each request gives you the campaign type, its goal, the one thing every email asks for, and a plan: for each email, its send day, its purpose in the sequence, and the copywriting framework it must follow, with that framework's structure spelled out. Write each email's body to its own framework — the structure is the skeleton, not a set of labels to print. Return exactly as many emails as the plan lists, in that order — no extra step, no repeated step.

FIRST SUBJECT: email 1's subject names a concrete outcome the recipient's own company could get, taken from the case study's results — what could be true at {{company}}, not the problem and not the product. For example "payroll in 2 days at {{company}}" or "zero revised pf filings". Still 2 to 5 words, lowercase, and only an outcome the case study actually achieved.

ONE CONVERSATION: the sequence reads as one thread, not separate emails. From email 2 on, first fill "connection" with the specific point, number or question from the previous email that this one carries forward. Then the hook's first sentence must name that same point explicitly, so the reader sees the thread — for example "That 2-day payroll cycle usually raises one question: what happens to the plants still on spreadsheets?" or "The part of that before/after story most HR heads ask about is the switch itself." A reader who missed the earlier email must still follow. Never the lazy versions: "as I mentioned", "following up on my last email", "circling back", "just checking in". Don't re-introduce HROne or the case study client from scratch after email 1.

WHOSE NUMBERS: the case study's headcount, locations, problems and results belong to the case study client, never to the recipient. ${
  perCompany
    ? "The request lists the facts known about the recipient's company, including any web research on it — state only those, as given. Anything else about them (plants, states, payroll process, problems) you don't know, so ask or imagine it rather than asserting it."
    : "Don't tell the recipient how many employees or plants they have — you don't know."
} Say what the client had, and ask or imagine what the recipient's version looks like.

EMAIL PARTS: every email has a subject, a preheader that extends the subject instead of repeating it, a hook, a body, one CTA, and an optional P.S. Only "ps" may be empty — subject, preheader, hook, content and cta are always filled, in every email including the closing note. The P.S. is the second-most-read line — use it for the offer or the proof, not for a second ask. Subjects are about the recipient's situation, never about the sender or about HROne.

RULES:
- Under 90 words in "content". Plain text, no formatting, no emojis, no exclamation points.
- No greeting or sign-off: "Hi {{firstName}}," is added above the hook automatically, so never start the hook or content with one.
- Never tell the reader what you don't know, can't verify or won't assume ("I don't have verified results", "I can't claim"). Write around missing facts.
- Write like a person, not a marketer. Simple, direct Indian business English.
- The hook must be about the recipient, never about HROne or the sender. Make it concrete — what their month-end, their plants, their states or their headcount actually looks like — not a general observation about HR.
${
  perCompany
    ? `- This sequence is written for one company and sent to several people there. Make it unmistakably about that company — its size, region and why it resembles the case study client — not a template that could go anywhere. Use the merge tokens {{firstName}}, {{title}} and {{company}} for the recipient — never invent a recipient's name.
- WEB RESEARCH: when the request includes web research on the company, email 1's hook MUST open with one finding — this is what makes the email personal, so never skip it. Pick the finding with the strongest link to HR and payroll: growth in their workforce — a hiring push or open roles (careers pages count), a new plant or office, an expansion, funding, an acquisition — beats a description of what they do, but a specific website fact (what they build, who they sell to, where they operate) is still far better than nothing. Use the specific detail ("hiring engineers and sales for its AI CX platform"), not a compliment ("excels in software development"). Tie it to what the case study client went through. Later emails may use a different finding — never more than one per email, never the same one twice. Mention it the way a person who looked them up would ("saw {{company}} is opening the Pune plant", "noticed {{company}} builds telecom software for carriers"), keep facts and dates exactly as given, and say only what the research says. The research never tells you how they run HR or payroll today — don't claim they use spreadsheets or struggle with payroll; ask or imagine instead. Never use negative news (layoffs, losses, lawsuits).`
    : "- This is a template sent to many recipients across many companies, not one person. Personalize with the merge tokens {{firstName}}, {{title}} and {{company}} — never invent a recipient's name or company."
}
- Speak to the recipient's role: HR cares about effort and employee experience, finance cares about accuracy and cost, founders and COOs care about scale and risk.
- Exactly one call to action per email, framed as a question, pointing at the campaign's ask. "cta" is never empty, including in the closing note.
- Subject lines: 2 to 5 words, lowercase, no clickbait, no "Re:" tricks. No question mark unless the subject is genuinely a question.
- Every claim in "content" must trace back to a supplied case study answer or to the campaign brief. Never invent a metric, quote, name, module, or outcome. If a field is empty, write around it. "sources" is never empty.
- Event names, dates, times, links, offers, discounts, prices and deadlines come only from the campaign brief or the HROne context, word for word. Never invent one. Give times in IST.
- Name the client only if naming is cleared in the case study record. Otherwise use the exact description you are given for them, and keep every number attached to that description — never "one HR team" or "a company we work with".
- Amounts in INR with "+GST" where pricing comes up. Never quote a price that is not in the HROne context or the campaign brief.
- Vary the angle across steps so the sequence does not repeat itself, and never repeat the same number in the same words twice.
- Avoid these words and anything built on them: revolutionize, cutting-edge, seamless or seamlessly, game-changing, streamline, leverage, empower, "just following up", "quick question", "I hope this email finds you well", "imagine if".${extraRules ? `

${extraRules}` : ""}`;

export const POST = withRequestLog("sequence", async (req: NextRequest) => {
  const apiKey = process.env.AZURE_OPENAI_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_MODEL;
  const apiVersion = process.env.AZURE_OPENAI_VERSION;
  const missing = ["AZURE_OPENAI_KEY", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_MODEL", "AZURE_OPENAI_VERSION"].filter(
    (name) => !process.env[name]
  );
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `${missing.join(", ")} not set on the server.` },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const seedName = typeof body.seedName === "string" ? body.seedName : "";
  const answers: Record<string, string> =
    body.answers && typeof body.answers === "object" ? body.answers : {};
  const targetTitles = typeof body.targetTitles === "string" ? body.targetTitles : "";
  const targetDepartments: string[] = Array.isArray(body.targetDepartments)
    ? body.targetDepartments.filter((d: unknown) => typeof d === "string")
    : [];
  const rawPastUser = body.pastUser && typeof body.pastUser === "object" ? body.pastUser : null;
  const pastUserField = (key: string) =>
    rawPastUser && typeof rawPastUser[key] === "string" ? (rawPastUser[key] as string).trim() : "";
  const pastUser: PastUser | null =
    pastUserField("name") && pastUserField("oldCompany")
      ? {
          name: pastUserField("name"),
          title: pastUserField("title"),
          oldCompany: pastUserField("oldCompany"),
          track: body.track === "pastUser" ? "pastUser" : "team",
        }
      : null;
  const rawDirector = body.director && typeof body.director === "object" ? body.director : null;
  const directorField = (key: string) =>
    rawDirector && typeof rawDirector[key] === "string" ? (rawDirector[key] as string).trim() : "";
  const director: Director | null =
    !pastUser && directorField("name") && directorField("customer")
      ? {
          name: directorField("name"),
          customer: directorField("customer"),
          titleHere: directorField("titleHere"),
          named: rawDirector?.named === true,
        }
      : null;
  const pastUserTrack = pastUser?.track === "pastUser";
  // The past user's own track always follows its fixed plan.
  const campaignType = pastUserTrack ? PAST_USER_CAMPAIGN_TYPE : campaignTypeById(body.campaignType);
  const brief = typeof body.brief === "string" ? body.brief.trim() : "";
  // Days and purposes are the campaign type's; only the framework per step
  // is the user's choice, and an unknown one falls back to the default.
  const requested: unknown[] =
    Array.isArray(body.frameworks) && !pastUserTrack ? body.frameworks : [];
  const plan: PlanStep[] = campaignType.plan.map((step, i) => {
    const chosen = requested[i];
    return { ...step, framework: isFrameworkId(chosen) ? chosen : step.framework };
  });
  const numSteps = plan.length;

  // Optional: the one lookalike company this sequence is written for. Only
  // what the lookalike search returned is passed on as fact — "—" and
  // "Other" are its placeholders for "unknown", so they're dropped.
  const rawCompany = body.company && typeof body.company === "object" ? body.company : null;
  const companyField = (key: string) =>
    rawCompany && typeof rawCompany[key] === "string" ? (rawCompany[key] as string).trim() : "";
  const company = companyField("name")
    ? {
        name: companyField("name"),
        domain: companyField("domain"),
        size: /\d/.test(companyField("size")) ? companyField("size") : "",
        region: companyField("region") === "Other" ? "" : companyField("region"),
        fit: companyField("fit"),
      }
    : null;

  // Researched up front so a slow or failed search can't eat into the
  // drafting call's time — and failure just means drafting without it.
  const research = company
    ? await researchCompany(company.name, company.domain).catch((err) => {
        console.error("Company research failed", err);
        return [];
      })
    : [];

  if (campaignType.needsBrief && !brief) {
    return NextResponse.json(
      { error: `A ${campaignType.label} campaign needs a brief: ${campaignType.briefHint}.` },
      { status: 400 }
    );
  }

  const valueFor = (id: string) => (answers[id] || "").trim();
  const labelFor = (id: string) => CASE_QS.find((q) => q.id === id)?.label ?? id;

  // The case study block is the client's story; the context block is about us
  // and about what we are allowed to say. The prompt treats them differently —
  // only the first may be quoted as fact about a customer.
  const caseFields = CASE_QS.filter((q) => !CONTEXT_QS.includes(q.id));
  const filledAnswers = caseFields
    .map((q) => ({ label: q.label, value: valueFor(q.id) }))
    .filter((a) => a.value.length > 0);

  // Past-user and director mode can draft with no case study at all: all we
  // then know is that the person used HROne at their old company, or that
  // the director's other company uses HROne.
  const minimalCase = filledAnswers.length === 0 && (!!pastUser || !!director);
  if (filledAnswers.length === 0 && !minimalCase) {
    return NextResponse.json(
      { error: "No case study answers to draft from — fill in the case study record first." },
      { status: 400 }
    );
  }

  const nameAllowed = /^y/i.test(valueFor("name_allowed"));
  // When naming isn't cleared, the client can still be described — that
  // description carries every number in the sequence, so build it once here
  // rather than leaving the model to phrase it differently in each email.
  // "1,200 — 900 on the shop floor" becomes "1,200-employee".
  const headcountNumber = valueFor("headcount").match(/[\d,]+/)?.[0];
  const anonymousLabel = [
    "a",
    headcountNumber ? `${headcountNumber}-employee` : "similar-sized",
    valueFor("industry").toLowerCase() || "same-industry",
    "company",
  ].join(" ");
  const clientLabel = nameAllowed ? seedName || "the approved customer" : anonymousLabel;

  const caseStudyText = minimalCase && director
    ? `- No case study is available for ${director.customer}. The only fact: ${director.customer} uses HROne and shares a director with {{company}}. State no numbers, modules, problems, results or quotes for ${director.customer}, and make email 1's subject about {{company}} rather than an outcome. Never tell the reader what you don't know, can't claim or won't assume — just write around it: lean on the shared board, the web research, and the HROne context.`
    : minimalCase
    ? `- No case study is available for ${pastUser?.oldCompany}. The only fact: ${pastUser?.name} used HROne there. State no numbers, modules, problems, results or quotes for that company, and make email 1's subject about their move to {{company}} rather than an outcome. Never tell the reader what you don't know, can't claim or won't assume — just write around it: lean on their first-hand experience of HROne, their new role, the web research, and the HROne context.`
    : filledAnswers.map((a) => `- ${a.label} ${a.value}`).join("\n");
  const contextText = [
    valueFor("client_role") && `- ${labelFor("client_role")} ${valueFor("client_role")}`,
    `- Naming: ${
      nameAllowed
        ? `cleared — you may name ${seedName || "the client"} in the emails.`
        : `NOT cleared — never name the client. Refer to them only as "${clientLabel}".`
    }`,
    valueFor("hrone_context") && `- HROne context:
${valueFor("hrone_context")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const targetingText = [
    targetTitles && `- Titles: ${targetTitles}`,
    targetDepartments.length > 0 && `- Departments: ${targetDepartments.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  // With no case study, a step built on the client's story has nothing to
  // tell — the model then fills the email with what it doesn't know. Point
  // those steps at the HROne context instead.
  const STORY_FRAMEWORKS = ["BAB", "Storytelling", "Social proof-led", "4Ps"];
  const minimalNote = (framework: string) =>
    minimalCase && STORY_FRAMEWORKS.includes(framework)
      ? ` NO CASE STUDY: there is no story or result to tell, so instead answer the question of fit at {{company}} from the HROne context (modules, statutory compliance, integrations, time to go live), tied to the web research${pastUser ? " or their new role" : ""}.`
      : "";
  const planText = plan
    .map((step, i) => {
      const f = FRAMEWORK_BY_ID[step.framework];
      const link = i > 0 ? ` Picks up where email ${i} left off.` : "";
      const note = `${link}${minimalCase && STORY_FRAMEWORKS.includes(step.framework) ? "" : step.note ? ` ${step.note}` : ""}${minimalNote(step.framework)}`;
      return `- Email ${i + 1} (Day ${step.day}, ${step.purpose}) — ${f.id}: ${f.structure}. ${f.instruction}${note}`;
    })
    .join("\n");

  const companyText = company
    ? [
        `- Name: ${company.name}${company.domain ? ` (${company.domain})` : ""}`,
        company.size && `- Employees: ${company.size}`,
        company.region && `- Region: ${company.region}`,
        company.fit && `- Why it matches the case study client: ${company.fit}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const findings = research.slice(0, 6);
  const researchText = findings
    .map(
      (f, i) =>
        `- R${i + 1} [${f.source === "news" ? `News${f.publishedDate ? `, ${f.publishedDate}` : ""}` : "Company website"}] ${f.summary} (${f.url})`
    )
    .join("\n");

  const sourceLabels = [
    ...filledAnswers.map((a) => a.label),
    ...(brief ? ["Campaign brief"] : []),
    ...(company ? ["Target company"] : []),
    ...(researchText ? ["Company research"] : []),
    ...(pastUser ? ["Past user"] : []),
    ...(director ? ["Director"] : []),
  ];

  const userPrompt = `CASE STUDY (from the implementation consultant):
${caseStudyText}

HRONE CONTEXT AND PERMISSIONS:
${contextText}

WHO IS RECEIVING THIS:
${
  targetingText ||
  "- Decision-makers at companies with a similar profile to the case study client."
}
${
  company
    ? `- Everyone receiving this works at the company below; write to their role, and use {{firstName}}, {{title}} and {{company}}.

TARGET COMPANY (all that is known about it — state nothing else about them as fact):
${companyText}${
        researchText
          ? `

WEB RESEARCH ON ${company.name.toUpperCase()} (today is ${new Date().toISOString().slice(0, 10)}; email 1 must open with one of these; at most one per email, as given, with its number in "research_used"):
${researchText}`
          : ""
      }`
    : "- The same sequence goes to every recipient, so write to the role, not to a person, and use {{firstName}}, {{title}} and {{company}}."
}

CAMPAIGN:
- Type: ${campaignType.label}
- Goal: ${campaignType.goal}
- Every email asks for: ${campaignType.ask}
- Guidance: ${campaignType.guidance}

CAMPAIGN BRIEF (facts you may state as given):
${brief || "- None. Do not mention events, offers, launches, prices or deadlines."}

SEQUENCE TO WRITE:
${planText}

SOURCING: for each email, "sources" lists where its claims came from, copied word for word from this list — ${sourceLabels
    .map((l) => `"${l}"`)
    .join(", ")}. Do not invent a label.

Write exactly ${numSteps} emails, in that order, using only the facts above. The goal: ${campaignType.goal}`;

  const client = new AzureOpenAI({
    apiKey: apiKey as string,
    endpoint: endpoint as string,
    deployment: deployment as string,
    apiVersion: apiVersion as string,
  });

  try {
    const completion = await client.chat.completions.parse({
      model: deployment as string,
      messages: [
        {
          role: "system",
          content: systemPrompt(
            !!company,
            pastUser
              ? pastUserRules(pastUser, nameAllowed ? pastUser.oldCompany : "their previous company")
              : director
                ? directorRules(director, nameAllowed ? director.customer : "another company on the same board")
                : ""
          ),
        },
        { role: "user", content: userPrompt },
      ],
      response_format: zodResponseFormat(SequenceSchema, "email_sequence"),
    });

    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) {
      return NextResponse.json(
        { error: "Model did not return a parseable sequence. Try again." },
        { status: 502 }
      );
    }

    // The schedule and the framework order are ours, not the model's — it has
    // been seen returning an extra step or restarting the day count midway.
    // Take the plan as written and let the model fill only the copy.
    const steps = parsed.steps.slice(0, numSteps).map((s, i) => ({
      step: `Step ${i + 1}`,
      day: `Day ${plan[i]?.day ?? s.day}`,
      framework: plan[i]?.framework ?? s.framework,
      subject: s.subject,
      preheader: s.preheader,
      hook: s.hook,
      content: s.content,
      cta: s.cta,
      ps: s.ps,
      sources: s.sources,
      // The pages behind any research the email cites, so the reviewer can
      // check the claim before it goes out. Unknown numbers are dropped.
      research: [...new Set(s.research_used)]
        .map((n) => findings[n - 1])
        .filter(Boolean)
        .map(({ title, url, publishedDate, source }) => ({ title, url, publishedDate, source })),
      connection: i > 0 ? s.connection : "",
      // A step missing its ask or its sourcing is the reviewer's problem to
      // fix, so flag it rather than letting it pass as drafted.
      state: s.cta.trim() && s.sources.length > 0 ? ("Drafted" as const) : ("Needs edit" as const),
    }));

    // Everything found, used or not, so the reviewer can see what the web
    // turned up for this company.
    return NextResponse.json({
      steps,
      research: findings.map(({ title, url, publishedDate, source, summary }) => ({
        title,
        url,
        publishedDate,
        source,
        summary,
      })),
    });
  } catch (err) {
    console.error("Sequence generation failed", err);
    return NextResponse.json(
      { error: "Sequence generation failed. Check server logs." },
      { status: 502 }
    );
  }
});
