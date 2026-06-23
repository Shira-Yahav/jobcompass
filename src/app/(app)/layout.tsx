// All app pages require authentication; must never be statically prerendered.
export const dynamic = "force-dynamic";

import { Sidebar } from "@/components/layout/Sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50">
        <Sidebar />
        <main className="flex flex-1 flex-col overflow-hidden bg-white border-l border-slate-200">
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}
