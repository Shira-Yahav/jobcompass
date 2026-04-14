"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Global job context — company name and job description are entered once
 * and shared across Company Research, Position Research, and Tailor Resume.
 * Persisted to localStorage so values survive a page refresh.
 *
 * sessionId: a UUID that identifies the current "search session". It resets
 * whenever the company name changes, so history entries are grouped per job.
 */
interface JobStore {
  companyName: string;
  jobDescription: string;
  sessionId: string;
  setCompanyName: (value: string) => void;
  setJobDescription: (value: string) => void;
}

function newSessionId() {
  return typeof crypto !== "undefined"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export const useJobStore = create<JobStore>()(
  persist(
    (set) => ({
      companyName: "",
      jobDescription: "",
      sessionId: newSessionId(),
      setCompanyName: (value) =>
        set((s) => ({
          companyName: value,
          // New company = new history session
          sessionId: value !== s.companyName ? newSessionId() : s.sessionId,
        })),
      setJobDescription: (value) => set({ jobDescription: value }),
    }),
    { name: "jobcompass-job-store" }
  )
);
