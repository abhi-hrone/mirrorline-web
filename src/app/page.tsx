import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-paper md:grid-cols-[1.05fr_0.95fr]">
      <div className="flex min-w-0 flex-col justify-between gap-12 p-8 sm:p-12 lg:p-20">
        <div className="flex items-center gap-2.5">
          <div className="relative h-[22px] w-[22px] rounded-[3px] border-2 border-teal">
            <div className="absolute inset-y-[3px] inset-x-[3px] bg-accent" />
          </div>
          <span className="font-mono text-[13px] font-bold tracking-[0.14em] uppercase">
            Mirrorline
          </span>
        </div>

        <div className="max-w-[520px]">
          <div className="mb-5 font-mono text-[11px] tracking-[0.16em] text-teal uppercase">
            Referral-led outbound
          </div>
          <h1 className="mb-[22px] font-serif text-[clamp(38px,5.2vw,62px)] leading-[1.02] tracking-[-0.02em]">
            Every happy customer is a list of companies you haven&apos;t
            called yet.
          </h1>
          <p className="text-base leading-relaxed text-[#55513F]">
            Onboarding closes a customer out. Marketing captures what was
            delivered. Ocean finds the companies that look the same. The
            sequence writes itself from the proof, and the rep who sourced it
            gets credited when it converts.
          </p>
        </div>

        <div className="flex flex-wrap gap-7 font-mono text-[11px] tracking-[0.08em] text-muted uppercase">
          <span>Ocean.io</span>
          <span>Findymail</span>
          <span>Microsoft Entra</span>
        </div>
      </div>

      <div className="flex min-w-0 items-center bg-ink p-8 text-paper sm:p-12 lg:p-16">
        <div className="mx-auto w-full max-w-[380px]">
          <h2 className="mb-2 text-[22px] font-semibold tracking-[-0.01em]">
            Sign in to your workspace
          </h2>
          <p className="mb-8 text-sm leading-relaxed text-[#9C978A]">
            Use your work account. Access follows your Microsoft groups.
          </p>

          <Link
            href="/campaigns"
            className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-md bg-paper px-[18px] py-[15px] text-[15px] font-semibold text-ink transition-transform hover:-translate-y-px"
          >
            <span className="grid grid-cols-2 grid-rows-2 gap-0.5">
              <span className="h-[9px] w-[9px] bg-[#F25022]" />
              <span className="h-[9px] w-[9px] bg-[#7FBA00]" />
              <span className="h-[9px] w-[9px] bg-[#00A4EF]" />
              <span className="h-[9px] w-[9px] bg-[#FFB900]" />
            </span>
            Continue with Microsoft
          </Link>

          <div className="mt-5 rounded-md border border-[#332F22] p-3.5 font-mono text-[11px] leading-[1.7] text-muted">
            <div>tenant &nbsp;&middot;&nbsp; northbeam.co</div>
            <div>scopes &nbsp;&middot;&nbsp; User.Read, Group.Read.All</div>
          </div>

          <p className="mt-7 text-xs leading-relaxed text-[#6B6758]">
            Campaign sending stays off until a sequence is approved by a
            named owner.
          </p>
        </div>
      </div>
    </div>
  );
}
