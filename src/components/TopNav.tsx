"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/campaigns", label: "Campaigns" },
  { href: "/workspace", label: "Workspace" },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "U") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export default function TopNav({ userName }: { userName: string }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap items-center gap-[22px] bg-ink px-5 py-[11px] text-paper sm:px-10">
      <div className="flex items-center gap-[9px]">
        <div className="relative h-[17px] w-[17px] flex-none rounded-[3px] border-2 border-[#3E9384]">
          <div className="absolute inset-y-0.5 inset-x-0.5 bg-accent" />
        </div>
        <span className="font-mono text-[11px] font-bold tracking-[0.14em] uppercase">
          Mirrorline
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-[11px] py-1.5 text-[12.5px] font-medium ${
                active ? "bg-[#3A3626] text-paper" : "text-[#9C978A]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        <span className="text-[12.5px] text-[#B5B0A1]">{userName}</span>
        <div className="grid h-[26px] w-[26px] place-items-center rounded-full bg-teal font-mono text-[10px] font-bold">
          {initials(userName)}
        </div>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="cursor-pointer rounded-md px-[9px] py-1.5 text-[12px] text-[#9C978A] hover:text-paper"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
