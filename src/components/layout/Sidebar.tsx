"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Tooltip } from "@/components/ui/tooltip";
import {
  User, Building2, Briefcase, FileText, History, LogOut,
  Compass, ChevronRight,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/profile",           label: "My Profile",       icon: User,      hint: "Your preferences & fit formula" },
  { href: "/company-research",  label: "Company Research", icon: Building2, hint: "AI-powered company intelligence" },
  { href: "/position-research", label: "Position Research",icon: Briefcase, hint: "Score a role against your profile" },
  { href: "/tailor-resume",     label: "Tailor Resume",    icon: FileText,  hint: "AI-rewrite your resume for the role" },
  { href: "/history",           label: "History",          icon: History,   hint: "Past searches & analyses" },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-52 shrink-0 flex-col bg-slate-50 py-4">
      {/* Brand */}
      <div className="mb-6 px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500 shadow-sm shadow-indigo-200">
            <Compass className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-[13px] font-bold leading-none text-slate-900 tracking-tight">
              JobCompass
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400 font-mono uppercase tracking-widest">AI job search</p>
          </div>
        </div>
      </div>

      {/* Section label */}
      <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400 font-mono">
        Navigation
      </p>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon, hint }) => {
          const active = pathname === href;
          return (
            <Tooltip key={href} content={hint} side="right" delayDuration={500}>
              <Link
                href={href}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-all",
                  active
                    ? "bg-white text-indigo-500 shadow-sm shadow-slate-200 border border-slate-200"
                    : "text-slate-500 hover:bg-white/70 hover:text-slate-800 hover:shadow-sm"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r-full bg-indigo-500" />
                )}
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-colors",
                    active ? "text-indigo-500" : "text-slate-400 group-hover:text-slate-600"
                  )}
                />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight className="h-3 w-3 text-indigo-300" />}
              </Link>
            </Tooltip>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="mt-4 border-t border-slate-200 pt-3 px-2">
        <Tooltip content="Sign out of JobCompass" side="right">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[12px] font-medium text-slate-400 transition-colors hover:bg-white hover:text-slate-600 hover:shadow-sm"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
