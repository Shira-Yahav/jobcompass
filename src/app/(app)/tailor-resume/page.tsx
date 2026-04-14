"use client";

import { useEffect, useRef, useState } from "react";
import { useJobStore } from "@/store/jobStore";
import { useResultsStore } from "@/store/resultsStore";
import { createClient } from "@/lib/supabase/client";
import { GlobalInputBar } from "@/components/layout/GlobalInputBar";
import { ScoreCard } from "@/components/features/ScoreCard";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText, Loader2, Upload, CheckCircle2, SendHorizonal, Copy, Download, RefreshCw,
} from "lucide-react";
import type { ChatMessage } from "@/types";

export default function TailorResumePage() {
  const { companyName, jobDescription, sessionId } = useJobStore();
  const {
    tailoredResume: tailored,
    chatHistory,
    loadingResume,
    setTailoredResume,
    setChatHistory,
    runTailorResume,
    sendResumeChat,
  } = useResultsStore();
  const supabase = createClient();

  // Upload state (not persisted — loaded from Supabase on mount)
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const [additionalContext, setAdditionalContext] = useState("");
  const [uploading, setUploading] = useState(false);
  const [chatInput, setChatInput] = useState("");

  // Auto-save context
  const userIdRef = useRef<string | null>(null);
  const contextInitializedRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Load saved resume info on mount ────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userIdRef.current = user.id;

      const { data } = await supabase
        .from("profiles")
        .select("resume_filename, additional_context")
        .eq("id", user.id)
        .single();

      if (data) {
        setUploadedFilename(data.resume_filename ?? null);
        setAdditionalContext(data.additional_context ?? "");
      }
      setTimeout(() => { contextInitializedRef.current = true; }, 0);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save additional context ───────────────────────────────────────────
  useEffect(() => {
    if (!contextInitializedRef.current) return;
    const userId = userIdRef.current;
    if (!userId) return;

    const timer = setTimeout(async () => {
      await supabase.from("profiles").upsert({
        id: userId,
        additional_context: additionalContext,
        updated_at: new Date().toISOString(),
      });
    }, 800);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [additionalContext]);

  // ── Auto-scroll chat ───────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  // ── Upload ─────────────────────────────────────────────────────────────────
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file.");
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.append("resume", file);
    form.append("additionalContext", additionalContext);
    const res = await fetch("/api/upload-resume", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Upload failed.");
    } else {
      setUploadedFilename(data.filename);
      toast.success("Resume uploaded and parsed.");
      setTailoredResume(null);
      setChatHistory([]);
    }
    setUploading(false);
    e.target.value = "";
  }

  // ── Tailor ─────────────────────────────────────────────────────────────────
  function handleTailor() {
    if (!uploadedFilename) { toast.error("Upload your resume first."); return; }
    if (!jobDescription.trim()) { toast.error("Paste a job description above first."); return; }
    runTailorResume(companyName, jobDescription, [], sessionId, (msg) => toast.error(msg));
  }

  // ── Chat send ──────────────────────────────────────────────────────────────
  function handleChatSend() {
    if (!chatInput.trim() || loadingResume) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput };
    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    setChatInput("");
    sendResumeChat(companyName, jobDescription, newHistory, (msg) => toast.error(msg));
  }

  // ── Copy / Download ────────────────────────────────────────────────────────
  function handleCopy() {
    if (!tailored) return;
    navigator.clipboard.writeText(tailored.resume_markdown);
    toast.success("Copied to clipboard.");
  }

  function handleDownload() {
    if (!tailored) return;
    const blob = new Blob([tailored.resume_markdown], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tailored-resume.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col h-full">
      <GlobalInputBar />

      {/* Page header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
        <div>
          <h1 className="text-[15px] font-semibold text-slate-900">Tailor Resume</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            AI-rewritten for this specific role. Chat to refine.
          </p>
        </div>
        <button
          onClick={handleTailor}
          disabled={loadingResume || !uploadedFilename}
          className={`
            flex items-center gap-2 rounded-md px-4 py-2 text-[13px] font-medium
            transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0
            ${tailored
              ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              : "bg-indigo-600 text-white hover:bg-indigo-500"}
          `}
        >
          {loadingResume && !tailored ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Tailoring…</>
          ) : tailored ? (
            <><RefreshCw className="h-3.5 w-3.5" /> Regenerate</>
          ) : (
            <><FileText className="h-3.5 w-3.5" /> Tailor resume</>
          )}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 pb-10">
        <div className="flex flex-col gap-4 max-w-2xl">

          {/* ── Upload section ─────────────────────────────────────────────── */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Your resume
            </p>
            <div className="flex flex-col gap-3">
              <label
                htmlFor="resume-upload"
                className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-600 transition-colors hover:border-slate-300 hover:bg-white"
              >
                {uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                ) : uploadedFilename ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Upload className="h-3.5 w-3.5 text-slate-400" />
                )}
                {uploading ? "Uploading…" : uploadedFilename ?? "Upload PDF resume"}
              </label>
              <input
                id="resume-upload"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />

              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-slate-500">
                  Additional context
                  <span className="ml-1 text-slate-400">(optional)</span>
                </label>
                <textarea
                  placeholder="e.g. I led a $2M ARR product not on my resume, or I'm relocating to NYC…"
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 resize-none overflow-y-auto max-h-24 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* ── Empty state ─────────────────────────────────────────────────── */}
          {!tailored && !loadingResume && (
            <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-200 text-[13px] text-slate-400">
              Upload your resume and click Tailor resume.
            </div>
          )}

          {/* ── Results ─────────────────────────────────────────────────────── */}
          {tailored && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-start">
                  <ScoreCard title="Interview likelihood" score={tailored.interview_likelihood} />
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                    What changed
                  </p>
                  <p className="whitespace-pre-line text-[12px] leading-relaxed text-slate-600">
                    {tailored.changes_summary}
                  </p>
                </div>
              </div>

              {/* Tailored resume */}
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                    Tailored resume
                  </p>
                  <div className="flex gap-2">
                    <ActionButton onClick={handleCopy} icon={Copy} label="Copy" />
                    <ActionButton onClick={handleDownload} icon={Download} label="Download" />
                  </div>
                </div>
                <div className="prose prose-sm max-w-none
                  prose-headings:text-slate-900 prose-headings:font-semibold
                  prose-h2:text-[14px] prose-h2:mt-4 prose-h2:mb-1
                  prose-h3:text-[13px] prose-h3:mt-3 prose-h3:mb-1
                  prose-p:text-slate-600 prose-p:text-[13px] prose-p:leading-relaxed
                  prose-strong:text-slate-800
                  prose-li:text-slate-600 prose-li:text-[13px] prose-li:leading-relaxed
                  prose-ul:my-1 prose-ol:my-1
                  [&>*:first-child]:mt-0">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {tailored.resume_markdown}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Chat */}
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  Refine your resume
                </p>

                {chatHistory.length > 2 && (
                  <div className="mb-3 flex max-h-64 flex-col gap-2.5 overflow-y-auto pr-1">
                    {chatHistory.slice(2).map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-lg px-3 py-2.5 text-[13px] leading-relaxed
                          ${msg.role === "user"
                            ? "bg-indigo-600 text-white"
                            : "border border-slate-200 bg-slate-50 text-slate-700"}`}>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                )}

                <div className="flex gap-2">
                  <textarea
                    placeholder="e.g. Make the summary punchier, or add more emphasis on my leadership…"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    rows={2}
                    className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 resize-none overflow-y-auto max-h-24 transition-colors"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleChatSend();
                      }
                    }}
                  />
                  <button
                    onClick={handleChatSend}
                    disabled={loadingResume || !chatInput.trim()}
                    className="self-end rounded-md bg-indigo-600 p-2.5 text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {loadingResume
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <SendHorizonal className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Enter to send · Shift+Enter for new line
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionButton({ onClick, icon: Icon, label }: { onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600 transition-colors hover:border-slate-300 hover:bg-white"
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}
