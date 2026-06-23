"use client";

import { useState } from "react";
import { CheckCircle2, MinusCircle, XCircle, HelpCircle, TrendingUp } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Tooltip } from "@/components/ui/tooltip";
import type { FitScore, FitScoreDimension } from "@/types";

interface ScoreCardProps {
  title: string;
  score: FitScore;
}

export function ScoreCard({ title, score }: ScoreCardProps) {
  const [open, setOpen] = useState(false);
  const pct = Math.round(score.score);

  const palette =
    pct >= 70
      ? { bg: "bg-emerald-50", text: "text-emerald-600", bar: "bg-emerald-400", border: "border-emerald-200", glow: "shadow-emerald-100", label: "STRONG FIT" }
      : pct >= 40
        ? { bg: "bg-amber-50", text: "text-amber-600", bar: "bg-amber-400", border: "border-amber-200", glow: "shadow-amber-100", label: "PARTIAL FIT" }
        : { bg: "bg-red-50", text: "text-red-600", bar: "bg-red-400", border: "border-red-200", glow: "shadow-red-100", label: "WEAK FIT" };

  return (
    <>
      <Tooltip content={`Click to see breakdown — ${pct}% ${palette.label.toLowerCase()}`} side="top">
        <button
          onClick={() => setOpen(true)}
          className={`
            group inline-flex items-center gap-3 rounded-xl border px-4 py-2.5
            transition-all hover:shadow-md select-none
            ${palette.bg} ${palette.border} ${palette.glow}
          `}
        >
          {/* Arc-style score indicator */}
          <ScoreRing pct={pct} palette={palette} />

          <div className="text-left">
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-500">{title}</p>
            <p className={`text-[22px] font-bold font-mono tabular-nums leading-none mt-0.5 ${palette.text}`}>
              {pct}<span className="text-[13px] font-semibold opacity-70">%</span>
            </p>
          </div>

          <div className="ml-1 flex flex-col items-end gap-1">
            <span className={`text-[9px] font-mono font-bold uppercase tracking-widest ${palette.text} opacity-60`}>
              {palette.label}
            </span>
            <TrendingUp className={`h-3.5 w-3.5 ${palette.text} opacity-40 group-hover:opacity-80 transition-opacity`} />
          </div>
        </button>
      </Tooltip>

      {/* Detail modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={title} width="max-w-lg">
        {/* Score hero */}
        <div className={`mb-5 rounded-xl border p-5 ${palette.bg} ${palette.border}`}>
          <div className="flex items-center gap-5">
            <ScoreRing pct={pct} palette={palette} size="lg" />
            <div>
              <p className="text-[11px] font-mono font-semibold uppercase tracking-widest text-slate-500 mb-1">Overall score</p>
              <p className={`text-[40px] font-bold font-mono tabular-nums leading-none ${palette.text}`}>
                {pct}<span className="text-[20px] font-semibold opacity-60">%</span>
              </p>
              <span className={`mt-1 inline-block text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${palette.border} ${palette.text} opacity-70`}>
                {palette.label}
              </span>
            </div>
          </div>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/60">
            <div
              className={`h-1.5 rounded-full transition-all duration-700 ${palette.bar}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Per-dimension breakdown */}
        {score.dimensions && score.dimensions.length > 0 && (
          <div className="mb-5">
            <p className="mb-3 text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400">
              Breakdown by dimension
            </p>
            <div className="flex flex-col gap-1">
              {score.dimensions.map((d, i) => (
                <DimensionRow key={i} dimension={d} />
              ))}
            </div>
          </div>
        )}

        {/* Summary explanation */}
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
          <p className="mb-2 text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400">
            Analysis
          </p>
          <p className="text-[13px] leading-relaxed text-slate-600">{score.explanation}</p>
          {score.methodology && (
            <p className="mt-2 text-[11px] text-slate-400 italic">{score.methodology}</p>
          )}
        </div>
      </Modal>
    </>
  );
}

// ─── Score Ring (SVG arc) ─────────────────────────────────────────────────────

function ScoreRing({
  pct,
  palette,
  size = "sm",
}: {
  pct: number;
  palette: { bar: string; border: string };
  size?: "sm" | "lg";
}) {
  const dim = size === "lg" ? 56 : 36;
  const stroke = size === "lg" ? 5 : 3.5;
  const r = (dim - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;

  const colorMap: Record<string, string> = {
    "bg-emerald-400": "#10b981",
    "bg-amber-400": "#fbbf24",
    "bg-red-400": "#f87171",
  };
  const color = colorMap[palette.bar] ?? "#6366f1";

  return (
    <svg width={dim} height={dim} className="shrink-0 -rotate-90">
      <circle
        cx={dim / 2} cy={dim / 2} r={r}
        fill="none" stroke="currentColor"
        strokeWidth={stroke}
        className="text-white/60"
      />
      <circle
        cx={dim / 2} cy={dim / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.7s ease" }}
      />
    </svg>
  );
}

// ─── Dimension row ─────────────────────────────────────────────────────────────

function DimensionRow({ dimension }: { dimension: FitScoreDimension }) {
  const { icon: Icon, iconClass, badge, badgeBg } = statusConfig(dimension.status);

  return (
    <div className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50 transition-colors">
      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${iconClass}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-slate-700">{dimension.label}</span>
          <span className={`text-[9px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full ${badgeBg}`}>
            {badge}
          </span>
        </div>
        <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">{dimension.detail}</p>
      </div>
    </div>
  );
}

function statusConfig(status: FitScoreDimension["status"]) {
  switch (status) {
    case "match":
      return { icon: CheckCircle2, iconClass: "text-emerald-500", badge: "Match", badgeBg: "bg-emerald-50 text-emerald-600 border border-emerald-200" };
    case "partial":
      return { icon: MinusCircle, iconClass: "text-amber-500", badge: "Partial", badgeBg: "bg-amber-50 text-amber-600 border border-amber-200" };
    case "mismatch":
      return { icon: XCircle, iconClass: "text-red-400", badge: "Mismatch", badgeBg: "bg-red-50 text-red-600 border border-red-200" };
    case "unknown":
    default:
      return { icon: HelpCircle, iconClass: "text-slate-300", badge: "Unknown", badgeBg: "bg-slate-50 text-slate-400 border border-slate-200" };
  }
}
