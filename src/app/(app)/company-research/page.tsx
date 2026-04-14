"use client";

import { useState } from "react";
import { useJobStore } from "@/store/jobStore";
import { useResultsStore } from "@/store/resultsStore";
import { GlobalInputBar } from "@/components/layout/GlobalInputBar";
import { ScoreCard } from "@/components/features/ScoreCard";
import { toast } from "sonner";
import {
  Building2, Loader2, Users, TrendingUp, ExternalLink,
  DollarSign, CalendarDays, Layers, Globe, Cpu, RefreshCw,
} from "lucide-react";
import type { CompanyResearch } from "@/types";

export default function CompanyResearchPage() {
  const { companyName } = useJobStore();
  const { companyResearch: result, setCompanyResearch } = useResultsStore();
  const [loading, setLoading] = useState(false);

  async function handleResearch() {
    if (!companyName.trim()) {
      toast.error("Enter a company name above first.");
      return;
    }
    setLoading(true);
    setCompanyResearch(null);

    const res = await fetch("/api/research-company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName }),
    });

    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Something went wrong.");
    } else {
      setCompanyResearch(data as CompanyResearch);
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col h-full">
      <GlobalInputBar />

      {/* Page header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold text-slate-900">Company Research</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Real-time intelligence on any company, scored against your preferences.
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
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Researching…</>
          ) : result ? (
            <><RefreshCw className="h-3.5 w-3.5" /> Regenerate</>
          ) : (
            <><Building2 className="h-3.5 w-3.5" /> Research{companyName ? ` "${companyName}"` : ""}</>
          )}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 pb-10">
        {/* Empty state */}
        {!result && !loading && (
          <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-slate-200 text-[13px] text-slate-400">
            Enter a company name above and click Research.
          </div>
        )}

        {loading && (
          <div className="flex h-52 items-center justify-center gap-2 text-[13px] text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            Fetching data and analysing…
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-4 max-w-2xl">

            {/* ── Company header ─────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-semibold text-slate-900 leading-tight">
                  {result.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  {result.company_type && result.company_type !== "unknown" && (
                    <Badge>{result.company_type}</Badge>
                  )}
                  {result.funding_stage && result.funding_stage !== "unknown" && (
                    <Badge variant="indigo">{result.funding_stage}</Badge>
                  )}
                </div>
              </div>
              <div className="shrink-0 pt-1">
                <ScoreCard title="Profile fit" score={result.fit_score} />
              </div>
            </div>

            {/* ── Key stats ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat
                icon={Users}
                label="Employees"
                value={result.company_size && result.company_size !== "unknown" ? result.company_size : "—"}
              />
              <Stat
                icon={DollarSign}
                label="Total raised"
                value={result.total_raised && result.total_raised !== "unknown" ? result.total_raised : "—"}
              />
              <Stat
                icon={CalendarDays}
                label="Last round"
                value={result.last_round_date && result.last_round_date !== "unknown" ? result.last_round_date : "—"}
              />
              <Stat
                icon={TrendingUp}
                label="Investors"
                value={result.key_investors?.length > 0 ? `${result.key_investors.length} known` : "—"}
              />
            </div>

            {/* ── Investors chips ─────────────────────────────────────────── */}
            {result.key_investors?.length > 0 && (
              <Section icon={TrendingUp} title="Key investors">
                <div className="flex flex-wrap gap-1.5">
                  {result.key_investors.map((inv) => (
                    <span
                      key={inv}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[12px] font-medium text-slate-700"
                    >
                      {inv}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* ── What they do ─────────────────────────────────────────────── */}
            <Section icon={Globe} title="What they do">
              <p className="text-[13px] leading-relaxed text-slate-600">
                {result.solution_summary}
              </p>
            </Section>

            {/* ── Value prop + Problem ─────────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Section icon={Layers} title="Value proposition">
                <p className="text-[13px] leading-relaxed text-slate-600">{result.value_proposition}</p>
              </Section>
              <Section icon={Layers} title="Problem they solve">
                <p className="text-[13px] leading-relaxed text-slate-600">{result.problem_solved}</p>
              </Section>
            </div>

            {/* ── GTM + Tech ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Section icon={Users} title="Go-to-market">
                <p className="text-[13px] leading-relaxed text-slate-600">{result.gtm_strategy}</p>
              </Section>
              {result.technology_stack && (
                <Section icon={Cpu} title="Technology">
                  <p className="text-[13px] leading-relaxed text-slate-600">{result.technology_stack}</p>
                </Section>
              )}
            </div>

            {/* ── Sources ─────────────────────────────────────────────────── */}
            {result.sources?.length > 0 && (
              <Section icon={ExternalLink} title="Sources">
                <div className="flex flex-col gap-1">
                  {result.sources.map((src, i) => (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[12px] text-indigo-600 hover:text-indigo-800 hover:underline w-fit"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                      <span className="truncate">{src.title || src.url}</span>
                    </a>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "indigo" }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium
      ${variant === "indigo"
        ? "border border-indigo-200 bg-indigo-50 text-indigo-700"
        : "border border-slate-200 bg-slate-100 text-slate-600"}`}>
      {children}
    </span>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3 w-3 text-slate-400" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <p className="text-[13px] font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{title}</span>
      </div>
      {children}
    </div>
  );
}
