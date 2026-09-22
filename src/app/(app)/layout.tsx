import TopNav from "@/components/TopNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex-1 bg-canvas">
      <main className="pb-[72px]">
        <TopNav />
        {children}
      </main>
    </div>
  );
}
