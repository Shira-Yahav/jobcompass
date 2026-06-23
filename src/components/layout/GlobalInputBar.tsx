"use client";

import { useJobStore } from "@/store/jobStore";
import { useResultsStore } from "@/store/resultsStore";
import { Target, Building2, FileText, Play, Loader2, Link2 } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useRouter, usePathname } from "next/navigation";

export function GlobalInputBar() {
  const { companyName, jobDescription, sessionId, setCompanyName, setJobDescription } = useJobStore();
  const { loadingCompany, loadingPosition, runCompanyResearch, runPositionResearch } = useResultsStore();
  const router = useRouter();
  const pathname = usePathname();

  const loading = loadingCompany || loadingPosition;
  const hasCompany = companyName.trim().length > 0;
  const hasJD = jobDescription.trim().length > 0;

  function handleRun() {
    if (!hasCompany && !hasJD) {
      toast.error("Enter a company name or job description first.");
      return;
    }
    if (!hasCompany && hasJD) {
      toast.error("Add a company name to run.");
      return;
    }

    if (hasCompany && hasJD) {
      if (pathname !== "/position-research") router.push("/position-research");
      runPositionResearch(companyName, jobDescription, sessionId, (msg) => toast.error(msg));
    } else {
      if (pathname !== "/company-research") router.push("/company-research");
      runCompanyResearch(companyName, sessionId, (msg) => toast.error(msg));
    }
  }

  const runTooltip = !hasCompany && hasJD
    ? "Add a company name to run"
    : hasCompany && hasJD
      ? "Run position analysis"
      : "Run company research";

  return (
    <div className="border-b border-slate-200 bg-slate-50 px-6 py-3 shrink-0">
      {/* Label row */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <div className="flex h-4 w-4 items-center justify-center rounded bg-indigo-500">
          <Target className="h-2.5 w-2.5 text-white" />
        </div>
        <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-indigo-500">
          Active Target
        </span>
        {(hasCompany || hasJD) && (
          <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        )}
      </div>

      {/* Inputs + Run */}
      <div className="flex gap-2 items-start">
        {/* Company name */}
        <div className="relative w-48 shrink-0">
          <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Company name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleRun(); }}
            className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 transition-colors shadow-sm"
          />
        </div>

        {/* Job description + URL icon */}
        <div className="relative flex-1">
          <FileText className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <textarea
            placeholder="Paste the job description here…"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-200 bg-white pl-8 pr-9 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 resize-none overflow-y-auto max-h-28 transition-colors shadow-sm"
          />
          {/* URL import — coming soon */}
          <Tooltip content="URL import — coming soon" side="left">
            <button
              disabled
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-300 cursor-not-allowed opacity-60"
            >
              <Link2 className="h-3 w-3" />
            </button>
          </Tooltip>
        </div>

        {/* Run button */}
        <Tooltip content={runTooltip} side="left">
          <button
            onClick={handleRun}
            disabled={loading}
            className="flex h-9 items-center gap-1.5 rounded-md bg-indigo-500 px-4 text-[13px] font-semibold text-white shadow-sm shadow-indigo-200 transition-all hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {loading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Play className="h-3.5 w-3.5" />}
            Run
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
