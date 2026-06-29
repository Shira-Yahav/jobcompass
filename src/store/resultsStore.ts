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

// Module-level controller so cancelRun() can abort any in-flight store fetch
let activeController: AbortController | null = null;

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
  loadingStep: string | null;  // current step label shown during long loads

  // Direct setters (for chat / upload side-effects)
  setCompanyResearch: (r: CompanyResearch | null) => void;
  setPositionResearch: (r: PositionResearch | null) => void;
  setTailoredResume: (r: TailoredResume | null) => void;
  setChatHistory: (h: ChatMessage[]) => void;

  // Cancel any in-flight store fetch and reset loading state
  cancelRun: () => void;

  // Async actions — survive component unmount
  runCompanyResearch: (companyName: string, sessionId: string, onError: (msg: string) => void) => Promise<void>;
  runPositionResearch: (companyName: string, jobDescription: string, sessionId: string, onError: (msg: string) => void) => Promise<void>;
  runTailorResume: (
    companyName: string,
    jobDescription: string,
    history: ChatMessage[],
    sessionId: string,
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
      loadingStep: null,

      setCompanyResearch: (r) => set({ companyResearch: r }),
      setPositionResearch: (r) => set({ positionResearch: r }),
      setTailoredResume: (r) => set({ tailoredResume: r }),
      setChatHistory: (h) => set({ chatHistory: h }),

      cancelRun: () => {
        activeController?.abort();
        activeController = null;
        set({ loadingCompany: false, loadingPosition: false, loadingResume: false, loadingStep: null });
      },

      // ── Company research ──────────────────────────────────────────────────
      runCompanyResearch: async (companyName, sessionId, onError) => {
        activeController = new AbortController();
        const signal = activeController.signal;
        set({ loadingCompany: true, companyResearch: null, loadingStep: "Searching the web…" });
        const stepTimer = setTimeout(() => set({ loadingStep: "Analysing results…" }), 4000);
        try {
          const res = await fetch("/api/research-company", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyName }),
            signal,
          });
          const data = await res.json();
          if (!res.ok) {
            onError(data.error ?? "Something went wrong.");
          } else {
            const result = data as CompanyResearch;
            set({ companyResearch: result });
            fetch("/api/history", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: sessionId, companyName, companyResearch: result }),
            }).catch(() => {});
          }
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return;
          onError("Network error — please try again.");
        } finally {
          clearTimeout(stepTimer);
          set({ loadingCompany: false, loadingStep: null });
        }
      },

      // ── Position research ─────────────────────────────────────────────────
      runPositionResearch: async (companyName, jobDescription, sessionId, onError) => {
        activeController = new AbortController();
        const signal = activeController.signal;
        set({ loadingPosition: true, positionResearch: null, loadingStep: "Analysing role fit…" });
        try {
          const res = await fetch("/api/research-position", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyName, jobDescription }),
            signal,
          });
          const data = await res.json();
          if (!res.ok) {
            onError(data.error ?? "Something went wrong.");
          } else {
            const result = data as PositionResearch;
            set({ positionResearch: result });
            const jobTitle = result.role_summary?.split(".")[0] ?? null;
            fetch("/api/history", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: sessionId, companyName, jobDescription, jobTitle, positionResearch: result }),
            }).catch(() => {});
          }
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return;
          onError("Network error — please try again.");
        } finally {
          set({ loadingPosition: false, loadingStep: null });
        }
      },

      // ── Tailor resume (initial) ───────────────────────────────────────────
      runTailorResume: async (companyName, jobDescription, history, sessionId, onError) => {
        activeController = new AbortController();
        const signal = activeController.signal;
        set({ loadingResume: true, tailoredResume: null, chatHistory: [] });
        try {
          const res = await fetch("/api/tailor-resume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyName, jobDescription, history }),
            signal,
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
            fetch("/api/history", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: sessionId, companyName, jobDescription, tailoredResume: result }),
            }).catch(() => {});
          }
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return;
          onError("Network error — please try again.");
        } finally {
          set({ loadingResume: false });
        }
      },

      // ── Resume chat follow-up ─────────────────────────────────────────────
      sendResumeChat: async (companyName, jobDescription, history, onError) => {
        activeController = new AbortController();
        const signal = activeController.signal;
        set({ loadingResume: true });
        try {
          const res = await fetch("/api/tailor-resume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyName, jobDescription, history }),
            signal,
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
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return;
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
