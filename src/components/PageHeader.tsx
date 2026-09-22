export default function PageHeader({
  crumb,
  title,
  right,
}: {
  crumb: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-[5] flex flex-wrap items-center gap-5 border-b border-line bg-canvas/93 px-5 py-4 backdrop-blur-sm sm:px-10">
      <div className="min-w-0 flex-1 basis-[260px]">
        <div className="font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase">
          {crumb}
        </div>
        <h1 className="mt-[3px] text-xl font-semibold tracking-[-0.015em]">
          {title}
        </h1>
      </div>
      {right}
    </header>
  );
}
