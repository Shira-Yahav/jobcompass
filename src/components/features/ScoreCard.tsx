"use client";

import { useState } from "react";
import { ChevronRight, CheckCircle2, MinusCircle, XCircle, HelpCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import type { FitScore, FitScoreDimension } from "@/types";

interface ScoreCardProps {
  title: string;
  score: FitScore;
}

/**
 * ScoreCard — compact clickable chip.
 * Clicking opens a modal with a structured per-preference breakdown.
 */
export function ScoreCard({ title, score }: ScoreCardProps) {
  const [open, setOpen] = useState(false);
  const pct = Math.round(score.score);

  const palette =
    pct >= 70
      ? { bg: "bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-500", border: "border-emerald-200", dot: "bg-emerald-500", ring: "ring-emerald-200" }
      : pct >= 40
        ? { bg: "bg-amber-50", text: "text-amber-700", bar: "bg-amber-500", border: "border-amber-200", dot: "bg-amber-500", ring: "ring-amber-200" }
        : { bg: "bg-red-50", text: "text-red-700", bar: "bg-red-500", border: "border-red-200", dot: "bg-red-500", ring: "ring-red-200" };

  return (
    <>
      {/* Chip trigger */}
      <button
        onClick={() => setOpen(true)}
        className={`
          inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium
          transition-all select-none hover:shadow-sm
          ${palette.bg} ${palette.border} ${palette.text}
        `}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${palette.dot}`} />
        <span className="opacity-70 font-normal">{title}</span>
        <span className="tabular-nums font-semibold">{pct}%</span>
        <ChevronRight className="h-3 w-3 opacity-40" />
      </button>

      {/* Detail modal */}
      <Modal open={open} onClose={() => setOpen(false)} title={title} width="max-w-lg">
        {/* Score bar */}
        <div className={`mb-5 rounded-lg border p-4 ${palette.bg} ${palette.border}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-medium text-slate-600">Overall score</span>
            <span className={`text-2xl font-bold tabular-nums ${palette.text}`}>{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/70">
            <div
              className={`h-2 rounded-full transition-all ${palette.bar}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Per-dimension breakdown */}
        {score.dimensions && score.dimensions.length > 0 && (
          <div className="mb-5">
            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Breakdown by preference
            </p>
            <div className="flex flex-col divide-y divide-slate-100">
              {score.dimensions.map((d, i) => (
                <DimensionRow key={i} dimension={d} />
              ))}
            </div>
          </div>
        )}

        {/* Summary explanation */}
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Summary
          </p>
          <p className="text-[13px] leading-relaxed text-slate-600">{score.explanation}</p>
        </div>
      </Modal>
    </>
  );
}

// ─── Dimension row ─────────────────────────────────────────────────────────────

function DimensionRow({ dimension }: { dimension: FitScoreDimension }) {
  const { icon: Icon, iconClass, rowBg } = statusConfig(dimension.status);

  return (
    <div className={`flex items-start gap-3 py-2.5 px-1 ${rowBg}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} />
      <div className="flex-1 min-w-0">
        <span className="text-[12px] font-semibold text-slate-700">{dimension.label}</span>
        <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">{dimension.detail}</p>
      </div>
    </div>
  );
}

function statusConfig(status: FitScoreDimension["status"]) {
  switch (status) {
    case "match":
      return { icon: CheckCircle2, iconClass: "text-emerald-500", rowBg: "" };
    case "partial":
      return { icon: MinusCircle, iconClass: "text-amber-500", rowBg: "" };
    case "mismatch":
      return { icon: XCircle, iconClass: "text-red-400", rowBg: "" };
    case "unknown":
    default:
      return { icon: HelpCircle, iconClass: "text-slate-300", rowBg: "" };
  }
}
