"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, SendHorizonal, BookOpen, RotateCcw,
  CheckCircle2, Circle, Zap, ChevronDown, ChevronUp,
  FileText, ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  JobApplication, UserProfile, PracticeSession, PracticeMessage, PracticeScore,
  ApplicationStage, FeedbackMode,
} from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_OPTIONS: { value: ApplicationStage; label: string; hint: string }[] = [
  { value: "intro_call",     label: "Intro Call",      hint: "Recruiter screen · 7 questions" },
  { value: "hiring_manager", label: "Hiring Manager",  hint: "Behavioral · 11 questions" },
  { value: "technical",      label: "Technical",       hint: "Product sense · 11 questions" },
  { value: "panel",          label: "Panel",           hint: "Mixed styles · 12 questions" },
  { value: "applied",        label: "General",         hint: "Background · 10 questions" },
];

function stageLabel(v: string) {
  return STAGE_OPTIONS.find(s => s.value === v)?.label ?? v;
}

const TYPE_META: Record<string, { label: string; cls: string }> = {
  behavioral:       { label: "Behavioral",    cls: "bg-purple-50 text-purple-600 border-purple-100" },
  product_sense:    { label: "Product",       cls: "bg-blue-50 text-blue-600 border-blue-100" },
  situational:      { label: "Situational",   cls: "bg-amber-50 text-amber-600 border-amber-100" },
  technical:        { label: "Technical",     cls: "bg-red-50 text-red-600 border-red-100" },
  company_specific: { label: "Company",       cls: "bg-emerald-50 text-emerald-600 border-emerald-100" },
  motivation:       { label: "Motivation",    cls: "bg-indigo-50 text-indigo-600 border-indigo-100" },
};

const SCORE_DIMS: { key: keyof Omit<PracticeScore, "feedback_text" | "overall">; label: string }[] = [
  { key: "structure", label: "Structure" },
  { key: "relevance", label: "Relevance" },
  { key: "depth",     label: "Depth" },
  { key: "clarity",   label: "Clarity" },
];

function scoreColor(s: number) { return s >= 8 ? "bg-emerald-500" : s >= 6 ? "bg-amber-400" : "bg-red-400"; }
function scoreTextColor(s: number) { return s >= 8 ? "text-emerald-600" : s >= 6 ? "text-amber-600" : "text-red-500"; }

// ─── Modal ────────────────────────────────────────────────────────────────────

function TextModal({ title, content, onClose }: { title: string; content: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[80vh] rounded-2xl border border-slate-200 bg-white shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 shrink-0">
          <p className="text-[13px] font-semibold text-slate-800">{title}</p>
          <button onClick={onClose} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-[13px] leading-relaxed text-slate-700 whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Score card ───────────────────────────────────────────────────────────────

function ScoreCard({ score, onRetry }: { score: PracticeScore; onRetry?: () => void }) {
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
                  <div className={`h-full rounded-full transition-all ${scoreColor(score[key])}`} style={{ width: `${score[key] * 10}%` }} />
                </div>
                <span className={`w-6 text-right text-[11px] font-mono font-semibold tabular-nums ${scoreTextColor(score[key])}`}>{score[key]}</span>
              </div>
            ))}
          </div>
          <p className="text-[12px] leading-relaxed text-slate-600 border-t border-slate-100 pt-3">{score.feedback_text}</p>
          {onRetry && (
            <button onClick={onRetry} className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] text-slate-500 hover:border-indigo-200 hover:text-indigo-500 transition-colors">
              <RotateCcw className="h-3 w-3" /> Try again
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message, onRetry }: { message: PracticeMessage; onRetry?: (qi: number) => void }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-indigo-500 px-4 py-3 text-[13px] leading-relaxed text-white">{message.content}</div>
      </div>
    );
  }
  if (message.type === "question") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 text-[13px] leading-relaxed text-slate-800 shadow-sm font-medium">{message.content}</div>
      </div>
    );
  }
  if (message.type === "question_repeat") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-indigo-100 bg-indigo-50 px-4 py-3 text-[13px] leading-relaxed text-slate-700">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-indigo-400 block mb-1">Back to the question</span>
          {message.content}
        </div>
      </div>
    );
  }
  if (message.type === "feedback" && message.score) {
    return (
      <div className="flex justify-start">
        <ScoreCard
          score={message.score}
          onRetry={onRetry && message.question_index !== undefined ? () => onRetry(message.question_index!) : undefined}
        />
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
      <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] leading-relaxed text-slate-700">{message.content}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Phase = "idle" | "generating" | "active" | "complete";

export default function PracticePage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const router  = useRouter();
  const supabase = createClient();

  const [phase, setPhase]               = useState<Phase>("idle");
  const [app, setApp]                   = useState<JobApplication | null>(null);
  const [profile, setProfile]           = useState<UserProfile | null>(null);
  const [loadingApp, setLoadingApp]     = useState(true);
  const [session, setSession]           = useState<PracticeSession | null>(null);
  const [stage, setStage]               = useState<ApplicationStage>("intro_call");
  const [stageOpen, setStageOpen]       = useState(false);
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>("as_you_go");
  const [panelOpen, setPanelOpen]       = useState(false);
  const [input, setInput]               = useState("");
  const [sending, setSending]           = useState(false);
  const [retryIndex, setRetryIndex]     = useState<number | null>(null);
  const [jdModal, setJdModal]           = useState(false);
  const [resumeModal, setResumeModal]   = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const stageRef   = useRef<HTMLDivElement>(null);

  // ── Load app + profile ─────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [appsRes, profileRes] = await Promise.all([
        fetch("/api/applications"),
        supabase.from("profiles").select("resume_text, resume_filename").eq("id", user.id).single(),
      ]);

      const apps: JobApplication[] = await appsRes.json();
      const found = apps.find(a => a.id === applicationId);
      if (found) {
        setApp(found);
        const validStages = STAGE_OPTIONS.map(s => s.value);
        setStage(validStages.includes(found.stage as ApplicationStage) ? found.stage as ApplicationStage : "intro_call");
      } else {
        toast.error("Application not found.");
        router.push("/applications");
      }

      if (profileRes.data) setProfile(profileRes.data as unknown as UserProfile);
      setLoadingApp(false);
    }
    load().catch(() => { toast.error("Failed to load."); router.push("/applications"); });
  }, [applicationId, router]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (stageRef.current && !stageRef.current.contains(e.target as Node)) setStageOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages]);

  // ── Generate ───────────────────────────────────────────────────────────────
  async function generate() {
    setPhase("generating");
    setSession(null);
    const res = await fetch("/api/practice/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId, stage, feedbackMode }),
    });
    if (!res.ok) { toast.error("Failed to generate questions."); setPhase("idle"); return; }
    const sess: PracticeSession = await res.json();
    setSession(sess);
    setPhase("active");
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
      body: JSON.stringify({ userMessage: userText, isRetry, retryQuestionIndex: retryIdx ?? undefined }),
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
    const retryMsg: PracticeMessage = { role: "assistant", type: "question_repeat", content: q.text, question_index: questionIndex };
    setSession(prev => prev ? { ...prev, messages: [...prev.messages, retryMsg] } : prev);
    inputRef.current?.focus();
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (loadingApp) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" /><span className="text-[13px]">Loading…</span>
      </div>
    );
  }

  const messages    = (session?.messages ?? []) as PracticeMessage[];
  const questions   = session?.questions ?? [];
  const currentQIdx = session?.current_question_index ?? 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Single-line top bar ──────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-slate-100 px-4 py-2.5 flex items-center gap-3 overflow-x-auto min-w-0">

        {/* Back */}
        <button onClick={() => router.push("/applications")} className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>

        {/* Company · Role */}
        <p className="shrink-0 text-[13px] font-semibold text-slate-800 whitespace-nowrap">
          {app?.company_name || "—"}
          {app?.position && <span className="font-normal text-slate-400"> · {app.position}</span>}
        </p>

        {/* Divider */}
        <span className="shrink-0 h-4 w-px bg-slate-200" />

        {/* Stage dropdown */}
        <div className="relative shrink-0" ref={stageRef}>
          <button
            onClick={() => setStageOpen(o => !o)}
            disabled={phase === "generating"}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:border-indigo-200 hover:text-indigo-600 transition-colors whitespace-nowrap"
          >
            {stageLabel(stage)}
            <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
          </button>
          {stageOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 w-52 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
              {STAGE_OPTIONS.map(s => (
                <button
                  key={s.value}
                  onClick={() => { setStage(s.value); setStageOpen(false); }}
                  className={`flex w-full flex-col items-start px-3 py-2.5 text-left transition-colors hover:bg-indigo-50 ${stage === s.value ? "bg-indigo-50 text-indigo-600" : "text-slate-700"}`}
                >
                  <span className="text-[13px] font-medium">{s.label}</span>
                  <span className="text-[11px] text-slate-400">{s.hint}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* JD pill */}
        {app?.job_description && (
          <button
            onClick={() => setJdModal(true)}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] font-medium text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 transition-colors whitespace-nowrap"
          >
            <FileText className="h-3.5 w-3.5" /> JD
          </button>
        )}

        {/* Base resume pill */}
        {profile?.resume_text && (
          <button
            onClick={() => setResumeModal(true)}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[12px] font-medium text-emerald-700 hover:bg-emerald-100 transition-colors whitespace-nowrap"
          >
            <FileText className="h-3.5 w-3.5" />
            {profile.resume_filename ?? "Base Resume"}
          </button>
        )}

        {/* Divider */}
        <span className="shrink-0 h-4 w-px bg-slate-200" />

        {/* Feedback toggle */}
        <div className="shrink-0 flex rounded-lg border border-slate-200 overflow-hidden">
          {(["as_you_go", "end_of_session"] as FeedbackMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setFeedbackMode(mode)}
              disabled={phase === "generating"}
              className={`px-2.5 py-1.5 text-[12px] font-medium transition-all whitespace-nowrap ${
                feedbackMode === mode ? "bg-indigo-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              {mode === "as_you_go" ? "Live feedback" : "End of session"}
            </button>
          ))}
        </div>

        {/* Generate — pushed to the far right */}
        <button
          onClick={generate}
          disabled={phase === "generating"}
          className="ml-auto shrink-0 flex items-center gap-1.5 rounded-xl bg-indigo-500 px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-indigo-400 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {phase === "generating"
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
            : phase === "idle"
            ? <><Zap className="h-3.5 w-3.5" /> Generate</>
            : <><RotateCcw className="h-3.5 w-3.5" /> Regenerate</>}
        </button>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      {phase === "idle" ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <BookOpen className="h-10 w-10 text-slate-200 mx-auto mb-3" />
            <p className="text-[13px] text-slate-400">
              Choose a stage and click <span className="font-semibold text-slate-500">Generate</span> to start
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">

          {/* Chat */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
              {messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} onRetry={handleRetry} />
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
                    disabled={sending}
                    className="flex-1 resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100 transition-colors max-h-32 overflow-y-auto"
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
          <div className={`shrink-0 border-l border-slate-200 bg-slate-50/60 flex flex-col overflow-hidden transition-all duration-200 ${panelOpen ? "w-64" : "w-10"}`}>
            <button
              onClick={() => setPanelOpen(o => !o)}
              className="flex items-center gap-2 border-b border-slate-200 px-3 py-3 w-full hover:bg-slate-100 transition-colors"
            >
              {panelOpen ? (
                <>
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400 flex-1 text-left">
                    Questions · {Math.min(currentQIdx, questions.length)}/{questions.length}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                </>
              ) : (
                <ChevronLeft className="h-3.5 w-3.5 text-slate-400 mx-auto" />
              )}
            </button>
            {panelOpen && (
              <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5">
                {questions.map((q, i) => {
                  const answered = i < currentQIdx || phase === "complete";
                  const current  = i === currentQIdx && phase === "active";
                  return (
                    <div key={i} className={`rounded-lg border px-3 py-2.5 text-[12px] transition-colors ${
                      current ? "border-indigo-200 bg-indigo-50/80" : answered ? "border-slate-200 bg-white" : "border-transparent"
                    }`}>
                      <div className="flex items-start gap-2">
                        {answered
                          ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-500" />
                          : current
                          ? <span className="h-3.5 w-3.5 shrink-0 mt-0.5 rounded-full border-2 border-indigo-400 flex items-center justify-center"><span className="h-1.5 w-1.5 rounded-full bg-indigo-400" /></span>
                          : <Circle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-300" />}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-slate-400">Q{i + 1}</p>
                            {q.type && TYPE_META[q.type] && (
                              <span className={`rounded border px-1 py-0 text-[9px] font-semibold uppercase tracking-wider ${TYPE_META[q.type].cls}`}>
                                {TYPE_META[q.type].label}
                              </span>
                            )}
                          </div>
                          <p className={`leading-snug ${answered ? "text-slate-400" : current ? "text-indigo-700" : "text-slate-500"}`}>{q.text}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {jdModal && app?.job_description && (
        <TextModal title="Job Description" content={app.job_description} onClose={() => setJdModal(false)} />
      )}
      {resumeModal && profile?.resume_text && (
        <TextModal
          title={profile.resume_filename ?? "Base Resume"}
          content={profile.resume_text}
          onClose={() => setResumeModal(false)}
        />
      )}
    </div>
  );
}
