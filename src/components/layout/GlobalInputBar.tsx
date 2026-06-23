"use client";

import { useJobStore } from "@/store/jobStore";
import { Target, Building2, FileText } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

export function GlobalInputBar() {
  const { companyName, jobDescription, setCompanyName, setJobDescription } =
    useJobStore();

  return (
    <div className="border-b border-slate-200 bg-slate-50 px-6 py-3 shrink-0">
      {/* Label row */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <div className="flex h-4 w-4 items-center justify-center rounded bg-indigo-600">
          <Target className="h-2.5 w-2.5 text-white" />
        </div>
        <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-indigo-600">
          Active Target
        </span>
        {(companyName || jobDescription) && (
          <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        )}
      </div>

      {/* Inputs */}
      <div className="flex gap-2">
        <Tooltip content="Company you're targeting" side="bottom">
          <div className="relative w-48 shrink-0">
            <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="
                h-9 w-full rounded-md border border-slate-200 bg-white
                pl-8 pr-3 text-[13px] text-slate-900
                placeholder:text-slate-400 outline-none
                focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200
                transition-colors shadow-sm
              "
            />
          </div>
        </Tooltip>

        <Tooltip content="Paste the full job description" side="bottom">
          <div className="relative flex-1">
            <FileText className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <textarea
              placeholder="Paste the job description here…"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={2}
              className="
                w-full rounded-md border border-slate-200 bg-white
                pl-8 pr-3 py-2 text-[13px] text-slate-900
                placeholder:text-slate-400 outline-none
                focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200
                resize-none overflow-y-auto max-h-28 transition-colors shadow-sm
              "
            />
          </div>
        </Tooltip>
      </div>
    </div>
  );
}
