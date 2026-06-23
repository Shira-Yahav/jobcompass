"use client";

import { useJobStore } from "@/store/jobStore";
import { useResultsStore } from "@/store/resultsStore";
import { GlobalInputBar } from "@/components/layout/GlobalInputBar";
import { ScoreCard } from "@/components/features/ScoreCard";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  Briefcase, Loader2, CheckCircle2, AlertTriangle,
  ArrowRight, RefreshCw, Link2, Lock, Zap,
} from "lucide-react";

export default function PositionResearchPage() {
  const { companyName, jobDescription, sessionId } = useJobStore();
  const { positionResearch: result, loadingPosition: loading, runPositionResearch } = useResultsStore();

  function handleResearch() {
    if (!jobDescription.trim()) {
      toast.error("Paste a job description in the Active Target above first.");
      return;
    }
    runPositionResearch(companyName, jobDescription, sessionId, (msg) => toast.error(msg));
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <GlobalInputBar />

      {/* Page header */}
      <div className="border-b border-slate-200 px-6 py-5 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Briefcase className="h-4 w-4 text-indigo-500" />
              <h1 className="text-[15px] font-semibold text-slate-900">Position Research</h1>
            </div>
            <p className="text-[13px] text-slate-500 pl-6">
              How well this role matches your preferences and experience.
            </p>
          </div>
          <Tooltip content={result ? "Re-run analysis for a fresh perspective" : "Analyse this position against your profile"}>
            <button
              onClick={handleResearch}
              disabled={loading}
              className={`
                flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium shrink-0
                transition-all disabled:opacity-50 disabled:cursor-not-allowed
                ${result
                  ? "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:shadow-sm"
                  : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm shadow-indigo-200"}
              `}
            >
              {loading ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analysing…</>
              ) : result ? (
                <><RefreshCw className="h-3.5 w-3.5" /> Regenerate</>
              ) : (
                <><Zap className="h-3.5 w-3.5" /> Analyse position</>
              )}
            </button>
          </Tooltip>
        </div>

        {/* URL import — coming soon */}
        <div className="mt-4">
          <div className="relative flex gap-2 opacity-40 pointer-events-none select-none">
            <div className="relative flex-1">
              <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="url"
                placeholder="Paste a job posting URL to auto-fill…"
                disabled
                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 py-2.5 text-[13px] text-slate-400 placeholder:text-slate-300 outline-none cursor-not-allowed"
              />
            </div>
            <button
              disabled
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-400 shrink-0 cursor-not-allowed"
            >
              <Link2 className="h-3.5 w-3.5" />
              Extract
            </button>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-slate-300" />
            <span className="text-[11px] text-slate-400 font-mono">
              URL auto-extraction —{" "}
              <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-mono font-bold text-amber-700 tracking-widest uppercase">
                coming soon
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="flex flex-col gap-4 max-w-2xl">

          {!result && !loading && (
            <div className="flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 gap-3 text-center">
              <Briefcase className="h-8 w-8 text-slate-200" />
              <div>
                <p className="text-[13px] font-medium text-slate-400">No analysis yet</p>
                <p className="text-[12px] text-slate-300 mt-0.5">Paste a job description above, then click Analyse position</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex h-44 flex-col items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
              <div className="text-center">
                <p className="text-[13px] font-medium text-slate-600">Analysing fit…</p>
                <p className="text-[12px] text-slate-400 mt-0.5 font-mono">Comparing role · Scoring profile · Identifying gaps</p>
              </div>
            </div>
          )}

          {result && (
            <>
              {/* Role summary */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2.5">
                  <Briefcase className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400">
                    Role summary
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed text-slate-600">{result.role_summary}</p>
              </div>

              {/* Score chips */}
              <div className="flex flex-wrap gap-3">
                <ScoreCard title="Preference match" score={result.preference_match} />
                <ScoreCard title="Experience match" score={result.experience_match} />
              </div>

              {/* Strengths + Gaps */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {result.key_strengths?.length > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-emerald-700/70">Strengths</span>
                      <span className="ml-auto text-[11px] font-mono font-bold tabular-nums text-emerald-700">{result.key_strengths.length}</span>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {result.key_strengths.map((s, i) => (
                        <li key={i} className="flex gap-2 text-[12px] text-slate-600">
                          <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.key_gaps?.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-amber-700/70">Gaps</span>
                      <span className="ml-auto text-[11px] font-mono font-bold tabular-nums text-amber-700">{result.key_gaps.length}</span>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {result.key_gaps.map((g, i) => (
                        <li key={i} className="flex gap-2 text-[12px] text-slate-600">
                          <span className="text-amber-500 mt-0.5 shrink-0">✗</span>{g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Actionable advice */}
              {result.actionable_advice?.length > 0 && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowRight className="h-3.5 w-3.5 text-indigo-600" />
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-indigo-700/70">
                      How to improve your chances
                    </span>
                  </div>
                  <ol className="flex flex-col gap-2.5">
                    {result.actionable_advice.map((advice, i) => (
                      <li key={i} className="flex gap-3 text-[13px] text-slate-700">
                        <span className="shrink-0 h-5 w-5 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-[10px] font-bold font-mono text-indigo-600">
                          {i + 1}
                        </span>
                        {advice}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
