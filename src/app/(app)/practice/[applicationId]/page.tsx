"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, SendHorizonal, ChevronRight, ChevronLeft,
  BookOpen, RotateCcw, CheckCircle2, Circle, ChevronDown, ChevronUp,
} from "lucide-react";
import type {
  JobApplication, PracticeSession, PracticeMessage, PracticeScore,
  ApplicationStage, FeedbackMode,
} from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES: { value: ApplicationStage; label: string; hint: string }[] = [
  { value: "intro_call",     label: "Intro Call",      hint: "Recruiter screen · 7 questions" },
  { value: "hiring_manager", label: "Hiring Manager",  hint: "Behavioral & leadership · 11 questions" },
  { value: "technical",      label: "Technical",       hint: "Product sense & metrics · 11 questions" },
  { value: "panel",          label: "Panel",           hint: "Mixed styles · 12 questions" },
  { value: "applied",        label: "General",         hint: "Motivation & background · 10 questions" },
];

const SCORE_DIMS: { key: keyof Omit<PracticeScore, "feedback_text" | "overall">; label: string }[] = [
  { key: "structure", label: "Structure" },
  { key: "relevance", label: "Relevance" },
  { key: "depth",     label: "Depth" },
  { key: "clarity",   label: "Clarity" },
];

function scoreColor(s: number) {
  if (s >= 8) return "bg-emerald-500";
  if (s >= 6) return "bg-amber-400";
  return "bg-red-400";
}

function scoreTextColor(s: number) {
  if (s >= 8) return "text-emerald-600";
  if (s >= 6) return "text-amber-600";
  return "text-red-500";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreCard({ score }: { score: PracticeScore }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm w-full max-w-[480px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-[22px] font-bold font-mono tabular-nums ${scoreTextColor(score.overall)}`}>
            {score.overall}<span className="text-[13px] text-slate-400 font-normal">/10</span>
          </span>
          <span className="text-[12px] font-medium text-slate-500">Overall</span>
        </div>
        <button onClick={() => setOpen(o => !o)} className="text-slate-400 hover:text-slate-600 transition-colors">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <>
          <div className="flex flex-col gap-2 mb-3">
            {SCORE_DIMS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-16 text-[11px] text-slate-500 font-mono shrink-0">{label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all ${scoreColor(score[key])}`}
                    style={{ width: `${score[key] * 10}%` }}
                  />
                </div>
                <span className={`w-6 text-right text-[11px] font-mono font-semibold tabular-nums ${scoreTextColor(score[key])}`}>
                  {score[key]}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[12px] leading-relaxed text-slate-600 border-t border-slate-100 pt-3">
            {score.feedback_text}
          </p>
        </>
      )}
    </div>
  );
}

function MessageBubble({
  message, onRetry,
}: {
  message: PracticeMessage;
  onRetry?: (questionIndex: number) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-indigo-500 px-4 py-3 text-[13px] leading-relaxed text-white">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.type === "question" || message.type === "question_repeat") {
    const isRepeat = message.type === "question_repeat";
    return (
      <div className={`flex justify-start`}>
        <div className={`max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-3 text-[13px] leading-relaxed ${
          isRepeat
            ? "border border-indigo-100 bg-indigo-50 text-slate-700"
            : "border border-slate-200 bg-white text-slate-800 shadow-sm font-medium"
        }`}>
          {isRepeat && <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-indigo-400 block mb-1">Back to the question</span>}
          {message.content}
        </div>
      </div>
    );
  }

  if (message.type === "feedback" && message.score) {
    return (
      <div className="flex justify-start flex-col gap-2">
        <ScoreCard score={message.score} />
        {onRetry !== undefined && message.question_index !== undefined && (
          <button
            onClick={() => onRetry(message.question_index!)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] text-slate-500 hover:border-indigo-200 hover:text-indigo-500 transition-colors w-fit"
          >
            <RotateCcw className="h-3 w-3" /> Try again
          </button>
        )}
      </div>
    );
  }

  if (message.type === "session_complete") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] leading-relaxed text-slate-700">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-emerald-600 block mb-1">Interview complete</span>
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] leading-relaxed text-slate-700">
        {message.content}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Phase = "loading" | "stage_picker" | "generating" | "chat" | "complete";

export default function PracticePage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("loading");
  const [app, setApp] = useState<JobApplication | null>(null);
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>("as_you_go");
  const [panelOpen, setPanelOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [retryIndex, setRetryIndex] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Load application ───────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/applications")
      .then(r => r.json())
      .then((data: JobApplication[]) => {
        const found = data.find(a => a.id === applicationId);
        if (found) { setApp(found); setPhase("stage_picker"); }
        else { toast.error("Application not found."); router.push("/applications"); }
      })
      .catch(() => { toast.error("Failed to load application."); router.push("/applications"); });
  }, [applicationId, router]);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages]);

  // ── Start session ──────────────────────────────────────────────────────────
  async function startSession(stage: ApplicationStage) {
    setPhase("generating");
    const res = await fetch("/api/practice/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId, stage, feedbackMode }),
    });
    if (!res.ok) { toast.error("Failed to start session."); setPhase("stage_picker"); return; }
    const sess: PracticeSession = await res.json();
    setSession(sess);
    setPhase("chat");
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  // ── Send message ──────────────────────────────────────────────────────────
  async function sendMessage() {
    if (!input.trim() || sending || !session) return;
    const userText = input.trim();
    setInput("");
    setSending(true);

    const isRetry = retryIndex !== null;
    const retryIdx = retryIndex;
    setRetryIndex(null);

    const res = await fetch(`/api/practice/${session.id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userMessage: userText,
        isRetry,
        retryQuestionIndex: retryIdx ?? undefined,
      }),
    });

    setSending(false);
    if (!res.ok) { toast.error("Failed to get response."); return; }

    const { newMessages, nextQuestionIndex } = await res.json() as {
      newMessages: PracticeMessage[];
      nextQuestionIndex: number;
    };

    setSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [...prev.messages, ...newMessages],
        current_question_index: nextQuestionIndex === -1 ? prev.current_question_index : nextQuestionIndex,
        completed_at: nextQuestionIndex === -1 ? new Date().toISOString() : null,
      };
    });

    if (nextQuestionIndex === -1) setPhase("complete");
  }

  // ── Retry ─────────────────────────────────────────────────────────────────
  function handleRetry(questionIndex: number) {
    if (!session) return;
    setRetryIndex(questionIndex);
    const q = session.questions[questionIndex];
    // Inject a "retry" question message into the chat
    const retryMsg: PracticeMessage = {
      role: "assistant",
      type: "question_repeat",
      content: q.text,
      question_index: questionIndex,
    };
    setSession(prev => prev ? { ...prev, messages: [...prev.messages, retryMsg] } : prev);
    inputRef.current?.focus();
  }

  if (phase === "loading") {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" /><span className="text-[13px]">Loading…</span>
      </div>
    );
  }

  // ── Stage picker ───────────────────────────────────────────────────────────
  if (phase === "stage_picker" || phase === "generating") {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-100 px-6 py-4">
          <button onClick={() => router.push("/applications")} className="flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-700 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Applications
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="mb-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <BookOpen className="h-5 w-5 text-indigo-500" />
                <h1 className="text-[18px] font-bold text-slate-900">Practice Interview</h1>
              </div>
              <p className="text-[13px] text-slate-500">
                {app?.company_name}{app?.position ? ` · ${app.position}` : ""}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-[13px] font-semibold text-slate-700 mb-4">Which stage are you practicing?</p>
              <div className="flex flex-col gap-2">
                {STAGES.map(s => (
                  <button
                    key={s.value}
                    onClick={() => startSession(s.value)}
                    disabled={phase === "generating"}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 transition-all disabled:opacity-50 group"
                  >
                    <div>
                      <p className="text-[13px] font-medium text-slate-800 group-hover:text-indigo-700">{s.label}</p>
                      <p className="text-[11px] text-slate-400">{s.hint}</p>
                    </div>
                    {phase === "generating" ? <Loader2 className="h-4 w-4 animate-spin text-indigo-400" /> : <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-400" />}
                  </button>
                ))}
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 font-mono mb-3">Feedback mode</p>
                <div className="flex gap-2">
                  {(["as_you_go", "end_of_session"] as FeedbackMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setFeedbackMode(mode)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-[12px] font-medium transition-all ${
                        feedbackMode === mode
                          ? "border-indigo-300 bg-indigo-50 text-indigo-600"
                          : "border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      {mode === "as_you_go" ? "After each answer" : "End of session"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Chat ───────────────────────────────────────────────────────────────────
  if (!session) return null;

  const messages = session.messages as PracticeMessage[];
  const questions = session.questions;
  const currentQIdx = session.current_question_index;
  const answeredIndices = new Set(
    messages.filter(m => m.role === "user" && m.type === "answer").map(m => m.question_index)
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/applications")} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-[13px] font-semibold text-slate-800 leading-none">
              {app?.company_name}{app?.position ? ` · ${app.position}` : ""}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
              {session.stage.replace("_", " ")} interview · {answeredIndices.size}/{questions.length} answered
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Feedback mode toggle */}
          <button
            onClick={() => setFeedbackMode(m => m === "as_you_go" ? "end_of_session" : "as_you_go")}
            className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-all ${
              feedbackMode === "as_you_go"
                ? "border-indigo-200 bg-indigo-50 text-indigo-600"
                : "border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            {feedbackMode === "as_you_go" ? "Feedback: live" : "Feedback: end"}
          </button>

          {/* Question panel toggle */}
          <button
            onClick={() => setPanelOpen(o => !o)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-500 hover:border-slate-300 transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Questions
            {panelOpen ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Chat */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

            {/* Intro banner */}
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-center">
              <p className="text-[12px] text-indigo-600">
                {session.stage.replace("_", " ")} interview simulation ·{" "}
                {feedbackMode === "as_you_go" ? "You'll get scored feedback after each answer" : "Scores revealed at the end"} ·{" "}
                Questions panel is hidden — toggle it if you want hints
              </p>
            </div>

            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                message={msg}
                onRetry={msg.type === "feedback" ? handleRetry : undefined}
              />
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-slate-200 bg-slate-50 px-4 py-3">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                  <span className="text-[12px] text-slate-400">Thinking…</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          {phase !== "complete" && (
            <div className="border-t border-slate-100 px-4 py-3 shrink-0">
              {retryIndex !== null && (
                <div className="mb-2 flex items-center gap-2 text-[11px] text-indigo-500">
                  <RotateCcw className="h-3 w-3" />
                  Retrying Q{retryIndex + 1} — type your improved answer
                  <button onClick={() => setRetryIndex(null)} className="ml-auto text-slate-400 hover:text-slate-600">cancel</button>
                </div>
              )}
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Answer the question, or ask a clarifying question…"
                  rows={2}
                  className="flex-1 resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 transition-colors max-h-32 overflow-y-auto"
                  disabled={sending}
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !input.trim()}
                  className="self-end rounded-xl bg-indigo-500 p-3 text-white hover:bg-indigo-400 disabled:opacity-50 transition-colors"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">Enter to send · Shift+Enter for new line</p>
            </div>
          )}
        </div>

        {/* Question panel */}
        {panelOpen && (
          <div className="w-64 shrink-0 border-l border-slate-200 bg-slate-50/60 flex flex-col overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3">
              <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400">
                Questions · {answeredIndices.size}/{questions.length}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5">
              {questions.map((q, i) => {
                const answered = answeredIndices.has(i);
                const current = i === currentQIdx && !answered;
                return (
                  <div key={i} className={`rounded-lg border px-3 py-2.5 text-[12px] transition-colors ${
                    current ? "border-indigo-200 bg-indigo-50/80" :
                    answered ? "border-slate-200 bg-white" :
                    "border-transparent"
                  }`}>
                    <div className="flex items-start gap-2">
                      {answered
                        ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-500" />
                        : current
                        ? <span className="h-3.5 w-3.5 shrink-0 mt-0.5 rounded-full border-2 border-indigo-400 flex items-center justify-center">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                          </span>
                        : <Circle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-300" />}
                      <div className="min-w-0">
                        <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Q{i + 1}</p>
                        <p className={`leading-snug ${answered ? "text-slate-400" : current ? "text-indigo-700" : "text-slate-500"}`}>
                          {q.text}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
