"use client";

import { useState } from "react";
import { useJobStore } from "@/store/jobStore";
import { useResultsStore } from "@/store/resultsStore";
import { ScoreCard } from "@/components/features/ScoreCard";
import { toast } from "sonner";
import { Briefcase, Loader2, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw, Link2 } from "lucide-react";

export default function PositionResearchPage() {
  const { companyName, jobDescription, sessionId, setCompanyName, setJobDescription } = useJobStore();
  const { positionResearch: result, loadingPosition: loading, runPositionResearch } = useResultsStore();

  const [urlInput, setUrlInput] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  async function extractFromUrl(url: string) {
    const trimmed = url.trim();
    if (!trimmed.startsWith("http")) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const res = await fetch("/api/extract-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setExtractError(data.error ?? "Could not fetch content from this URL.");
      } else {
        if (data.companyName) setCompanyName(data.companyName);
        if (data.jobDescription) setJobDescription(data.jobDescription);
        setExtractError(null);
      }
    } catch {
      setExtractError("Network error — please try again.");
    } finally {
      setExtracting(false);
    }
  }

  function handleUrlPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").trim();
    if (pasted.startsWith("http")) {
      setUrlInput(pasted);
      extractFromUrl(pasted);
      e.preventDefault();
    }
  }

  function handleResearch() {
    if (!jobDescription.trim()) {
      toast.error("Paste a job URL or description first.");
      return;
    }
    if (extracting) {
      toast.error("Still extracting the job posting — please wait a moment.");
      return;
    }
    runPositionResearch(companyName, jobDescription, sessionId, (msg) => toast.error(msg));
  }

  return (
    <div className="flex flex-col h-full">

      {/* Page header */}
      <div className="border-b border-slate-200 px-6 py-5 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[15px] font-semibold text-slate-900">Position Research</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">
              How well this role matches your preferences and experience.
            </p>
          </div>
          <button
            onClick={handleResearch}
            disabled={loading || extracting}
            className={`
              flex items-center gap-2 rounded-md px-4 py-2 text-[13px] font-medium shrink-0
              transition-colors disabled:opacity-50 disabled:cursor-not-allowed
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

        {/* URL input — right below the title */}
        <div className="mt-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              {extracting && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-indigo-500 animate-spin" />
              )}
              <input
                type="url"
                placeholder="Paste a job posting URL to auto-fill fields below…"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onPaste={handleUrlPaste}
                className="w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-9 py-2.5 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:bg-white focus:ring-1 focus:ring-indigo-200 transition-colors"
              />
            </div>
            <button
              onClick={() => extractFromUrl(urlInput)}
              disabled={extracting || !urlInput.trim()}
              className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40 shrink-0"
            >
              {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              {extracting ? "Extracting…" : "Extract"}
            </button>
          </div>
          {extractError ? (
            <p className="mt-1.5 text-[11px] text-red-500">
              {extractError}{" "}
              {extractError.includes("fetch") || extractError.includes("URL") ? (
                <span className="text-slate-400">LinkedIn search pages are blocked — try opening the job post directly and copying that URL, or paste the job description manually below.</span>
              ) : null}
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-slate-400">
              Paste a direct job post URL (not a search results page). Fields below auto-fill, or fill manually.
            </p>
          )}
        </div>

        {/* Editable company + job description fields */}
        <div className="mt-3 flex gap-3">
          <input
            type="text"
            placeholder="Company name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="h-9 w-48 shrink-0 rounded-md border border-slate-200 bg-white px-3 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 transition-colors"
          />
          <textarea
            placeholder="Job description will appear here after extraction, or paste it directly…"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            rows={3}
            className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 resize-none overflow-y-auto max-h-32 transition-colors"
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="flex flex-col gap-4 max-w-2xl">

          {!result && !loading && (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 text-[13px] text-slate-400">
              Paste a URL or job description above, then click Analyse position.
            </div>
          )}

          {loading && (
            <div className="flex h-40 items-center justify-center gap-2 text-[13px] text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
              Analysing fit against your profile…
            </div>
          )}

          {result && (
            <>
              {/* Role summary */}
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2.5">
                  <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
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
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700/70">Strengths</span>
                      <span className="ml-auto text-[11px] font-semibold tabular-nums text-emerald-700">{result.key_strengths.length}</span>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {result.key_strengths.map((s, i) => (
                        <li key={i} className="flex gap-2 text-[12px] text-slate-600">
                          <span className="text-emerald-600 mt-0.5 shrink-0">✓</span>{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.key_gaps?.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-amber-700/70">Gaps</span>
                      <span className="ml-auto text-[11px] font-semibold tabular-nums text-amber-700">{result.key_gaps.length}</span>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {result.key_gaps.map((g, i) => (
                        <li key={i} className="flex gap-2 text-[12px] text-slate-600">
                          <span className="text-amber-600 mt-0.5 shrink-0">✗</span>{g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Actionable advice */}
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
