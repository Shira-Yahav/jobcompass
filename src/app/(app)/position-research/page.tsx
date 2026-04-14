"use client";

import { useState } from "react";
import { useJobStore } from "@/store/jobStore";
import { useResultsStore } from "@/store/resultsStore";
import { GlobalInputBar } from "@/components/layout/GlobalInputBar";
import { ScoreCard } from "@/components/features/ScoreCard";
import { toast } from "sonner";
import { Briefcase, Loader2, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw, Link2, X } from "lucide-react";

export default function PositionResearchPage() {
  const { companyName, jobDescription, sessionId, setCompanyName, setJobDescription } = useJobStore();
  const { positionResearch: result, loadingPosition: loading, runPositionResearch } = useResultsStore();

  const [urlInput, setUrlInput] = useState("");
  const [extracting, setExtracting] = useState(false);

  async function handleExtract() {
    const url = urlInput.trim();
    if (!url) return;
    setExtracting(true);
    try {
      const res = await fetch("/api/extract-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not extract job data from that URL.");
      } else {
        if (data.companyName) setCompanyName(data.companyName);
        if (data.jobDescription) setJobDescription(data.jobDescription);
        toast.success("Job posting extracted — review and edit below.");
        setUrlInput("");
      }
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setExtracting(false);
    }
  }

  function handleResearch() {
    if (!jobDescription.trim()) {
      toast.error("Paste a job description above first.");
      return;
    }
    runPositionResearch(companyName, jobDescription, sessionId, (msg) => toast.error(msg));
  }

  return (
    <div className="flex flex-col h-full">
      <GlobalInputBar />

      {/* Page header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold text-slate-900">Position Research</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            How well this role matches your preferences and experience.
          </p>
        </div>
        <button
          onClick={handleResearch}
          disabled={loading}
          className={`
            flex items-center gap-2 rounded-md px-4 py-2 text-[13px] font-medium
            transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0
            ${result
              ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              : "bg-indigo-600 text-white hover:bg-indigo-500"}
          `}
        >
          {loading ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analysing…</>
          ) : result ? (
            <><RefreshCw className="h-3.5 w-3.5" /> Regenerate</>
          ) : (
            <><Briefcase className="h-3.5 w-3.5" /> Analyse position</>
          )}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 pb-10">
        <div className="flex flex-col gap-4 max-w-2xl">

          {/* ── URL extractor ─────────────────────────────────────────────── */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Import from URL
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="url"
                  placeholder="Paste a job posting URL to auto-fill fields above…"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleExtract(); }}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 transition-colors"
                />
                {urlInput && (
                  <button
                    onClick={() => setUrlInput("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <button
                onClick={handleExtract}
                disabled={extracting || !urlInput.trim()}
                className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-[12px] font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-40 shrink-0"
              >
                {extracting ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Extracting…</>
                ) : (
                  "Extract"
                )}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">
              Or paste the job description directly in the "Active target" bar above.
            </p>
          </div>

          {/* ── Empty / loading state ─────────────────────────────────────── */}
          {!result && !loading && (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 text-[13px] text-slate-400">
              Paste a job description (or import from URL) and click Analyse position.
            </div>
          )}

          {loading && (
            <div className="flex h-40 items-center justify-center gap-2 text-[13px] text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
              Analysing fit against your profile…
            </div>
          )}

          {/* ── Results ─────────────────────────────────────────────────────── */}
          {result && (
            <>
              {/* ── Role summary ─────────────────────────────────────────────── */}
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2.5">
                  <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                    Role summary
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed text-slate-600">{result.role_summary}</p>
              </div>

              {/* ── Score chips ──────────────────────────────────────────────── */}
              <div className="flex flex-wrap gap-3">
                <ScoreCard title="Preference match" score={result.preference_match} />
                <ScoreCard title="Experience match" score={result.experience_match} />
              </div>

              {/* ── Strengths + Gaps (2-col) ─────────────────────────────────── */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {result.key_strengths?.length > 0 && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700/70">
                        Strengths
                      </span>
                      <span className="ml-auto text-[11px] font-semibold tabular-nums text-emerald-700">
                        {result.key_strengths.length}
                      </span>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {result.key_strengths.map((s, i) => (
                        <li key={i} className="flex gap-2 text-[12px] text-slate-600">
                          <span className="text-emerald-600 mt-0.5 shrink-0">✓</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.key_gaps?.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-amber-700/70">
                        Gaps
                      </span>
                      <span className="ml-auto text-[11px] font-semibold tabular-nums text-amber-700">
                        {result.key_gaps.length}
                      </span>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {result.key_gaps.map((g, i) => (
                        <li key={i} className="flex gap-2 text-[12px] text-slate-600">
                          <span className="text-amber-600 mt-0.5 shrink-0">✗</span>
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* ── Actionable advice ────────────────────────────────────────── */}
              {result.actionable_advice?.length > 0 && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowRight className="h-3.5 w-3.5 text-indigo-600" />
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-indigo-700/70">
                      How to improve your chances
                    </span>
                  </div>
                  <ol className="flex flex-col gap-2.5">
                    {result.actionable_advice.map((advice, i) => (
                      <li key={i} className="flex gap-3 text-[13px] text-slate-700">
                        <span className="shrink-0 h-5 w-5 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-[10px] font-bold text-indigo-600">
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
