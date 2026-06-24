import Anthropic from "@anthropic-ai/sdk";
import { tavily } from "@tavily/core";
import { createClient } from "@/lib/supabase/server";
import { parseJsonResponse } from "@/lib/parseJson";
import type { PracticeQuestion, PracticeMessage, FeedbackMode, ApplicationStage } from "@/types";

const anthropic = new Anthropic();

const QUESTION_COUNT: Record<string, number> = {
  applied: 8, intro_call: 8, hiring_manager: 10, technical: 10, panel: 12,
};

// Who is interviewing and what they care about at each stage
const INTERVIEWER_PERSONA: Record<string, { title: string; focus: string; questionMix: string; probeStyle: string }> = {
  applied: {
    title: "Talent Acquisition Specialist",
    focus: "Assessing career motivation, baseline PM competency, and cultural alignment before passing to the hiring team.",
    questionMix: "30% motivation & fit, 30% career story, 40% foundational PM skills",
    probeStyle: "Warm and exploratory. You're deciding whether to move this person forward, not testing them deeply yet.",
  },
  intro_call: {
    title: "Technical Recruiter",
    focus: "Qualifying the candidate on background, logistics, compensation expectations, and whether they're genuinely excited about this company.",
    questionMix: "40% background & motivation, 30% culture & working style, 30% logistics and expectations",
    probeStyle: "Efficient and friendly. You have 30 minutes — you want signal fast.",
  },
  hiring_manager: {
    title: "Director of Product / VP of Product",
    focus: "Deep evaluation of leadership, judgment under uncertainty, cross-functional influence, and strategic thinking. You are assessing whether this person can own outcomes — not just execute tasks.",
    questionMix: "50% behavioral (STAR — leadership, conflict, ambiguity), 25% situational judgment, 25% strategic product thinking",
    probeStyle: "Direct and probing. When an answer is vague or generic, you push: 'What specifically did you decide, and why?' You care about ownership and impact, not process.",
  },
  technical: {
    title: "Senior Product Manager / Product Lead",
    focus: "Evaluating product thinking: how the candidate frames problems, defines metrics, makes prioritization trade-offs, and reasons analytically about user behavior and business outcomes.",
    questionMix: "35% product design/sense, 30% metrics & data analysis, 35% prioritization frameworks",
    probeStyle: "Case-study style. You present scenarios and listen for structured thinking. You're not looking for a single right answer — you want to hear their reasoning process and whether they ask the right questions.",
  },
  panel: {
    title: "Cross-functional Panel (Design, Engineering, Data, PM)",
    focus: "Each panelist tests a different dimension. Expect behavioral depth, product creativity, data fluency, and leadership presence in one session.",
    questionMix: "25% behavioral, 25% product design, 25% metrics/analytics, 25% cross-functional leadership",
    probeStyle: "More formal. Questions are precise and distinct — panelists coordinate to avoid overlap. Expect follow-ups from different angles.",
  },
};

async function searchCompanyContext(companyName: string): Promise<string> {
  if (!companyName || !process.env.TAVILY_API_KEY) return "";

  try {
    const tv = tavily({ apiKey: process.env.TAVILY_API_KEY });

    // Two targeted searches run in parallel
    const [companySearch, interviewSearch] = await Promise.all([
      tv.search(`${companyName} company product what they do business model funding`, {
        maxResults: 4,
        searchDepth: "basic",
      }),
      tv.search(`${companyName} product manager interview questions process Glassdoor`, {
        maxResults: 3,
        searchDepth: "basic",
      }),
    ]);

    const allResults = [...companySearch.results, ...interviewSearch.results];
    const seen = new Set<string>();
    const lines: string[] = [];

    for (const r of allResults) {
      if (!seen.has(r.url)) {
        seen.add(r.url);
        lines.push(`SOURCE: ${r.url}\n${r.content?.slice(0, 400) ?? ""}`);
      }
    }

    return lines.join("\n\n---\n\n");
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { applicationId, stage, feedbackMode } = (await request.json()) as {
    applicationId: string;
    stage: ApplicationStage;
    feedbackMode: FeedbackMode;
  };

  // Load app + profile + web search in parallel
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

  const companyContext = await searchCompanyContext(app.company_name);

  const count = QUESTION_COUNT[stage] ?? 10;
  const resumeText = app.resume_submitted_text ?? (profile as { resume_text: string | null } | null)?.resume_text ?? null;
  const persona = INTERVIEWER_PERSONA[stage] ?? INTERVIEWER_PERSONA.applied;

  // ─── Prompt ───────────────────────────────────────────────────────────────
  // This is the full prompt sent to Sonnet. Everything the AI knows is injected here.

  const prompt = `You are preparing to interview a candidate for a ${app.position || "Product Manager"} role at ${app.company_name || "the company"}.

YOUR ROLE: ${persona.title}
YOUR FOCUS: ${persona.focus}
YOUR QUESTION MIX: ${persona.questionMix}
YOUR STYLE: ${persona.probeStyle}

━━━ COMPANY CONTEXT (from web search) ━━━
${companyContext
  ? `Use this to make questions specific to ${app.company_name}'s actual product, business model, stage, and challenges:\n\n${companyContext}`
  : `No web data available. Use your knowledge of ${app.company_name || "the company"} and infer from the JD.`}

━━━ JOB DESCRIPTION ━━━
${app.job_description
  ? `Reference specific responsibilities, required skills, and keywords from this JD when writing questions:\n\n${app.job_description.slice(0, 4000)}`
  : "No JD provided. Base questions on the company name, role title, and stage."}

━━━ CANDIDATE RESUME ━━━
${resumeText
  ? `Reference specific past roles, companies, projects, and metrics from this resume:\n\n${resumeText.slice(0, 3000)}`
  : "No resume provided. Base questions on company and JD context."}

━━━ YOUR TASK ━━━
Generate exactly ${count} interview questions for this specific candidate and role.

QUESTION WRITING RULES:
1. LENGTH: 1–2 sentences maximum. How a real person asks, not formal prose.
   ✓ "Walk me through how you'd set the north star metric for ${app.company_name || "this product"}."
   ✓ "You mentioned leading a cross-functional launch at [their company from resume] — how did you handle conflicting priorities?"
   ✗ "Could you please elaborate on a comprehensive example from your professional background that demonstrates your ability to manage complex stakeholder dynamics in a product development context?"

2. SPECIFICITY: Every question must be grounded in at least one of:
   - Something specific from the JD (a skill, responsibility, or keyword)
   - Something specific from the candidate's resume (a role, project, company, or metric)
   - Something specific about ${app.company_name}'s product, market, or business model

3. VARIETY: Spread across question types per your mix. Don't cluster 5 behavioral questions in a row.

4. PROGRESSION: Warm-up to harder. First 2 questions ease them in.

INTRO RULES:
- 2–3 sentences. Professional but warm. Sounds like a real ${persona.title}.
- Mention your name, your role, and what this interview will cover.
- Do NOT ask a question in the intro.

Return ONLY valid JSON (no markdown, no explanation):
{
  "intro": "...",
  "questions": [
    { "index": 0, "text": "...", "type": "behavioral|product_sense|situational|technical|company_specific|motivation" }
  ]
}`;

  const genMsg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  const genText = genMsg.content[0].type === "text" ? genMsg.content[0].text : "";
  let questions: PracticeQuestion[];
  let intro: string;
  try {
    const parsed = parseJsonResponse<{ intro: string; questions: PracticeQuestion[] }>(genText);
    questions = parsed.questions;
    intro = parsed.intro ?? `Hi, I'm your interviewer at ${app.company_name || "the company"}. Thanks for joining — let's get started.`;
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
