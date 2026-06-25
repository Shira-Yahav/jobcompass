import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { parseJsonResponse } from "@/lib/parseJson";
import type { PracticeMessage, PracticeScore } from "@/types";

const anthropic = new Anthropic();

interface AiResponseMessage {
  type: PracticeMessage["type"];
  content: string;
  score?: PracticeScore;
}

interface AiResponse {
  classification: "clarifying" | "follow_up" | "complete";
  messages: AiResponseMessage[];
  next_question_index: number;
}

const STAGE_PERSONA: Record<string, string> = {
  applied:        "Talent Acquisition Specialist",
  intro_call:     "Technical Recruiter",
  hiring_manager: "Director of Product",
  technical:      "Senior Product Manager",
  panel:          "Cross-functional Panel Interviewer",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = await params;
  const { userMessage, isRetry, retryQuestionIndex } = (await request.json()) as {
    userMessage: string;
    isRetry?: boolean;
    retryQuestionIndex?: number;
  };

  const { data: session } = await supabase
    .from("practice_sessions")
    .select("*, job_applications(company_name, position, resume_submitted_text, job_description)")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) return Response.json({ error: "Session not found" }, { status: 404 });

  const app = session.job_applications as {
    company_name: string;
    position: string;
    resume_submitted_text: string | null;
    job_description: string | null;
  };
  const messages     = session.messages as PracticeMessage[];
  const feedbackMode = session.feedback_mode as string;
  const currentQIndex = isRetry && retryQuestionIndex !== undefined
    ? retryQuestionIndex
    : session.current_question_index as number;

  const allQs   = session.questions as Array<{ index: number; text: string; type: string }>;
  const currentQ = allQs[currentQIndex];
  const totalQs  = allQs.length;
  const isLastQ  = currentQIndex >= totalQs - 1;
  const persona  = STAGE_PERSONA[session.stage] ?? "Product Manager";

  // Enforce max 1 follow-up per question server-side (AI doesn't always respect the prompt rule)
  const alreadyFollowedUp = messages.some(
    m => m.role === "assistant" && m.type === "follow_up" && m.question_index === currentQIndex
  );

  // Build a readable conversation history
  const conversationHistory = messages
    .filter(m => m.type !== "acknowledgment") // skip the opening intro
    .map(m => {
      if (m.role === "user")               return `Candidate: ${m.content}`;
      if (m.type === "question")           return `Interviewer (Q${(m.question_index ?? 0) + 1}): ${m.content}`;
      if (m.type === "next_question")      return `Interviewer (Q${(m.question_index ?? 0) + 1}): ${m.content}`;
      if (m.type === "follow_up")          return `Interviewer (follow-up): ${m.content}`;
      if (m.type === "question_repeat")    return `Interviewer (re-asked): ${m.content}`;
      if (m.type === "feedback" && m.score)
        return `[Feedback given: ${m.score.overall}/10 — ${m.score.feedback_text}]`;
      if (m.type === "clarification_response") return `Interviewer: ${m.content}`;
      return null;
    })
    .filter(Boolean)
    .join("\n");

  const resumeSnippet = app.resume_submitted_text
    ? `\nCANDIDATE BACKGROUND (resume excerpt):\n${app.resume_submitted_text.slice(0, 800)}`
    : "";

  const jdSnippet = app.job_description
    ? `\nROLE CONTEXT (JD excerpt):\n${app.job_description.slice(0, 600)}`
    : "";

  // ─── Prompt ───────────────────────────────────────────────────────────────
  // This is the full prompt for the conversation turn.
  // Parameters injected: persona, company, role, resume, JD, full history, current question.

  const followUpOverride = alreadyFollowedUp
    ? `\n⚠️ OVERRIDE: You have ALREADY asked a follow-up on Q${currentQIndex + 1} (visible in conversation history as "Interviewer (follow-up):"). You MUST classify this as C (complete) — no exceptions. Do NOT ask another follow-up.\n`
    : "";

  const prompt = `You are a ${persona} at ${app.company_name || "the company"}, conducting a ${session.stage.replace(/_/g, " ")} interview for the ${app.position || "PM"} role. You are professional, direct, and genuinely interested in understanding this candidate — not reciting a script.${followUpOverride}
${resumeSnippet}
${jdSnippet}

YOUR QUESTION LIST (private — never reveal or list these):
${allQs.map(q => `Q${q.index + 1} [${q.type}]: ${q.text}`).join("\n")}

Currently on: Q${currentQIndex + 1} — "${currentQ?.text ?? "closing"}"
Questions remaining after this: ${totalQs - currentQIndex - 1}
${isRetry ? `The candidate is retrying Q${currentQIndex + 1}.` : ""}
Feedback mode: ${feedbackMode === "as_you_go" ? "Score each answer when you complete a question (not on follow-ups)" : "Do not score during the interview — acknowledge and move on"}

CONVERSATION SO FAR:
${conversationHistory || "(Interview just started)"}

THE CANDIDATE JUST SAID:
"${userMessage}"

━━━ YOUR DECISION ━━━

Step 1 — Classify this message:

A) CLARIFYING — They're asking about the question itself ("What do you mean by X?", "Can you be more specific about Y?")
   → Answer their question briefly and re-ask

B) FOLLOW_UP — They gave a substantive answer, but it's worth probing deeper. Use this when:
   - The answer is vague or generic and you'd expect specifics from a strong candidate
   - They mentioned something specific (a metric, a decision, a conflict) and you want the story
   - Their answer raises an interesting thread ("you mentioned pushback from eng — what happened there?")
   IMPORTANT: Only ask one follow-up per question. If you already asked a follow-up on this question (visible in conversation history), treat the next answer as COMPLETE regardless.

C) COMPLETE — The answer is sufficient to move on. Use this when:
   - The answer was thorough and specific
   - You already asked a follow-up on this question
   - It's a retry

Step 2 — Respond as that interviewer:

Tone: Professional, warm, direct. Real sentences, no bullet points. No hollow openers like "Great point!" or "That's a really interesting perspective." If you want to acknowledge something, be specific ("That's a clear example of...") or skip it.

For follow-ups: pick up the specific thread. "You mentioned X — can you walk me through what you actually decided there?" Not a generic probe.

For transitions to the next question: connect it naturally. "That makes sense. Let me shift gears —" or "Okay, good context. Next I want to ask about..."

For closings: 1–2 warm sentences. Tell them what happens next ("We'll be in touch within the week").

${feedbackMode === "as_you_go" ? `
SCORING (only when classification = COMPLETE and you're moving to next question or closing):
- structure (0–10): clear framework, STAR, or logical flow
- relevance (0–10): actually answered what was asked
- depth (0–10): specific examples, real metrics, concrete outcomes
- clarity (0–10): easy to follow, not rambling
- overall (0–10): holistic judgment
- feedback_text: 2 sentences max. Specific and actionable. Reference what they said. Professional tone.
` : ""}

Step 3 — Set next_question_index:
- A (clarifying) → ${currentQIndex} (no advance)
- B (follow_up) → ${currentQIndex} (no advance)
- C (complete) and NOT last question → ${currentQIndex + 1}
- C (complete) and IS last question → -1

━━━ OUTPUT ━━━

Return ONLY valid JSON (no markdown):
{
  "classification": "clarifying|follow_up|complete",
  "messages": [
    {
      "type": "clarification_response|question_repeat|follow_up|acknowledgment|feedback|next_question|session_complete",
      "content": "...",
      "score": { "overall": 0, "structure": 0, "relevance": 0, "depth": 0, "clarity": 0, "feedback_text": "" }
    }
  ],
  "next_question_index": <your Step 3 value>
}

Message sequence by classification:
- clarifying → [clarification_response, question_repeat]
- follow_up → [follow_up]
- complete + as_you_go + not last → [feedback, next_question]
- complete + as_you_go + last → [feedback, session_complete]
- complete + end_of_session + not last → [next_question]  (brief natural transition, no ack needed)
- complete + end_of_session + last → [session_complete]`;

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1200,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  let aiResponse: AiResponse;
  try {
    aiResponse = parseJsonResponse<AiResponse>(text);
  } catch {
    return Response.json({ error: "Failed to parse AI response", raw: text }, { status: 500 });
  }

  // Hard override: if AI still returned follow_up after we told it not to, force complete
  if (alreadyFollowedUp && aiResponse.classification === "follow_up") {
    aiResponse.classification = "complete";
    aiResponse.next_question_index = isLastQ ? -1 : currentQIndex + 1;
    aiResponse.messages = aiResponse.messages.map(m =>
      m.type === "follow_up" ? { ...m, type: isLastQ ? "session_complete" : "next_question" } : m
    );
  }

  const userMsg: PracticeMessage = {
    role: "user",
    type: "answer",
    content: userMessage,
    question_index: currentQIndex,
    ...(isRetry && retryQuestionIndex !== undefined ? { retry_of: retryQuestionIndex } : {}),
  };

  const newAiMessages: PracticeMessage[] = aiResponse.messages.map(m => ({
    role: "assistant" as const,
    type: m.type,
    content: m.content,
    question_index: m.type === "next_question" ? aiResponse.next_question_index : currentQIndex,
    ...(m.score ? { score: m.score } : {}),
  }));

  const updatedMessages = [...messages, userMsg, ...newAiMessages];
  const nextQIndex = aiResponse.next_question_index === -1
    ? currentQIndex
    : aiResponse.next_question_index;

  await supabase
    .from("practice_sessions")
    .update({
      messages: updatedMessages,
      current_question_index: nextQIndex,
      completed_at: aiResponse.next_question_index === -1 ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  return Response.json({
    newMessages: [userMsg, ...newAiMessages],
    nextQuestionIndex: aiResponse.next_question_index,
  });
}
