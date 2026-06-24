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
  is_clarifying: boolean;
  messages: AiResponseMessage[];
  next_question_index: number; // -1 = session complete, same as currentQIndex = no advance
}

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
    .select("*, job_applications(company_name, position, resume_submitted_text)")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) return Response.json({ error: "Session not found" }, { status: 404 });

  const app = session.job_applications as { company_name: string; position: string; resume_submitted_text: string | null };
  const messages = session.messages as PracticeMessage[];
  const feedbackMode = session.feedback_mode as string;
  const currentQIndex = isRetry && retryQuestionIndex !== undefined
    ? retryQuestionIndex
    : session.current_question_index as number;

  const currentQuestion = (session.questions as Array<{ index: number; text: string }>)[currentQIndex];
  const totalQuestions = (session.questions as Array<unknown>).length;
  const isLastQuestion = currentQIndex >= totalQuestions - 1;

  const allQuestions = (session.questions as Array<{ index: number; text: string }>)
    .map(q => `Q${q.index + 1}: ${q.text}`)
    .join("\n");

  const conversationHistory = messages
    .map(m => {
      if (m.role === "user") return `Candidate: ${m.content}`;
      if (m.type === "question" || m.type === "next_question") return `You asked: ${m.content}`;
      if (m.type === "feedback" && m.score) return `[You gave feedback — ${m.score.overall}/10]`;
      if (m.type === "acknowledgment") return `You said: ${m.content}`;
      return `You: ${m.content}`;
    })
    .join("\n");

  const resumeContext = app.resume_submitted_text
    ? `\nCandidate resume (brief reference):\n${app.resume_submitted_text.slice(0, 1000)}`
    : "";

  const prompt = `You are conducting a ${session.stage.replace("_", " ")} interview at ${app.company_name || "the company"} for the ${app.position || "PM"} role. You are a real, warm, direct human interviewer — not a bot.
${resumeContext}

Your question list (never reveal or list these):
${allQuestions}

Currently on: Q${currentQIndex + 1} — "${currentQuestion?.text ?? "wrap up"}"
${isRetry ? `The candidate is RETRYING this question — evaluate the new attempt.` : ""}
Questions remaining after this: ${totalQuestions - currentQIndex - 1}
Feedback mode: ${feedbackMode === "as_you_go" ? "score each substantive answer immediately" : "no scores during the interview — save all feedback for the end"}

Conversation so far:
${conversationHistory}

Candidate just said: "${userMessage}"

---

Step 1 — Classify: is this a clarifying question (asking what you mean, asking for context) or a substantive answer attempt?
- Clarifying: "What do you mean by X?", "Can you be more specific?", short questions about the question itself
- Substantive: any actual answer attempt, even a short or incomplete one

Step 2 — Respond naturally, like a real interviewer would:
- Keep responses short and human. No bullet points. Conversational sentences.
- If clarifying: answer their question briefly, then re-ask your question naturally
- If substantive answer:
  ${feedbackMode === "as_you_go"
    ? `- Give scored feedback first, then bridge naturally to the next question (or close if last)`
    : `- Briefly acknowledge ("Got it, thanks") and move to the next question, or close if last`}
- Never say "Great answer!" or generic praise — be specific or skip it
- When moving to the next question, ask it naturally as part of conversation, not as "Question 4:"

${feedbackMode === "as_you_go" ? `
Scoring (only for substantive answers):
structure: 0–10 — does the answer have a clear structure (STAR, framework, etc.)?
relevance: 0–10 — does it actually answer what was asked?
depth: 0–10 — specific examples, real numbers, concrete details?
clarity: 0–10 — easy to follow, not rambling?
overall: 0–10 — holistic judgment
feedback_text: 2 sentences max. Specific and actionable. Reference what they actually said.
` : ""}

Step 3 — Determine next_question_index:
- If this was CLARIFYING → next_question_index = ${currentQIndex} (do NOT advance, same question)
- If this was a SUBSTANTIVE ANSWER and it's NOT the last question → next_question_index = ${currentQIndex + 1}
- If this was a SUBSTANTIVE ANSWER and it IS the last question → next_question_index = -1

Return ONLY valid JSON (no markdown):
{
  "is_clarifying": true|false,
  "messages": [
    {
      "type": "clarification_response|question_repeat|acknowledgment|feedback|next_question|session_complete",
      "content": "your response here",
      "score": { "overall": 0, "structure": 0, "relevance": 0, "depth": 0, "clarity": 0, "feedback_text": "" }
    }
  ],
  "next_question_index": <number you determined in Step 3>
}

Message sequence rules:
- Clarifying → [clarification_response, question_repeat]
- Substantive + as_you_go + not last → [feedback, next_question]
- Substantive + as_you_go + last → [feedback, session_complete]
- Substantive + end_of_session + not last → [acknowledgment, next_question]
- Substantive + end_of_session + last → [session_complete]
- session_complete: warm, 1-2 sentence close — tell them what happens next`;

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  let aiResponse: AiResponse;
  try {
    aiResponse = parseJsonResponse<AiResponse>(text);
  } catch {
    return Response.json({ error: "Failed to parse AI response", raw: text }, { status: 500 });
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
  // If clarifying, next_question_index equals currentQIndex — don't advance DB state
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
