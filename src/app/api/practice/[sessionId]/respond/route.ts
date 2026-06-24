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
  next_question_index: number; // -1 = session complete
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

  // Load session + application
  const { data: session } = await supabase
    .from("practice_sessions")
    .select("*, job_applications(company_name, position, resume_submitted_text)")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) return Response.json({ error: "Session not found" }, { status: 404 });

  const app = session.job_applications as { company_name: string; position: string; resume_submitted_text: string | null };
  const questions = session.questions as PracticeMessage[];
  const messages = session.messages as PracticeMessage[];
  const feedbackMode = session.feedback_mode as string;
  const currentQIndex = isRetry && retryQuestionIndex !== undefined
    ? retryQuestionIndex
    : session.current_question_index as number;

  const currentQuestion = (session.questions as Array<{ index: number; text: string }>)[currentQIndex];

  // Build conversation history for Claude
  const conversationHistory = messages
    .map(m => {
      if (m.role === "user") return `[Candidate]: ${m.content}`;
      if (m.type === "question") return `[Interviewer asks]: ${m.content}`;
      if (m.type === "feedback" && m.score) {
        return `[Feedback given - Overall ${m.score.overall}/10]: ${m.score.feedback_text}`;
      }
      return `[Interviewer]: ${m.content}`;
    })
    .join("\n");

  const resume = app.resume_submitted_text
    ? `\nCANDIDATE RESUME:\n${app.resume_submitted_text.slice(0, 1500)}`
    : "";

  const allQuestions = (session.questions as Array<{ index: number; text: string }>)
    .map(q => `Q${q.index + 1}: ${q.text}`)
    .join("\n");

  const totalQuestions = (session.questions as Array<unknown>).length;
  const isLastQuestion = currentQIndex >= totalQuestions - 1;

  const prompt = `You are a ${session.stage.replace("_", " ")} interviewer at ${app.company_name || "a company"} interviewing a candidate for a ${app.position || "PM"} role. You are professional, encouraging, and thorough.
${resume}

YOUR QUESTION LIST (private — ask naturally, never list them):
${allQuestions}

CURRENT QUESTION: Q${currentQIndex + 1} (${currentQuestion?.text ?? "wrap up"})
QUESTIONS REMAINING: ${totalQuestions - currentQIndex - 1} after this one
FEEDBACK MODE: ${feedbackMode === "as_you_go" ? "give immediate scored feedback after each substantive answer" : "acknowledge answers without scoring; reserve all feedback for session end"}
${isRetry ? `\nNOTE: The candidate is RETRYING Q${(retryQuestionIndex ?? 0) + 1}. They answered it before. Evaluate this new attempt.` : ""}

CONVERSATION SO FAR:
${conversationHistory}

THE CANDIDATE JUST SAID: "${userMessage}"

Decide: is this a clarifying question about the interview question, or a substantive answer attempt?

Rules:
- Short clarifying questions ("What do you mean by X?", "Can you elaborate?") → is_clarifying: true
- Any actual answer attempt (even imperfect) → is_clarifying: false
- After ALL questions are answered (current is last and this is an answer) → include a session_complete message

${feedbackMode === "as_you_go" ? `
SCORING RUBRIC (for substantive answers only):
- structure (0-10): use of frameworks like STAR, CIRCLES, clear beginning/middle/end
- relevance (0-10): does the answer actually address the question asked
- depth (0-10): specific examples, real metrics, concrete details
- clarity (0-10): clear, concise, easy to follow
- overall (0-10): holistic score
- feedback_text: 2-3 sentences — be specific, constructive, encouraging. Reference what they said.
` : ""}

Return ONLY valid JSON (no markdown fences):
{
  "is_clarifying": boolean,
  "messages": [
    {
      "type": "clarification_response|question_repeat|acknowledgment|feedback|next_question|session_complete",
      "content": "natural conversational text",
      "score": { "overall": 0, "structure": 0, "relevance": 0, "depth": 0, "clarity": 0, "feedback_text": "" }
    }
  ],
  "next_question_index": ${isLastQuestion ? -1 : currentQIndex + 1}
}

Message type rules:
- clarification_response: answer the candidate's clarifying question
- question_repeat: re-ask the current question after clarifying (always follow clarification_response)
- acknowledgment: brief "got it" when feedback mode is end_of_session
- feedback: scored evaluation (only when feedbackMode is as_you_go)
- next_question: ask the next question from your list naturally (not "Question 2: ...")
- session_complete: wrap up the interview warmly, no score needed`;

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

  // Build new messages to append
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

  // Save to DB
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
