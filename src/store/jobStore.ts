"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Global job context — company name and job description are entered once
 * and shared across Company Research, Position Research, and Tailor Resume.
 * Persisted to localStorage so values survive a page refresh.
 */
interface JobStore {
  companyName: string;
  jobDescription: string;
  setCompanyName: (value: string) => void;
  setJobDescription: (value: string) => void;
}

export const useJobStore = create<JobStore>()(
  persist(
    (set) => ({
      companyName: "",
      jobDescription: "",
      setCompanyName: (value) => set({ companyName: value }),
      setJobDescription: (value) => set({ jobDescription: value }),
    }),
    { name: "jobcompass-job-store" }
  )
);
