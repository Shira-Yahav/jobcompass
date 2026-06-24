import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { parseJsonResponse } from "@/lib/parseJson";
import type { PracticeQuestion, PracticeMessage, FeedbackMode, ApplicationStage } from "@/types";

const anthropic = new Anthropic();

const QUESTION_COUNT: Record<string, number> = {
  applied: 8, intro_call: 8, hiring_manager: 10, technical: 10, panel: 12,
};

const STAGE_GUIDE: Record<string, string> = {
  applied: `
STAGE: General / Initial Screen
Focus: Why this company, why this role, career story and trajectory, PM fundamentals.
Question mix: 30% motivation/fit, 30% career narrative, 40% basic PM competency.
Tone: Conversational, exploratory — the interviewer is deciding whether to move forward.`,

  intro_call: `
STAGE: Recruiter / Intro Call
Focus: High-level background, culture fit, compensation alignment, logistics.
Question mix: 40% background & motivation, 30% culture & working style, 30% role expectations.
Tone: Friendly, efficient — recruiter is qualifying for the hiring manager.`,

  hiring_manager: `
STAGE: Hiring Manager Interview
Focus: Deep behavioral questions with the STAR framework, leadership under pressure, cross-functional influence, strategic thinking, impact and ownership.
Question mix: 50% behavioral (STAR), 25% situational, 25% strategic/product thinking.
Tone: Conversational but evaluative — looking for leadership potential and culture fit at depth.
Examples of strong questions for this stage:
- "Tell me about a time you had to make a product decision with incomplete data and tight deadlines."
- "Walk me through a situation where you had to push back on engineering's technical constraints."
- "Describe the most complex stakeholder situation you've managed — what made it hard?"`,

  technical: `
STAGE: Technical / Product Interview
Focus: Product sense, metrics, prioritization frameworks, root-cause analysis, data-driven decisions.
Question mix: 40% product sense (design/improve a product), 30% metrics & analytics, 30% prioritization.
Tone: Case-study style — interviewer wants to hear structured thinking out loud.
Examples of strong questions for this stage:
- "How would you define success metrics for [specific feature relevant to this company]?"
- "Walk me through how you'd prioritize 5 competing features with limited engineering bandwidth."
- "If our [relevant metric] dropped 20% overnight, how would you diagnose it?"`,

  panel: `
STAGE: Panel Interview
Focus: Variety — each interviewer owns a different angle. Expect behavioral, product sense, cross-functional, and leadership questions mixed together.
Question mix: 25% behavioral, 25% product design, 25% metrics/analytical, 25% leadership & conflict.
Tone: More formal — multiple interviewers, less repetition, each question must count.`,
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

  // Load application + profile in parallel
  const [{ data: app }, { data: profile }] = await Promise.all([
    supabase
      .from("job_applications")
      .select("company_name, position, job_description, resume_submitted_text")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("profiles")
      .select("resume_text, desired_position")
      .eq("id", user.id)
      .single(),
  ]);

  if (!app) return Response.json({ error: "Application not found" }, { status: 404 });

  const count = QUESTION_COUNT[stage] ?? 10;
  // Prefer submitted resume; fall back to profile resume
  const resumeText = app.resume_submitted_text ?? (profile as { resume_text: string | null } | null)?.resume_text ?? null;

  const jdBlock    = app.job_description  ? `\n\nJOB DESCRIPTION (read carefully — reference it in questions):\n${app.job_description.slice(0, 4000)}`  : "";
  const resumeBlock = resumeText          ? `\n\nCANDIDATE RESUME (read carefully — reference specific experiences):\n${resumeText.slice(0, 3000)}` : "";
  const stageGuide  = STAGE_GUIDE[stage] ?? STAGE_GUIDE.applied;

  const genPrompt = `You are a senior PM interviewer at ${app.company_name || "a tech company"} interviewing a candidate for a ${app.position || "Product Manager"} role.
${stageGuide}
${jdBlock}
${resumeBlock}

YOUR TASK: Generate exactly ${count} interview questions for this specific candidate and role.

LENGTH RULE (most important): Each question must be 1 sentence, 2 sentences maximum. Short. Direct. How a real person actually asks — not a formal written question. No preambles like "Given your background in X and the fact that Y..." Just ask it.

GOOD: "What's the metric you'd use to measure success for a new onboarding flow?"
GOOD: "Tell me about a time you had to ship something you didn't fully agree with."
BAD: "Given the complexity of product decisions at a company like ${app.company_name || "this company"} and considering your background, could you walk me through a comprehensive example of how you would approach prioritization when faced with multiple competing stakeholders?"

QUALITY RULES:
1. Every question must be grounded in the JD, the candidate's resume, or ${app.company_name || "this company"}'s specific context — no generic questions
2. Vary types per the stage guide — don't cluster all behavioral or all product
3. Progress from warm-up to harder

INTRO RULES:
- 2-3 conversational sentences. Sounds like a real person, not a script.
- Mention the company name and stage naturally. Don't ask a question in the intro.

${!resumeText ? "No resume available — base questions on the JD and company context only." : ""}
${!app.job_description ? "No JD available — base questions on the company name, role title, and stage." : ""}

Return ONLY valid JSON (no markdown, no explanation):
{
  "intro": "Hi [Name]! I'm [FirstName LastName], [their title] at ${app.company_name || "the company"}. Thanks for making time today...",
  "questions": [
    {
      "index": 0,
      "text": "...",
      "type": "behavioral|product_sense|situational|technical|company_specific|motivation"
    }
  ]
}`;

  const genMsg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    messages: [{ role: "user", content: genPrompt }],
  });

  const genText = genMsg.content[0].type === "text" ? genMsg.content[0].text : "";
  let questions: PracticeQuestion[];
  let intro: string;
  try {
    const parsed = parseJsonResponse<{ intro: string; questions: PracticeQuestion[] }>(genText);
    questions = parsed.questions;
    intro = parsed.intro ?? `Hi! I'm your interviewer at ${app.company_name || "the company"}. Thanks for joining — let's get started.`;
  } catch {
    return Response.json({ error: "Failed to generate questions" }, { status: 500 });
  }

  const introMessage: PracticeMessage = {
    role: "assistant", type: "acknowledgment", content: intro,
  };
  const openingMessage: PracticeMessage = {
    role: "assistant", type: "question", content: questions[0].text, question_index: 0,
  };

  const { data: session, error } = await supabase
    .from("practice_sessions")
    .insert({
      user_id: user.id,
      application_id: applicationId,
      stage,
      questions,
      messages: [introMessage, openingMessage],
      feedback_mode: feedbackMode,
      current_question_index: 0,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(session, { status: 201 });
}
