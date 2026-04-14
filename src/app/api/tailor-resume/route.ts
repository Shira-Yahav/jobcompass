import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { parseJsonResponse } from "@/lib/parseJson";
import type { UserProfile, TailoredResume, ChatMessage } from "@/types";

const anthropic = new Anthropic();

/**
 * POST /api/tailor-resume
 * Body: { jobDescription: string; companyName: string; history?: ChatMessage[] }
 *
 * First call (empty history):
 *   Returns TailoredResume JSON — full rewritten resume + percentage score + changes summary
 *
 * Follow-up calls (history provided):
 *   Continues the conversation; returns { reply: string } where reply is either
 *   an updated resume markdown or an explanation of changes made.
 */
export async function POST(request: Request) {
  const { jobDescription, companyName, history } = (await request.json()) as {
    jobDescription: string;
    companyName: string;
    history?: ChatMessage[];
  };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const p = profile as UserProfile | null;

  if (!p?.resume_text) {
    return Response.json({ error: "Please upload your resume first." }, { status: 400 });
  }

  const systemPrompt = `You are a professional resume writer and ATS optimisation expert. Your job is to rewrite the candidate's resume to maximise their chances of passing automated screening and impressing a recruiter for the specific role below.

━━━ ABSOLUTE RULES — READ THESE FIRST ━━━
The following are NON-NEGOTIABLE. Violating any of these is a critical error:

1. NEVER change dates, years, month/year ranges, or durations.
   - If the resume says "2019–2022", the tailored version must say "2019–2022".
   - If it says "3 years", keep "3 years". Never infer or recalculate tenure.

2. NEVER alter numbers, metrics, or percentages unless instructed by the candidate.
   - "$2M ARR" stays "$2M ARR". "40%" stays "40%". Do not inflate or round.

3. NEVER change company names, job titles, degree names, universities, or institutions.
   - The legal and verifiable record must stay intact.

4. NEVER fabricate experience, skills, certifications, or accomplishments.
   - Do not add technologies, methodologies, or responsibilities that are not in the original resume or the candidate's additional context.
   - If the job description asks for a skill the candidate doesn't have, do NOT add it.

5. NEVER invent or imply responsibilities the candidate didn't hold.
   - You may rephrase an existing bullet to be clearer or stronger, but the underlying claim must be in the source material.

What you MAY do:
- Reorder bullets within a role to lead with the most relevant accomplishments for this JD
- Rephrase bullets for clarity, impact, and ATS keyword alignment — using stronger verbs and quantifying where numbers already exist
- Reorder sections (e.g. move Skills above Experience if it helps)
- Rewrite the summary/objective section entirely based on existing experience
- Add keywords from the JD that genuinely reflect the candidate's existing experience
- Adjust tone to match company culture (lean/scrappy for early-stage; structured for enterprise)
- Remove irrelevant content that weakens the application for this specific role

━━━ CONTEXT ━━━
COMPANY: ${companyName || "Not specified"}

JOB DESCRIPTION:
${jobDescription}

CANDIDATE RESUME (SOURCE OF TRUTH — do not add anything not present here or in additional context):
${p.resume_text}

ADDITIONAL CONTEXT FROM CANDIDATE:
${p.additional_context || "None"}

CANDIDATE PREFERENCES:
- Desired role: ${p.desired_position || "not specified"}
- Min salary: $${p.salary_floor?.toLocaleString()} and above
- Company types: ${p.company_types?.join(", ") || "any"}
- Domains: ${p.domains?.join(", ") || "any"}
- Work style: ${p.work_style || "not specified"}

━━━ OUTPUT FORMAT ━━━
On the FIRST message, return ONLY valid JSON (no markdown fences):
{
  "resume_markdown": "string — full rewritten resume in clean markdown (## for sections, **bold** for company/role headers, - for bullets). Preserve ALL dates, numbers, company names, and titles exactly as in the source.",
  "interview_likelihood": {
    "score": number (0–100, integer),
    "explanation": "string — 4–5 sentences on the likelihood of advancing to interview, referencing specific JD requirements and how the tailored resume addresses them",
    "methodology": "string — factors: keyword density vs JD, experience relevance, format/ATS readiness, strength of quantified accomplishments, gaps that could raise recruiter concerns"
  },
  "changes_summary": "string — 4–6 bullet points (\\n- separated) describing exactly what was changed and why; be specific (e.g. '- Moved data analysis bullet to top of Role X to match JD emphasis on analytics')"
}

On FOLLOW-UP messages (when the user asks for refinements), apply the same ABSOLUTE RULES above and return:
{ "reply": "string — the complete updated resume in markdown if changes were made, or a brief explanation if the requested change cannot be made without fabricating information" }

If the user asks you to add something you cannot add without violating the rules (e.g. add a skill they don't have), explain clearly why and suggest an alternative you CAN do.`;

  const isFirstCall = !history || history.length === 0;

  const messages: Anthropic.MessageParam[] = isFirstCall
    ? [{ role: "user", content: "Please tailor my resume for this role." }]
    : history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const parsed = parseJsonResponse<TailoredResume | { reply: string }>(text);
    return Response.json(parsed);
  } catch {
    return Response.json(
      { error: "Failed to parse AI response", raw: text },
      { status: 500 }
    );
  }
}
