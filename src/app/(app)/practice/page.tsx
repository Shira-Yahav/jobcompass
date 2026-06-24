"use client";

import Link from "next/link";
import { BookOpen, ArrowRight } from "lucide-react";

export default function PracticeLandingPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100">
          <BookOpen className="h-6 w-6 text-indigo-500" />
        </div>
        <h1 className="text-[18px] font-bold text-slate-900 mb-2">Interview Practice</h1>
        <p className="text-[13px] text-slate-500 leading-relaxed mb-6">
          Simulate real interviews tailored to your company, role, and stage. Get scored feedback on every answer.
        </p>
        <Link
          href="/applications"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-indigo-400 transition-colors"
        >
          Go to Applications
          <ArrowRight className="h-4 w-4" />
        </Link>
        <p className="mt-4 text-[11px] text-slate-400">
          Click the <span className="font-semibold">Practice</span> button on any application row to start
        </p>
      </div>
    </div>
  );
}
