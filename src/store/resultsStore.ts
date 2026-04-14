"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CompanyResearch, PositionResearch, TailoredResume, ChatMessage } from "@/types";

/**
 * Persisted store for all AI analysis results.
 * Results survive tab navigation and page refresh — cleared only when
 * the user explicitly clicks Regenerate or clears the job target.
 */
interface ResultsStore {
  companyResearch: CompanyResearch | null;
  positionResearch: PositionResearch | null;
  tailoredResume: TailoredResume | null;
  chatHistory: ChatMessage[];

  setCompanyResearch: (r: CompanyResearch | null) => void;
  setPositionResearch: (r: PositionResearch | null) => void;
  setTailoredResume: (r: TailoredResume | null) => void;
  setChatHistory: (h: ChatMessage[]) => void;
}

export const useResultsStore = create<ResultsStore>()(
  persist(
    (set) => ({
      companyResearch: null,
      positionResearch: null,
      tailoredResume: null,
      chatHistory: [],

      setCompanyResearch: (r) => set({ companyResearch: r }),
      setPositionResearch: (r) => set({ positionResearch: r }),
      setTailoredResume: (r) => set({ tailoredResume: r }),
      setChatHistory: (h) => set({ chatHistory: h }),
    }),
    { name: "jobcompass-results" }
  )
);
