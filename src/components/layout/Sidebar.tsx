"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { User, Building2, Briefcase, FileText, LogOut, Compass } from "lucide-react";

const NAV_ITEMS = [
  { href: "/profile",           label: "My Profile",          icon: User },
  { href: "/company-research",  label: "Company Research",     icon: Building2 },
  { href: "/position-research", label: "Position Research",    icon: Briefcase },
  { href: "/tailor-resume",     label: "Tailor Resume",        icon: FileText },
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
    <aside className="flex h-screen w-52 shrink-0 flex-col border-r border-slate-200 bg-white px-2.5 py-5">
      {/* Brand */}
      <div className="mb-7 flex items-center gap-2.5 px-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600">
          <Compass className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-[13px] font-semibold leading-none text-slate-900">
            JobCompass
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">AI job search</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon
                className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-colors",
                  active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[12px] font-medium text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out
      </button>
    </aside>
  );
}
