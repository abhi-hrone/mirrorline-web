"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { pickedCompanies, useWizard } from "@/lib/wizard-context";

// 0 = no minimum, i.e. show every company the search returned.
const SCORE_THRESHOLDS = [0, 90, 80, 70];

// Lower bound inclusive, upper exclusive.
const HEADCOUNT_BANDS: { label: string; min: number; max: number }[] = [
  { label: "All", min: 0, max: Infinity },
  { label: "<200", min: 0, max: 200 },
  { label: "200–1K", min: 200, max: 1000 },
  { label: "1K–5K", min: 1000, max: 5000 },
  { label: "5K+", min: 5000, max: Infinity },
];

// Headcount arrives as a plain count (Apollo: "1200"), a range (Ocean:
// "201-500", "500000+") or "—". Ranges are bucketed by their lower bound.
function parseHeadcount(size: string): number | null {
  const m = size.replace(/,/g, "").match(/^\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

function formatHeadcount(size: string) {
  return /^\d+$/.test(size) ? Number(size).toLocaleString("en-IN") : size;
}

function inBand(size: string, bandLabel: string) {
  const band = HEADCOUNT_BANDS.find((b) => b.label === bandLabel);
  if (!band || band.label === "All") return true;
  const n = parseHeadcount(size);
  return n !== null && n >= band.min && n < band.max;
}

// Results cached before region names were normalized carry "IN" (Ocean) or
// "INDIA" (Apollo) for the same country; fold them into one filter chip.
function regionLabel(region: string) {
  return /^(in|india)$/i.test(region) ? "India" : region;
}

export default function LookalikesPage() {
  const {
    seedName,
    companies,
    lookalikeStatus,
    lookalikeError,
    findLookalikes,
    minScore,
    setMinScore,
    headcountBand,
    setHeadcountBand,
    region,
    setRegion,
    picked,
    togglePicked,
    setPickedMany,
  } = useWizard();

  // Load live results on first arrival; the ref keeps StrictMode from firing twice.
  const autoLoaded = useRef(false);
  useEffect(() => {
    if (autoLoaded.current || companies.length > 0) return;
    autoLoaded.current = true;
    findLookalikes();
  }, [companies.length, findLookalikes]);

  const regions = ["All", ...Array.from(new Set(companies.map((c) => regionLabel(c.region))))];
  // Defaults to India; if a search has no Indian companies at all, show
  // everything rather than an empty table.
  const activeRegion = regions.includes(region) ? region : "All";
  const filtered = companies.filter(
    (c) =>
      c.score >= minScore &&
      inBand(c.size, headcountBand) &&
      (activeRegion === "All" || regionLabel(c.region) === activeRegion)
  );
  const selected = pickedCompanies(companies, picked);
  const pickedCount = selected.length;
  // "Select all" acts on what's currently visible, so it respects the score
  // and region filters instead of silently picking hidden companies.
  const allVisiblePicked = filtered.length > 0 && filtered.every((c) => picked[c.id]);
  const someVisiblePicked = filtered.some((c) => picked[c.id]);

  return (
    <div className="px-5 pt-[22px] sm:px-10 sm:pt-[38px]">
      <div className="grid max-w-[1480px] grid-cols-1 items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-[18px]">
        <div className="flex flex-wrap items-center gap-[22px] rounded-[10px] border border-line bg-white px-5 py-4">
          <div>
            <div className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
              Seed
            </div>
            <div className="mt-1 text-[14.5px] font-semibold">{seedName}</div>
          </div>
          <div className="h-[34px] w-px bg-[#E8E2D5]" />
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
              Min score
            </span>
            <div className="flex gap-1">
              {SCORE_THRESHOLDS.map((t) => (
                <button
                  key={t}
                  onClick={() => setMinScore(t)}
                  className={`cursor-pointer rounded-md border px-3 py-1.5 font-mono text-xs ${
                    minScore === t
                      ? "border-ink bg-ink text-paper"
                      : "border-line bg-white text-[#55513F]"
                  }`}
                >
                  {t === 0 ? "All" : `${t}+`}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
              Headcount
            </span>
            <div className="flex flex-wrap gap-1">
              {HEADCOUNT_BANDS.map((b) => (
                <button
                  key={b.label}
                  onClick={() => setHeadcountBand(b.label)}
                  className={`cursor-pointer rounded-md border px-3 py-1.5 font-mono text-xs ${
                    headcountBand === b.label
                      ? "border-ink bg-ink text-paper"
                      : "border-line bg-white text-[#55513F]"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
              Region
            </span>
            <div className="flex flex-wrap gap-1">
              {regions.map((r) => (
                <button
                  key={r}
                  onClick={() => setRegion(r)}
                  className={`cursor-pointer rounded-md border px-3 py-1.5 text-xs ${
                    activeRegion === r
                      ? "border-ink bg-ink text-paper"
                      : "border-line bg-white text-[#55513F]"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3.5">
            <span className="font-mono text-xs text-[#55513F]">
              {filtered.length} of {companies.length} companies
            </span>
            <button
              onClick={findLookalikes}
              disabled={lookalikeStatus === "loading"}
              className="cursor-pointer rounded-md bg-teal px-4 py-2 text-[12.5px] font-semibold text-paper disabled:opacity-60"
            >
              {lookalikeStatus === "loading" ? "Searching…" : "Find lookalikes"}
            </button>
          </div>
        </div>
        {lookalikeError && (
          <p className="text-[13px] text-[#B3402A]">{lookalikeError}</p>
        )}

        {companies.length === 0 && (
          <p className="rounded-[10px] border border-line bg-white px-5 py-6 text-[13.5px] text-[#55513F]">
            {lookalikeStatus === "loading"
              ? "Searching for lookalikes…"
              : "No lookalikes yet. Click “Find lookalikes” to search."}
          </p>
        )}

        <div className="overflow-hidden rounded-[10px] border border-line bg-white">
          <div className="grid grid-cols-[34px_minmax(0,2fr)_76px_minmax(0,1.1fr)_minmax(0,1.1fr)] gap-3.5 border-b border-[#E8E2D5] bg-paper px-[18px] py-[11px] font-mono text-[9.5px] tracking-[0.11em] text-muted uppercase">
            <input
              type="checkbox"
              aria-label="Select all companies"
              title={allVisiblePicked ? "Deselect all shown companies" : "Select all shown companies"}
              className="size-[17px] cursor-pointer accent-teal disabled:cursor-default"
              checked={allVisiblePicked}
              ref={(el) => {
                if (el) el.indeterminate = someVisiblePicked && !allVisiblePicked;
              }}
              disabled={filtered.length === 0}
              onChange={(e) =>
                setPickedMany(
                  filtered.map((c) => c.id),
                  e.target.checked
                )
              }
            />
            <span>Company</span>
            <span>Score</span>
            <span>Headcount</span>
            <span>Region</span>
          </div>

          {filtered.map((c) => {
            const isPicked = !!picked[c.id];
            return (
              <div
                key={c.id}
                className="grid grid-cols-[34px_minmax(0,2fr)_76px_minmax(0,1.1fr)_minmax(0,1.1fr)] items-center gap-3.5 border-b border-[#F0EBE0] px-[18px] py-[13px]"
              >
                <button
                  onClick={() => togglePicked(c.id)}
                  className={`grid h-[17px] w-[17px] cursor-pointer place-items-center rounded border text-[10px] text-paper ${
                    isPicked ? "border-teal bg-teal" : "border-[#C9C2B0] bg-white"
                  }`}
                >
                  {isPicked ? "✓" : ""}
                </button>
                <RowLink id={c.id}>
                  <div className="min-w-0">
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold">
                      {c.name}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-muted">
                      {c.domain}
                    </div>
                  </div>
                  <div
                    className={`font-mono text-sm font-medium ${
                      c.score >= 90 ? "text-teal" : c.score >= 80 ? "text-ink" : "text-muted"
                    }`}
                  >
                    {c.score}
                  </div>
                  <div className="font-mono text-[13px] text-[#55513F]">{formatHeadcount(c.size)}</div>
                  <div className="text-[13px] text-[#55513F]">{regionLabel(c.region)}</div>
                </RowLink>
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-4 flex flex-wrap items-center gap-3.5 rounded-[10px] border border-line bg-white px-[18px] py-[13px] shadow-[0_6px_18px_rgba(23,22,15,0.07)]">
          <span className="font-mono text-xs">
            {pickedCount} companies selected · ~{pickedCount * 3} contacts expected
          </span>
          <Link
            href="/campaigns/new/contacts"
            className="ml-auto cursor-pointer rounded-md bg-teal px-5 py-[11px] text-[13.5px] font-semibold text-paper"
          >
            Find contacts
          </Link>
        </div>
      </div>

      <SelectedPanel
        selected={selected}
        onRemove={togglePicked}
        onClear={() => setPickedMany(selected.map((c) => c.id), false)}
      />
      </div>
    </div>
  );
}

function SelectedPanel({
  selected,
  onRemove,
  onClear,
}: {
  selected: { id: string; name: string }[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <aside className="flex flex-col rounded-[10px] border border-line bg-white lg:sticky lg:top-[92px] lg:max-h-[calc(100vh-120px)]">
      <div className="flex items-center justify-between gap-3 border-b border-[#E8E2D5] px-4 py-3.5">
        <div>
          <div className="font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
            Selected
          </div>
          <div className="mt-0.5 text-[14.5px] font-semibold">
            {selected.length} {selected.length === 1 ? "company" : "companies"}
          </div>
        </div>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="cursor-pointer text-xs text-muted underline"
          >
            Clear all
          </button>
        )}
      </div>
      {selected.length === 0 ? (
        <p className="px-4 py-5 text-[12.5px] text-muted">
          Tick companies in the table and they&apos;ll show up here.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5 overflow-y-auto px-4 py-3.5">
          {selected.map((c) => (
            <span
              key={c.id}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-teal/30 bg-[#E7F0EC] py-1 pr-1.5 pl-3 text-xs text-teal"
            >
              <span className="truncate">{c.name}</span>
              <button
                type="button"
                onClick={() => onRemove(c.id)}
                aria-label={`Remove ${c.name}`}
                className="grid h-4 w-4 flex-none cursor-pointer place-items-center rounded-full text-[13px] leading-none hover:bg-teal hover:text-paper"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </aside>
  );
}

// Companies from Ocean have no detail page yet; only the mock ones do.
function RowLink({ id, children }: { id: string; children: React.ReactNode }) {
  if (id.startsWith("ocean-")) return <div className="contents">{children}</div>;
  return (
    <Link href={`/companies/${id}`} className="contents">
      {children}
    </Link>
  );
}
