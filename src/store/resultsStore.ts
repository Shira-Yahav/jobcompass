"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CompanyResearch, PositionResearch, TailoredResume, ChatMessage } from "@/types";

/**
 * Persisted store for all AI analysis results AND their loading states.
 *
 * Keeping fetch logic here (not in components) means tab navigation never
 * cancels an in-flight request — the store lives for the entire session.
 */
interface ResultsStore {
  // Results
  companyResearch: CompanyResearch | null;
  positionResearch: PositionResearch | null;
  tailoredResume: TailoredResume | null;
  chatHistory: ChatMessage[];

  // Loading flags — read by page components
  loadingCompany: boolean;
  loadingPosition: boolean;
  loadingResume: boolean;

  // Direct setters (for chat / upload side-effects)
  setCompanyResearch: (r: CompanyResearch | null) => void;
  setPositionResearch: (r: PositionResearch | null) => void;
  setTailoredResume: (r: TailoredResume | null) => void;
  setChatHistory: (h: ChatMessage[]) => void;

  // Async actions — survive component unmount
  runCompanyResearch: (companyName: string, onError: (msg: string) => void) => Promise<void>;
  runPositionResearch: (companyName: string, jobDescription: string, onError: (msg: string) => void) => Promise<void>;
  runTailorResume: (
    companyName: string,
    jobDescription: string,
    history: ChatMessage[],
    onError: (msg: string) => void,
  ) => Promise<void>;
  sendResumeChat: (
    companyName: string,
    jobDescription: string,
    history: ChatMessage[],
    onError: (msg: string) => void,
  ) => Promise<void>;
}

export const useResultsStore = create<ResultsStore>()(
  persist(
    (set, get) => ({
      companyResearch: null,
      positionResearch: null,
      tailoredResume: null,
      chatHistory: [],
      loadingCompany: false,
      loadingPosition: false,
      loadingResume: false,

      setCompanyResearch: (r) => set({ companyResearch: r }),
      setPositionResearch: (r) => set({ positionResearch: r }),
      setTailoredResume: (r) => set({ tailoredResume: r }),
      setChatHistory: (h) => set({ chatHistory: h }),

      // ── Company research ──────────────────────────────────────────────────
      runCompanyResearch: async (companyName, onError) => {
        set({ loadingCompany: true, companyResearch: null });
        try {
          const res = await fetch("/api/research-company", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyName }),
          });
          const data = await res.json();
          if (!res.ok) onError(data.error ?? "Something went wrong.");
          else set({ companyResearch: data as CompanyResearch });
        } catch {
          onError("Network error — please try again.");
        } finally {
          set({ loadingCompany: false });
        }
      },

      // ── Position research ─────────────────────────────────────────────────
      runPositionResearch: async (companyName, jobDescription, onError) => {
        set({ loadingPosition: true, positionResearch: null });
        try {
          const res = await fetch("/api/research-position", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyName, jobDescription }),
          });
          const data = await res.json();
          if (!res.ok) onError(data.error ?? "Something went wrong.");
          else set({ positionResearch: data as PositionResearch });
        } catch {
          onError("Network error — please try again.");
        } finally {
          set({ loadingPosition: false });
        }
      },

      // ── Tailor resume (initial) ───────────────────────────────────────────
      runTailorResume: async (companyName, jobDescription, history, onError) => {
        set({ loadingResume: true, tailoredResume: null, chatHistory: [] });
        try {
          const res = await fetch("/api/tailor-resume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyName, jobDescription, history }),
          });
          const data = await res.json();
          if (!res.ok) {
            onError(data.error ?? "Something went wrong.");
          } else {
            const result = data as TailoredResume;
            set({
              tailoredResume: result,
              chatHistory: [
                { role: "user", content: "Please tailor my resume for this role." },
                { role: "assistant", content: JSON.stringify(result) },
              ],
            });
          }
        } catch {
          onError("Network error — please try again.");
        } finally {
          set({ loadingResume: false });
        }
      },

      // ── Resume chat follow-up ─────────────────────────────────────────────
      sendResumeChat: async (companyName, jobDescription, history, onError) => {
        set({ loadingResume: true });
        try {
          const res = await fetch("/api/tailor-resume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyName, jobDescription, history }),
          });
          const data = await res.json();
          if (!res.ok) {
            onError(data.error ?? "Something went wrong.");
          } else {
            const reply = (data as { reply: string }).reply ?? "";
            const newHistory: ChatMessage[] = [...history, { role: "assistant", content: reply }];
            set({ chatHistory: newHistory });
            const tailored = get().tailoredResume;
            if (reply.includes("##") && tailored) {
              set({ tailoredResume: { ...tailored, resume_markdown: reply } });
            }
          }
        } catch {
          onError("Network error — please try again.");
        } finally {
          set({ loadingResume: false });
        }
      },
    }),
    {
      name: "jobcompass-results",
      // Don't persist loading flags — reset to false on page load
      partialize: (s) => ({
        companyResearch: s.companyResearch,
        positionResearch: s.positionResearch,
        tailoredResume: s.tailoredResume,
        chatHistory: s.chatHistory,
      }),
    }
  )
);
