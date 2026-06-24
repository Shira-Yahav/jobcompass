import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { parseJsonResponse } from "@/lib/parseJson";
import type { PracticeQuestion, PracticeMessage, FeedbackMode, ApplicationStage } from "@/types";

const anthropic = new Anthropic();

const STAGE_FOCUS: Record<string, string> = {
  applied:        "motivation, background, and interest in the company — light screening questions",
  intro_call:     "recruiter screen — background, motivation, culture fit, compensation expectations, and basic role understanding",
  hiring_manager: "behavioral questions using the STAR framework, leadership examples, impact stories, cross-functional collaboration, and strategic thinking",
  technical:      "product sense, prioritization frameworks, metrics definition, analytical thinking, data-driven decisions, and technical PM judgment",
  panel:          "mixed behavioral, situational, product sense, and company-specific questions — expect variety in interviewer styles",
  contract:       "final clarifications — role expectations, team dynamics, and any remaining concerns",
  offer:          "offer details and any final questions before accepting",
};

const QUESTION_COUNT: Record<string, number> = {
  intro_call: 7, hiring_manager: 11, technical: 11, panel: 12,
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { applicationId, stage, feedbackMode } = (await request.json()) as {
    applicationId: string;
    stage: ApplicationStage;
    feedbackMode: FeedbackMode;
  };

  // Load application context
  const { data: app } = await supabase
    .from("job_applications")
    .select("company_name, position, job_description, resume_submitted_text")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .single();

  if (!app) return Response.json({ error: "Application not found" }, { status: 404 });

  const count = QUESTION_COUNT[stage] ?? 10;
  const stageFocus = STAGE_FOCUS[stage] ?? "general interview questions";
  const jd = app.job_description ? `\nJOB DESCRIPTION:\n${app.job_description.slice(0, 2000)}` : "";
  const resume = app.resume_submitted_text ? `\nCANDIDATE RESUME (for context):\n${app.resume_submitted_text.slice(0, 2000)}` : "";

  const genPrompt = `You are an expert PM interview coach. Generate exactly ${count} interview questions for a ${stage.replace("_", " ")} interview at ${app.company_name || "the company"} for a ${app.position || "PM"} role.

STAGE FOCUS: ${stageFocus}
${jd}${resume}

Generate questions that:
1. Match the stage focus above
2. Are tailored to ${app.company_name || "this company"} and the ${app.position || "PM"} role where possible
3. Vary across types: behavioral, situational, product sense, company-specific, motivation
4. Progress from warm-up to more challenging

Return ONLY valid JSON (no markdown fences):
{
  "questions": [
    { "index": 0, "text": "...", "type": "behavioral|product_sense|situational|technical|company_specific|motivation" }
  ]
}`;

  const genMsg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{ role: "user", content: genPrompt }],
  });

  const genText = genMsg.content[0].type === "text" ? genMsg.content[0].text : "";
  let questions: PracticeQuestion[];
  try {
    const parsed = parseJsonResponse<{ questions: PracticeQuestion[] }>(genText);
    questions = parsed.questions;
  } catch {
    return Response.json({ error: "Failed to generate questions" }, { status: 500 });
  }

  // Build first message (AI asks first question)
  const firstQuestion = questions[0];
  const openingMessage: PracticeMessage = {
    role: "assistant",
    type: "question",
    content: firstQuestion.text,
    question_index: 0,
  };

  // Create session in DB
  const { data: session, error } = await supabase
    .from("practice_sessions")
    .insert({
      user_id: user.id,
      application_id: applicationId,
      stage,
      questions,
      messages: [openingMessage],
      feedback_mode: feedbackMode,
      current_question_index: 0,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(session, { status: 201 });
}
