"use client";

import { useResultsStore } from "@/store/resultsStore";
import { GlobalInputBar } from "@/components/layout/GlobalInputBar";
import { ScoreCard } from "@/components/features/ScoreCard";
import {
  Briefcase, Loader2, CheckCircle2, AlertTriangle, ArrowRight,
} from "lucide-react";

export default function PositionResearchPage() {
  const { positionResearch: result, loadingPosition: loading } = useResultsStore();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <GlobalInputBar />

      {/* Page header */}
      <div className="px-6 pt-5 pb-4 shrink-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Briefcase className="h-4 w-4 text-indigo-500" />
          <h1 className="text-[15px] font-semibold text-slate-900">Position Research</h1>
        </div>
        <p className="text-[13px] text-slate-500 pl-6">
          How well this role matches your preferences and experience.
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="flex flex-col gap-4 max-w-2xl">

          {!result && !loading && (
            <div className="flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 gap-3 text-center">
              <Briefcase className="h-8 w-8 text-slate-200" />
              <div>
                <p className="text-[13px] font-medium text-slate-400">No analysis yet</p>
                <p className="text-[12px] text-slate-300 mt-0.5">Enter a company name and job description above, then click Run</p>
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
