"use client";

import { useState } from "react";
import Link from "next/link";
import { CONTACT_CONFIDENCE_STYLES } from "@/lib/mock-data";
import { pickedCompanies, useWizard } from "@/lib/wizard-context";

export default function ContactsPage() {
  const {
    contactGroups,
    contactStatus,
    contactError,
    findContacts,
    selectedContacts,
    toggleContactSelected,
    setContactsSelected,
    revealStatus,
    revealError,
    revealSelected,
    removeContact,
    addContact,
    companies,
    picked,
  } = useWizard();
  const pickedCount = pickedCompanies(companies, picked).length;
  const totalContacts = contactGroups.reduce((n, g) => n + g.people.length, 0);
  // Only contacts that came from a search (have an id) and don't have an email
  // yet can be selected for reveal; revealed and manually added ones can't.
  const revealable = (g: (typeof contactGroups)[number]) =>
    g.people.flatMap((p) => (p.id && !p.email && p.revealStatus !== "pending" ? [p.id] : []));
  const allRevealableIds = contactGroups.flatMap(revealable);
  const selectedCount = allRevealableIds.filter((id) => selectedContacts[id]).length;
  const revealedCount = contactGroups.reduce(
    (n, g) => n + g.people.filter((p) => p.email).length,
    0
  );

  return (
    <div className="px-5 pt-[22px] sm:px-10 sm:pt-[38px]">
      <div className="flex max-w-[980px] flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3.5">
          <p className="text-sm text-[#6E6A5C]">
            {totalContacts} contacts across {contactGroups.length} companies · {revealedCount} emails
            revealed
          </p>
          <button
            onClick={findContacts}
            disabled={contactStatus === "loading" || pickedCount === 0}
            className="ml-auto cursor-pointer rounded-md bg-teal px-4 py-2 text-[12.5px] font-semibold text-paper disabled:opacity-60"
          >
            {contactStatus === "loading"
              ? "Searching…"
              : `Find contacts at ${pickedCount} ${pickedCount === 1 ? "company" : "companies"}`}
          </button>
        </div>
        {contactError && <p className="text-[13px] text-[#B3402A]">{contactError}</p>}
        {contactGroups.length > 0 && (
          <div className="flex flex-wrap items-center gap-3.5 rounded-[10px] border border-line bg-white px-5 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#55513F]">
              <input
                type="checkbox"
                className="size-4 cursor-pointer accent-teal"
                checked={allRevealableIds.length > 0 && selectedCount === allRevealableIds.length}
                disabled={allRevealableIds.length === 0}
                onChange={(e) => setContactsSelected(allRevealableIds, e.target.checked)}
              />
              Select all
            </label>
            <span className="text-[12.5px] text-muted">
              {selectedCount} selected · emails are only revealed for ticked contacts
            </span>
            <button
              onClick={revealSelected}
              disabled={revealStatus === "loading" || selectedCount === 0}
              className="ml-auto cursor-pointer rounded-md bg-teal px-4 py-2 text-[12.5px] font-semibold text-paper disabled:opacity-60"
            >
              {revealStatus === "loading"
                ? "Revealing…"
                : `Reveal emails for ${selectedCount} selected`}
            </button>
            {revealError && (
              <p className="basis-full text-[13px] text-[#B3402A]">{revealError}</p>
            )}
          </div>
        )}
        {contactGroups.length === 0 && !contactError && (
          <p className="rounded-[10px] border border-line bg-white px-5 py-6 text-[13.5px] text-[#55513F]">
            {pickedCount === 0
              ? "No companies selected. Pick some on the Lookalikes step first."
              : "Click “Find contacts” to list people at the selected companies. Emails are revealed in a second step, only for the contacts you tick."}
          </p>
        )}

        {contactGroups.map((group) => (
          <div
            key={group.domain}
            className="overflow-hidden rounded-[10px] border border-line bg-white"
          >
            <div className="flex flex-wrap items-center gap-3.5 border-b border-[#E8E2D5] bg-paper px-5 py-3.5">
              <div className="min-w-0">
                <div className="text-[15px] font-semibold tracking-[-0.01em]">
                  {group.company}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-muted">
                  {group.domain}
                </div>
              </div>
              <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[11.5px] text-[#6E6A5C]">
                <input
                  type="checkbox"
                  className="size-3.5 cursor-pointer accent-teal"
                  checked={
                    revealable(group).length > 0 &&
                    revealable(group).every((id) => selectedContacts[id])
                  }
                  disabled={revealable(group).length === 0}
                  onChange={(e) => setContactsSelected(revealable(group), e.target.checked)}
                />
                Select company
              </label>
              <span className="font-mono text-[11px] text-[#6E6A5C]">
                {group.people.length} contacts
              </span>
              <span className="font-mono text-[11px] text-teal">
                {group.score}
              </span>
            </div>

            {group.people.map((p, i) => (
              <div
                key={p.id ?? `${p.name}-${i}`}
                className="grid grid-cols-[18px_minmax(0,0.95fr)_minmax(0,1fr)_minmax(0,1.05fr)_minmax(0,0.85fr)_60px_82px_28px] items-center gap-3.5 border-b border-[#F0EBE0] px-5 py-3"
              >
                <input
                  type="checkbox"
                  className="size-4 cursor-pointer accent-teal disabled:cursor-default"
                  // Already revealed / manually added contacts show as ticked but
                  // locked; pending ones are mid-reveal.
                  checked={!!p.email || !!(p.id && selectedContacts[p.id])}
                  disabled={!p.id || !!p.email || p.revealStatus === "pending"}
                  onChange={() => p.id && toggleContactSelected(p.id)}
                  title={p.email ? "Email already revealed" : `Reveal email for ${p.name}`}
                />
                <span className="min-w-0 overflow-hidden text-ellipsis text-[13.5px] font-semibold">
                  {p.name}
                </span>
                <span className="min-w-0 text-[13px] text-[#55513F]">
                  {p.title}
                </span>
                <span className="min-w-0 overflow-hidden text-ellipsis font-mono text-[11.5px] text-teal">
                  {p.email || (p.revealStatus === "pending" ? "Revealing…" : "—")}
                </span>
                <span className="min-w-0 overflow-hidden text-ellipsis font-mono text-[11.5px] text-[#55513F]">
                  {p.phone || (p.revealStatus === "pending" ? "Revealing…" : "—")}
                </span>
                <span className="min-w-0 text-[11.5px]">
                  {p.linkedin ? (
                    <a href={p.linkedin} target="_blank" rel="noreferrer" className="text-teal underline">
                      LinkedIn
                    </a>
                  ) : (
                    "—"
                  )}
                </span>
                <span
                  className={`rounded-full px-[7px] py-[3px] text-center font-mono text-[9.5px] tracking-[0.08em] uppercase ${CONTACT_CONFIDENCE_STYLES[p.conf]}`}
                >
                  {p.conf}
                </span>
                <button
                  onClick={() => removeContact(group.domain, i)}
                  title={`Remove ${p.name}`}
                  className="cursor-pointer justify-self-end rounded-md px-1.5 py-1 text-[13px] text-[#9C978A] hover:bg-[#F0EBE0] hover:text-[#B3402A]"
                >
                  ×
                </button>
              </div>
            ))}

            <AddContactRow domain={group.domain} onAdd={addContact} />
          </div>
        ))}

        <Link
          href="/campaigns/new/sequence"
          className="cursor-pointer self-start rounded-md bg-teal px-[22px] py-3 text-sm font-semibold text-paper"
        >
          Draft sequence
        </Link>
      </div>
    </div>
  );
}

function AddContactRow({
  domain,
  onAdd,
}: {
  domain: string;
  onAdd: (
    domain: string,
    person: { name: string; title: string; email: string; phone?: string; linkedin?: string }
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const reset = () => {
    setName("");
    setTitle("");
    setEmail("");
    setPhone("");
    setOpen(false);
  };

  const submit = () => {
    if (!name.trim() || !email.trim()) return;
    onAdd(domain, {
      name: name.trim(),
      title: title.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
    });
    reset();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full cursor-pointer px-5 py-2.5 text-left text-[12.5px] font-medium text-teal hover:bg-[#F7F4EC]"
      >
        + Add contact manually
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 border-t border-[#F0EBE0] bg-[#FBF9F3] px-5 py-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        className="min-w-0 flex-1 rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px]"
      />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="min-w-0 flex-1 rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px]"
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        type="email"
        className="min-w-0 flex-1 rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px]"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone (optional)"
        className="min-w-0 flex-1 rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px]"
      />
      <button
        onClick={submit}
        disabled={!name.trim() || !email.trim()}
        className="cursor-pointer rounded-md bg-teal px-3.5 py-1.5 text-[12.5px] font-semibold text-paper disabled:opacity-50"
      >
        Add
      </button>
      <button
        onClick={reset}
        className="cursor-pointer rounded-md px-3 py-1.5 text-[12.5px] text-[#6E6A5C]"
      >
        Cancel
      </button>
    </div>
  );
}
