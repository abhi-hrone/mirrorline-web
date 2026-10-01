import { cookies } from "next/headers";
import TopNav from "@/components/TopNav";
import { SESSION_COOKIE, readSessionToken } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // The proxy has already turned away anyone without a valid session.
  const user = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);

  return (
    <div className="min-h-screen flex-1 bg-canvas">
      <main className="pb-[72px]">
        <TopNav userName={user?.name ?? "User"} />
        {children}
      </main>
    </div>
  );
}
