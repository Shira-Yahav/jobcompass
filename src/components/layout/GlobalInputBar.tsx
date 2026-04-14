"use client";

import { useJobStore } from "@/store/jobStore";
import { Target } from "lucide-react";

/**
 * GlobalInputBar — rendered on Company Research, Position Research, and Tailor Resume pages.
 * Values persist to localStorage via Zustand persist middleware.
 */
interface GlobalInputBarProps {
  showJobDescription?: boolean;
}

export function GlobalInputBar({ showJobDescription = true }: GlobalInputBarProps) {
  const { companyName, jobDescription, setCompanyName, setJobDescription } =
    useJobStore();

  return (
    <div className="border-b border-[--border] bg-[--background]/90 backdrop-blur-md px-6 py-4 shrink-0">
      <div className="flex items-center gap-1.5 mb-3">
        <Target className="h-3 w-3 text-indigo-400" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[--muted-foreground]">
          Active target
        </span>
      </div>
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Company name"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="
            h-9 w-52 shrink-0 rounded-md border border-[--border]
            bg-[--input] px-3 text-sm text-[--foreground]
            placeholder:text-[--muted-foreground] outline-none
            focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/40
            transition-colors
          "
        />
        {showJobDescription && (
          <textarea
            placeholder="Paste the job description here…"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            rows={3}
            className="
              flex-1 rounded-md border border-[--border]
              bg-[--input] px-3 py-2 text-sm text-[--foreground]
              placeholder:text-[--muted-foreground] outline-none
              focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/40
              resize-none overflow-y-auto max-h-32 transition-colors
            "
          />
        )}
      </div>
    </div>
  );
}
