// ─── User Profile ────────────────────────────────────────────────────────────

export type WorkStyle = "remote" | "hybrid" | "onsite";
export type RoleType = "ic" | "manager" | "both";

/** The user's job-search preferences, stored in the `profiles` Supabase table */
export interface UserProfile {
  id: string;
  desired_position: string;
  salary_floor: number;                // "X and above" — minimum acceptable salary
  company_sizes: string[];             // multi-select e.g. ["11–50", "51–200"]
  company_types: string[];             // multi-select e.g. ["Startup", "Scale-up"]
  funding_stages: string[];            // multi-select e.g. ["Seed", "Series A"]
  domains: string[];                   // free-form tags e.g. ["SaaS", "Climate Tech"]
  role_type: RoleType;
  work_style: WorkStyle;
  resume_text: string | null;
  resume_filename: string | null;
  additional_context: string | null;
  updated_at: string;
}

// ─── AI Feature Outputs ──────────────────────────────────────────────────────

/** One preference dimension inside a FitScore — shows per-category match/mismatch */
export interface FitScoreDimension {
  label: string;                                        // e.g. "Company type", "Salary potential"
  status: "match" | "partial" | "mismatch" | "unknown";
  detail: string;                                       // e.g. "Startup preferred → Series B startup ✓"
}

/**
 * Score returned by every AI feature.
 * score: 0–100 (percentage)
 * explanation: human-readable reasoning
 * methodology: how the score was calculated (which factors were weighted and how)
 * dimensions: per-preference breakdown shown in the score modal
 */
export interface FitScore {
  score: number;        // 0–100
  explanation: string;
  methodology: string;
  dimensions?: FitScoreDimension[];
}

/** A cited source returned by company research */
export interface ResearchSource {
  url: string;
  title: string;
}

/** Company Research API response */
export interface CompanyResearch {
  name: string;
  company_type: string;
  funding_stage: string;
  total_raised: string;
  last_round_date: string;
  key_investors: string[];
  company_size: string;
  value_proposition: string;
  problem_solved: string;
  technology_stack: string;
  gtm_strategy: string;
  solution_summary: string;
  fit_score: FitScore;
  sources: ResearchSource[];   // URLs Claude drew on, shown to the user as links
}

/** Position Research API response */
export interface PositionResearch {
  role_summary: string;
  preference_match: FitScore;
  experience_match: FitScore;
  key_gaps: string[];          // dynamic length — as many as genuinely relevant
  key_strengths: string[];     // dynamic length
  actionable_advice: string[]; // 2–4 concrete suggestions to improve chances
}

/** Tailor Resume API response */
export interface TailoredResume {
  resume_markdown: string;
  interview_likelihood: FitScore;
  changes_summary: string;
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
