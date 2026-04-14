"use client";

import { useEffect, useState } from "react";
import { History, Building2, Briefcase, FileText, ChevronDown, ChevronUp, Loader2, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ScoreCard } from "@/components/features/ScoreCard";
import type { HistoryEntry } from "@/types";

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setEntries(data);
      })
      .catch(() => toast.error("Could not load history."))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/history/${id}`, { method: "DELETE" });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
        if (expanded === id) setExpanded(null);
      } else {
        toast.error("Could not delete entry.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setDeleting(null);
    }
  }

  function toggle(id: string) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-slate-200 px-6 py-5 shrink-0">
        <div className="flex items-center gap-2 mb-0.5">
          <History className="h-4 w-4 text-slate-400" />
          <h1 className="text-[15px] font-semibold text-slate-900">History</h1>
        </div>
        <p className="text-[13px] text-slate-500">All your past job searches and analysis results.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading && (
          <div className="flex h-40 items-center justify-center gap-2 text-[13px] text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            Loading history…
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 text-[13px] text-slate-400">
            No searches yet — run Company Research or Position Research to start building history.
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div className="flex flex-col gap-3 max-w-2xl">
            {entries.map((entry) => (
              <HistoryCard
                key={entry.id}
                entry={entry}
                isExpanded={expanded === entry.id}
                isDeleting={deleting === entry.id}
                onToggle={() => toggle(entry.id)}
                onDelete={() => handleDelete(entry.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── History Card ─────────────────────────────────────────────────────────────

function HistoryCard({
  entry,
  isExpanded,
  isDeleting,
  onToggle,
  onDelete,
}: {
  entry: HistoryEntry;
  isExpanded: boolean;
  isDeleting: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const date = new Date(entry.updated_at).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Card header — always visible */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[14px] font-semibold text-slate-900 truncate">
              {entry.company_name || "Unknown company"}
            </p>
            {entry.job_title && (
              <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 truncate max-w-[200px]">
                {entry.job_title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400">{date}</span>
            <div className="flex gap-1.5">
              {entry.company_research && (
                <AnalysisBadge icon={Building2} label="Company" color="indigo" />
              )}
              {entry.position_research && (
                <AnalysisBadge icon={Briefcase} label="Position" color="emerald" />
              )}
              {entry.tailored_resume && (
                <AnalysisBadge icon={FileText} label="Resume" color="amber" />
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            disabled={isDeleting}
            className="rounded-md p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-400 disabled:opacity-40"
          >
            {isDeleting
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Trash2 className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={onToggle}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
          >
            {isExpanded
              ? <ChevronUp className="h-3.5 w-3.5" />
              : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 flex flex-col gap-4">

          {/* Company Research */}
          {entry.company_research && (
            <Section title="Company Research" icon={Building2}>
              <div className="flex items-start gap-3 flex-wrap mb-3">
                <ScoreCard title="Profile fit" score={entry.company_research.fit_score} />
                {entry.company_research.funding_stage && entry.company_research.funding_stage !== "unknown" && (
                  <Chip>{entry.company_research.funding_stage}</Chip>
                )}
                {entry.company_research.company_size && entry.company_research.company_size !== "unknown" && (
                  <Chip>{entry.company_research.company_size}</Chip>
                )}
                {entry.company_research.total_raised && entry.company_research.total_raised !== "unknown" && (
                  <Chip>{entry.company_research.total_raised} raised</Chip>
                )}
              </div>
              <p className="text-[12px] leading-relaxed text-slate-600">
                {entry.company_research.solution_summary}
              </p>
              {entry.company_research.sources?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {entry.company_research.sources.map((src, i) => (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] text-indigo-600 hover:underline"
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                      {src.title || src.url}
                    </a>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Position Research */}
          {entry.position_research && (
            <Section title="Position Research" icon={Briefcase}>
              <p className="text-[12px] leading-relaxed text-slate-600 mb-3">
                {entry.position_research.role_summary}
              </p>
              <div className="flex flex-wrap gap-3 mb-3">
                <ScoreCard title="Preference match" score={entry.position_research.preference_match} />
                <ScoreCard title="Experience match" score={entry.position_research.experience_match} />
              </div>
              {entry.position_research.key_strengths?.length > 0 && (
                <div className="mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600 mb-1.5">Strengths</p>
                  <ul className="flex flex-col gap-1">
                    {entry.position_research.key_strengths.map((s, i) => (
                      <li key={i} className="flex gap-1.5 text-[12px] text-slate-600">
                        <span className="text-emerald-500 shrink-0">✓</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {entry.position_research.key_gaps?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 mb-1.5">Gaps</p>
                  <ul className="flex flex-col gap-1">
                    {entry.position_research.key_gaps.map((g, i) => (
                      <li key={i} className="flex gap-1.5 text-[12px] text-slate-600">
                        <span className="text-amber-500 shrink-0">✗</span> {g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>
          )}

          {/* Tailored Resume */}
          {entry.tailored_resume && (
            <Section title="Tailored Resume" icon={FileText}>
              <div className="flex items-center gap-3 mb-3">
                <ScoreCard title="Interview likelihood" score={entry.tailored_resume.interview_likelihood} />
              </div>
              {entry.tailored_resume.changes_summary && (
                <p className="text-[12px] leading-relaxed text-slate-600 mb-3">
                  {entry.tailored_resume.changes_summary}
                </p>
              )}
              <div className="prose prose-sm max-w-none
                prose-headings:text-slate-900 prose-headings:font-semibold
                prose-h2:text-[13px] prose-h2:mt-3 prose-h2:mb-1
                prose-p:text-slate-600 prose-p:text-[12px] prose-p:leading-relaxed
                prose-li:text-slate-600 prose-li:text-[12px]
                [&>*:first-child]:mt-0">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {entry.tailored_resume.resume_markdown}
                </ReactMarkdown>
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function AnalysisBadge({ icon: Icon, label, color }: { icon: React.ElementType; label: string; color: "indigo" | "emerald" | "amber" }) {
  const colors = {
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-600",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-600",
    amber: "border-amber-200 bg-amber-50 text-amber-600",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${colors[color]}`}>
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
      {children}
    </span>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2.5">
        <Icon className="h-3 w-3 text-slate-400" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{title}</span>
      </div>
      {children}
    </div>
  );
}
