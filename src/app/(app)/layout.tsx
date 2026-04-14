// All app pages require authentication; must never be statically prerendered.
export const dynamic = "force-dynamic";

import { Sidebar } from "@/components/layout/Sidebar";

/**
 * Authenticated app shell.
 * GlobalInputBar is NOT here — it only renders inside the pages that need it
 * (Company Research, Position Research, Tailor Resume). Profile does not need it.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
