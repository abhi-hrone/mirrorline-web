"use client";

import { useState } from "react";
import Link from "next/link";
import { useWizard } from "@/lib/wizard-context";
import { SEQUENCE_STYLES, type SequenceStep } from "@/lib/mock-data";
import { emailParagraphs, fillMergeTokens, type MergeValues } from "@/lib/email-render";
import {
  CAMPAIGN_TYPES,
  FRAMEWORKS,
  FRAMEWORK_BY_ID,
  campaignTypeById,
  type FrameworkId,
} from "@/lib/sequence-options";

export default function SequencePage() {
  const {
    emails,
    setEmailField,
    sequenceStatus,
    sequenceError,
    generateSequence,
    campaignTypeId,
    setCampaignTypeId,
    stepFrameworks,
    setStepFramework,
    campaignBrief,
    setCampaignBrief,
    contactGroups,
    sequenceCompanies,
    sequences,
    activeSequenceDomain,
    setActiveSequenceDomain,
    sequenceProgress,
    redraftCompany,
  } = useWizard();
  const campaignType = campaignTypeById(campaignTypeId);

  // Drafted emails open as a preview; Edit shows the raw fields.
  const [modes, setModes] = useState<Record<string, "preview" | "edit">>({});
  const modeFor = (step: string) => modes[step] ?? "preview";
  const setMode = (step: string, mode: "preview" | "edit") =>
    setModes((prev) => ({ ...prev, [step]: mode }));

  // Preview as a real recipient at the company being viewed: the first contact
  // with an email (they're the ones who get sent), else anyone found there,
  // else a placeholder.
  const activeCompany = sequenceCompanies.find((c) => c.domain === activeSequenceDomain);
  const activeGroups = contactGroups.filter((g) => g.domain === activeSequenceDomain);
  const sample =
    activeGroups.flatMap((g) => g.people.filter((p) => p.email).map((p) => ({ g, p })))[0] ??
    activeGroups.flatMap((g) => g.people.map((p) => ({ g, p })))[0];
  const recipient: Recipient = sample
    ? {
        firstName: sample.p.name.trim().split(/\s+/)[0] || "there",
        title: sample.p.title,
        company: sample.g.company,
        name: sample.p.name,
        email: sample.p.email,
      }
    : {
        firstName: "Priya",
        title: "HR Director",
        company: activeCompany?.name ?? "Acme Industries",
        name: "Priya",
        email: "",
      };
  const draftedCount = sequenceCompanies.filter((c) => sequences[c.domain]).length;
  const briefMissing = campaignType.needsBrief && !campaignBrief.trim();

  return (
    <div className="px-5 pt-[22px] sm:px-10 sm:pt-[38px]">
      <div className="flex max-w-[900px] flex-col gap-3.5">
        <div className="flex flex-col gap-5 rounded-[10px] border border-line bg-white p-5">
          <div className="flex flex-col gap-2.5">
            <span className="font-mono text-[10.5px] tracking-[0.12em] text-[#6E6A5C] uppercase">
              Campaign type
            </span>
            <div className="flex flex-wrap gap-1.5">
              {CAMPAIGN_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCampaignTypeId(t.id)}
                  aria-pressed={t.id === campaignType.id}
                  className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs ${
                    t.id === campaignType.id
                      ? "border-ink bg-ink text-paper"
                      : "border-line bg-white text-[#55513F]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-[12.5px] leading-relaxed text-[#6E6A5C]">
              <span className="font-medium text-ink">{campaignType.goal}</span>{" "}
              {campaignType.guidance}
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10.5px] tracking-[0.12em] text-[#6E6A5C] uppercase">
              Campaign brief{campaignType.needsBrief ? " · required" : ""}
            </span>
            <textarea
              rows={3}
              value={campaignBrief}
              onChange={(e) => setCampaignBrief(e.target.value)}
              placeholder={campaignType.briefHint}
              className="rounded-md border border-line bg-paper p-3 text-sm leading-relaxed"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10.5px] tracking-[0.12em] text-[#6E6A5C] uppercase">
              Framework per email
            </span>
            {campaignType.plan.map((step, i) => {
              const framework = FRAMEWORK_BY_ID[stepFrameworks[i] ?? step.framework];
              return (
                <div
                  key={`${campaignType.id}-${i}`}
                  className="grid grid-cols-1 items-center gap-2 border-b border-[#F0EBE0] pb-2 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_220px]"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium">
                      Email {i + 1}{" "}
                      <span className="font-mono text-[11px] font-normal text-muted">
                        · Day {step.day} · {step.purpose}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-muted">
                      {framework.structure} — best for {framework.bestFor.toLowerCase()}
                    </div>
                  </div>
                  <select
                    value={framework.id}
                    onChange={(e) => setStepFramework(i, e.target.value as FrameworkId)}
                    aria-label={`Framework for email ${i + 1}`}
                    className="cursor-pointer rounded-md border border-line bg-paper px-2.5 py-2 text-[13px]"
                  >
                    {FRAMEWORKS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.id}
                        {f.id === step.framework ? " (recommended)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-[10px] border border-line bg-white px-5 py-4">
          <span className="text-[13.5px] text-[#55513F]">
            {briefMissing
              ? `Add the campaign brief to draft a ${campaignType.label.toLowerCase()} sequence.`
              : sequenceStatus === "loading"
                ? `Drafting ${sequenceProgress.done} of ${sequenceProgress.total}…`
                : sequenceCompanies.length === 0
                  ? "No companies picked yet — this drafts one shared sequence for the whole campaign."
                  : emails.length > 0
                    ? `Redraft all ${sequenceCompanies.length} companies' sequences with the settings above.`
                    : `Draft a sequence for each of the ${sequenceCompanies.length} companies, written from the case study and what we know about that company.`}
          </span>
          <button
            onClick={generateSequence}
            disabled={sequenceStatus === "loading" || briefMissing}
            className="ml-auto cursor-pointer rounded-md bg-teal px-4 py-2 text-[12.5px] font-semibold text-paper disabled:opacity-60"
          >
            {sequenceStatus === "loading"
              ? "Drafting…"
              : emails.length > 0
                ? "Regenerate all"
                : sequenceCompanies.length > 1
                  ? `Generate ${sequenceCompanies.length} sequences`
                  : "Generate sequence"}
          </button>
        </div>
        {sequenceError && <p className="text-[13px] text-[#B3402A]">{sequenceError}</p>}

        {sequenceCompanies.length > 0 && Object.keys(sequences).length > 0 && (
          <div className="flex flex-col gap-2.5 rounded-[10px] border border-line bg-white px-5 py-4">
            <span className="font-mono text-[10.5px] tracking-[0.12em] text-[#6E6A5C] uppercase">
              Company · {draftedCount} of {sequenceCompanies.length} drafted
            </span>
            <div className="flex flex-wrap gap-1.5">
              {sequenceCompanies.map((c) => {
                const drafted = !!sequences[c.domain];
                const active = c.domain === activeSequenceDomain;
                return (
                  <button
                    key={c.domain}
                    type="button"
                    onClick={() => (drafted ? setActiveSequenceDomain(c.domain) : redraftCompany(c.domain))}
                    disabled={!drafted && sequenceStatus === "loading"}
                    aria-pressed={active}
                    title={drafted ? c.domain : `Not drafted yet — click to draft ${c.name}`}
                    className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs disabled:opacity-60 ${
                      active
                        ? "border-ink bg-ink text-paper"
                        : drafted
                          ? "border-line bg-white text-[#55513F]"
                          : "border-dashed border-line bg-paper text-muted"
                    }`}
                  >
                    {c.name}
                    {!drafted && " · draft"}
                  </button>
                );
              })}
            </div>
            {activeCompany && (
              <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-[#6E6A5C]">
                <span>
                  Written for <span className="font-medium text-ink">{activeCompany.name}</span>
                  {[activeCompany.size && /\d/.test(activeCompany.size) && `${activeCompany.size} employees`, activeCompany.region]
                    .filter(Boolean)
                    .map((f) => ` · ${f}`)
                    .join("")}
                </span>
                <button
                  type="button"
                  onClick={() => redraftCompany(activeCompany.domain)}
                  disabled={sequenceStatus === "loading"}
                  className="ml-auto cursor-pointer rounded-md border border-line px-[13px] py-[7px] text-xs font-medium text-[#55513F] disabled:opacity-60"
                >
                  Redraft {activeCompany.name}
                </button>
              </div>
            )}
          </div>
        )}

        {emails.length === 0 && sequenceStatus !== "loading" && (
          <p className="rounded-[10px] border border-line bg-white px-5 py-6 text-[13.5px] text-[#55513F]">
            No sequence yet. Click “Generate sequence” to draft one.
          </p>
        )}

        {emails.map((email, i) => (
          <div
            key={email.step}
            className="overflow-hidden rounded-[10px] border border-line bg-white"
          >
            <div className="flex flex-wrap items-center gap-3 border-b border-[#E8E2D5] bg-paper px-[18px] py-[13px]">
              <span className="font-mono text-[10.5px] tracking-[0.1em] text-teal uppercase">
                {email.step}
              </span>
              <span className="font-mono text-[10.5px] text-muted">
                {email.day}
              </span>
              {email.framework && (
                <span className="rounded-full border border-[#E5DAC0] bg-[#F2EDDF] px-[9px] py-[2px] font-mono text-[9.5px] tracking-[0.09em] text-[#7A5B27] uppercase">
                  {email.framework}
                </span>
              )}
              <span
                className={`ml-auto rounded-full px-2 py-[3px] font-mono text-[9.5px] tracking-[0.09em] uppercase ${SEQUENCE_STYLES[email.state]}`}
              >
                {email.state}
              </span>
              <div className="flex overflow-hidden rounded-md border border-line text-xs">
                {(["preview", "edit"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(email.step, m)}
                    aria-pressed={modeFor(email.step) === m}
                    className={`cursor-pointer px-3 py-1 capitalize ${
                      modeFor(email.step) === m ? "bg-ink text-paper" : "bg-white text-[#55513F]"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3 p-[18px]">
              {email.connection && (
                <p className="text-[12.5px] text-[#6E6A5C]">
                  <span className="font-medium text-teal">↳ Picks up from {emails[i - 1]?.step ?? "the previous step"}:</span>{" "}
                  {email.connection}
                </p>
              )}
              {modeFor(email.step) === "preview" ? (
                <EmailPreview email={email} recipient={recipient} />
              ) : (
              <>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[9.5px] tracking-[0.11em] text-[#A39D8C] uppercase">
                  Subject
                </span>
                <input
                  value={email.subject}
                  onChange={(e) => setEmailField(i, "subject", e.target.value)}
                  className="rounded-md border border-line bg-paper px-3 py-2.5 text-sm font-medium"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[9.5px] tracking-[0.11em] text-[#A39D8C] uppercase">
                  Preheader
                </span>
                <input
                  value={email.preheader}
                  onChange={(e) => setEmailField(i, "preheader", e.target.value)}
                  className="rounded-md border border-line bg-paper px-3 py-2.5 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[9.5px] tracking-[0.11em] text-[#A39D8C] uppercase">
                  Hook
                </span>
                <textarea
                  rows={2}
                  value={email.hook}
                  onChange={(e) => setEmailField(i, "hook", e.target.value)}
                  className="rounded-md border border-line bg-paper p-3 text-sm leading-relaxed"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[9.5px] tracking-[0.11em] text-[#A39D8C] uppercase">
                  Content
                </span>
                <textarea
                  rows={4}
                  value={email.content}
                  onChange={(e) => setEmailField(i, "content", e.target.value)}
                  className="rounded-md border border-line bg-paper p-3 text-sm leading-relaxed"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[9.5px] tracking-[0.11em] text-[#A39D8C] uppercase">
                  CTA
                </span>
                <textarea
                  rows={2}
                  value={email.cta}
                  onChange={(e) => setEmailField(i, "cta", e.target.value)}
                  className="rounded-md border border-line bg-paper p-3 text-sm leading-relaxed"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[9.5px] tracking-[0.11em] text-[#A39D8C] uppercase">
                  P.S.
                </span>
                <textarea
                  rows={2}
                  value={email.ps}
                  onChange={(e) => setEmailField(i, "ps", e.target.value)}
                  placeholder="Optional — restate the offer or the proof in one line"
                  className="rounded-md border border-line bg-paper p-3 text-sm leading-relaxed"
                />
              </label>
              </>
              )}
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-mono text-[10.5px] text-muted">
                  Pulled from
                </span>
                {email.sources.map((source) => (
                  <span
                    key={source}
                    className="rounded-full border border-[#E5DAC0] bg-[#F2EDDF] px-[9px] py-[3px] text-[11.5px] text-[#7A5B27]"
                  >
                    {source}
                  </span>
                ))}
                <button className="ml-auto cursor-pointer rounded-md border border-line px-[13px] py-[7px] text-xs font-medium text-[#55513F]">
                  Rewrite this step
                </button>
              </div>
            </div>
          </div>
        ))}

        {emails.length > 0 && (
          <Link
            href="/campaigns/new/review"
            className="cursor-pointer self-start rounded-md bg-teal px-[22px] py-3 text-sm font-semibold text-paper"
          >
            Send to review
          </Link>
        )}
      </div>
    </div>
  );
}

type Recipient = MergeValues & { name: string; email: string };

function EmailPreview({ email, recipient }: { email: SequenceStep; recipient: Recipient }) {
  const fill = (text: string) => fillMergeTokens(text, recipient);
  return (
    <div className="overflow-hidden rounded-md border border-line">
      <div className="flex flex-col gap-1 border-b border-[#F0EBE0] bg-paper px-4 py-3 text-[12.5px]">
        <div className="text-muted">
          To:{" "}
          <span className="text-[#55513F]">
            {recipient.name}
            {recipient.email ? ` <${recipient.email}>` : ""} · {recipient.title}, {recipient.company}
          </span>
        </div>
        <div className="text-[15px] font-semibold text-ink">
          {fill(email.subject) || <span className="font-normal text-[#B3402A]">No subject</span>}
        </div>
        {email.preheader && <div className="text-muted">{fill(email.preheader)}</div>}
      </div>
      <div className="flex flex-col gap-3 bg-white px-4 py-4 text-[14px] leading-relaxed text-ink">
        {emailParagraphs(email).map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {fill(p)}
          </p>
        ))}
      </div>
    </div>
  );
}
