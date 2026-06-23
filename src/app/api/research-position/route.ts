import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { parseJsonResponse } from "@/lib/parseJson";
import type { UserProfile, PositionResearch } from "@/types";
import { DEFAULT_FIT_WEIGHTS } from "@/types";

const anthropic = new Anthropic();

/**
 * POST /api/research-position
 * Body: { companyName: string; jobDescription: string }
 *
 * Returns PositionResearch with:
 * - preference_match %: how well the role matches the user's stated preferences
 * - experience_match %: how well the user's resume qualifies them for this role
 * - key_gaps / key_strengths: dynamic lists (as many as genuinely relevant)
 * - actionable_advice: 2–4 concrete suggestions to improve candidacy
 */
export async function POST(request: Request) {
  const { companyName, jobDescription } = (await request.json()) as {
    companyName: string;
    jobDescription: string;
  };

  if (!jobDescription?.trim()) {
    return Response.json({ error: "jobDescription is required" }, { status: 400 });
  }

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
  const weights = p?.fit_weights ?? DEFAULT_FIT_WEIGHTS;

  // Normalise weights into percentage-style strings for the prompt
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const weightPct = (key: keyof typeof weights) =>
    `${Math.round((weights[key] / totalWeight) * 100)}%`;

  const preferenceSummary = p
    ? `
- Desired role: ${p.desired_position || "not specified"}
- Minimum salary: $${p.salary_floor?.toLocaleString()} and above
- Preferred company types: ${p.company_types?.join(", ") || "any"}
- Preferred funding stages: ${p.funding_stages?.join(", ") || "any"}
- Preferred company sizes: ${p.company_sizes?.join(", ") || "any"}
- Preferred domains/industries: ${p.domains?.join(", ") || "any"}
- Work style: ${p.work_style || "not specified"}
`.trim()
    : "No preferences saved.";

  const resumeSection = p?.resume_text
    ? `CANDIDATE RESUME:\n${p.resume_text}\n\nADDITIONAL CONTEXT:\n${p.additional_context || "None"}`
    : "No resume uploaded. Score experience match based on the preferences and role description alone.";

  const weightNote = `
SCORING WEIGHTS (user-configured importance; use these to bias the preference_match score):
- Salary alignment: ${weightPct("salary")} weight
- Company type alignment: ${weightPct("company_type")} weight
- Funding stage alignment: ${weightPct("funding_stage")} weight
- Domain/industry alignment: ${weightPct("domain")} weight
- Work style alignment: ${weightPct("work_style")} weight
`.trim();

  const prompt = `You are a senior technical recruiter and career strategist with 15+ years of experience hiring PMs, engineers, and operators at both startups and large enterprises. Your role is to give a candidate an honest, specific, and actionable assessment of how well they fit a role — not to encourage them, but to equip them with accurate intelligence.

━━━ ROLE CONTEXT ━━━
COMPANY: ${companyName || "Not specified"}

JOB DESCRIPTION:
${jobDescription}

━━━ CANDIDATE CONTEXT ━━━
PREFERENCES:
${preferenceSummary}

${resumeSection}

━━━ SCORING CONFIGURATION ━━━
${weightNote}

━━━ YOUR TASK ━━━
Produce a structured fit assessment. Be direct and specific — vague feedback ("you have strong experience") is useless. Every claim must be grounded in the job description or the candidate's resume/preferences.

Return ONLY valid JSON matching this exact structure (no markdown fences, no extra text):
{
  "role_summary": "string — 2–3 sentences: what this role actually is, what success looks like in year 1, and what kind of person typically gets hired for it",
  "preference_match": {
    "score": number (0–100, integer),
    "explanation": "string — 3–4 sentences overall assessment of preference alignment",
    "methodology": "string — one sentence on scoring approach including how the user-configured weights influenced this score",
    "dimensions": [
      {
        "label": "Job title / level",
        "status": "match|partial|mismatch|unknown",
        "detail": "string — '[desired title] wanted → this role is [actual title/level]. [assessment]'"
      },
      {
        "label": "Salary",
        "status": "match|partial|mismatch|unknown",
        "detail": "string — '$[floor]+ minimum → [what is known about comp for this role/company]. [likelihood assessment]'"
      },
      {
        "label": "Company type",
        "status": "match|partial|mismatch|unknown",
        "detail": "string — '[preferred types] → this company is [type]. [assessment]'"
      },
      {
        "label": "Funding stage",
        "status": "match|partial|mismatch|unknown",
        "detail": "string — '[preferred stages] → [actual stage if known]. [assessment]'"
      },
      {
        "label": "Domain",
        "status": "match|partial|mismatch|unknown",
        "detail": "string — '[preferred domains] → [company domain]. [assessment]'"
      },
      {
        "label": "Work style",
        "status": "match|partial|mismatch|unknown",
        "detail": "string — '[preferred style] → [what the JD or company indicates]. [assessment]'"
      }
    ]
  },
  "experience_match": {
    "score": number (0–100, integer),
    "explanation": "string — 3–4 sentences on how well the candidate's background qualifies them for this role",
    "methodology": "string — one sentence on scoring approach",
    "dimensions": [
      {
        "label": "Years of experience",
        "status": "match|partial|mismatch|unknown",
        "detail": "string — '[JD requirement] → candidate has [evidence from resume]. [assessment]'"
      },
      {
        "label": "Core domain skills",
        "status": "match|partial|mismatch|unknown",
        "detail": "string — key skill match/gap from JD vs resume evidence"
      },
      {
        "label": "Industry background",
        "status": "match|partial|mismatch|unknown",
        "detail": "string — relevant industry experience from resume vs what role requires"
      },
      {
        "label": "Leadership / management",
        "status": "match|partial|mismatch|unknown",
        "detail": "string — what JD requires vs what resume shows"
      },
      {
        "label": "Key qualifications",
        "status": "match|partial|mismatch|unknown",
        "detail": "string — any standout requirements (technical, credentials, etc.) and how candidate measures up"
      }
    ]
  },
  "key_strengths": ["string — specific strength with evidence, e.g. '5+ yrs B2B SaaS PM matches JD core requirement'", "..."],
  "key_gaps": ["string — specific gap with impact, e.g. 'No enterprise sales exposure — JD lists it as preferred'", "..."],
  "actionable_advice": ["string — concrete, specific action, e.g. 'Add a bullet under Role X quantifying ARR impact to address the revenue ownership requirement'", "..."]
}

RULES:
- key_strengths and key_gaps: include every genuinely relevant one — do not pad and do not omit real issues; each under 15 words; ground each in resume or JD evidence
- actionable_advice: 2–4 items; must be specific and immediately actionable (not "improve your resume" — say exactly what to change and where); only advise on things within the candidate's control
- Scoring:
  - 85–100: candidate is a strong fit who should apply confidently
  - 65–84: solid fit with addressable gaps
  - 40–64: real gaps that may require explanation or mitigation
  - 0–39: significant misalignment — candidate should understand the risk before applying
- If no resume was uploaded, score experience_match based solely on the preferences and role level match; note this limitation explicitly in the methodology field
- Do not soften negative assessments — a candidate who receives sugar-coated feedback wastes time applying to the wrong roles`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const result = parseJsonResponse<PositionResearch>(text);
    return Response.json(result);
  } catch {
    return Response.json(
      { error: "Failed to parse AI response", raw: text },
      { status: 500 }
    );
  }
}
