// ─── User Profile ────────────────────────────────────────────────────────────

export type WorkStyle = "remote" | "hybrid" | "onsite";

/** Per-dimension importance weights for fit scoring (1 = low, 10 = high) */
export interface FitWeights {
  salary: number;
  company_type: number;
  funding_stage: number;
  domain: number;
  work_style: number;
}

export const DEFAULT_FIT_WEIGHTS: FitWeights = {
  salary: 5,
  company_type: 5,
  funding_stage: 5,
  domain: 5,
  work_style: 5,
};

/** The user's job-search preferences, stored in the `profiles` Supabase table */
export interface UserProfile {
  id: string;
  desired_position: string;
  salary_floor: number;                // "X and above" — minimum acceptable salary
  company_sizes: string[];             // multi-select e.g. ["11–50", "51–200"]
  company_types: string[];             // multi-select e.g. ["Startup", "Scale-up"]
  funding_stages: string[];            // multi-select e.g. ["Seed", "Series A"]
  domains: string[];                   // free-form tags e.g. ["SaaS", "Climate Tech"]
  work_style: WorkStyle;
  fit_weights: FitWeights | null;
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
  founded_year: string;
  competitors: string[];
  business_model: string;
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

// ─── Application Tracker ─────────────────────────────────────────────────────

export type ApplicationStage =
  | "applied"
  | "intro_call"
  | "hiring_manager"
  | "technical"
  | "panel"
  | "contract"
  | "offer";

export type ApplicationStatus =
  | "active"
  | "pending_company"
  | "pending_me"
  | "rejected"
  | "withdrew"
  | "offer_received"
  | "accepted";

export interface JobApplication {
  id: string;
  user_id: string;
  company_name: string;
  position: string;
  job_description: string | null;
  job_posting_url: string | null;
  resume_submitted_filename: string | null;
  resume_submitted_text: string | null;
  resume_storage_path: string | null;
  date_started: string;           // ISO date string e.g. "2026-06-24"
  stage: ApplicationStage;
  status: ApplicationStatus;
  notes: string | null;
  research_session_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── History ─────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: string;                              // session UUID
  user_id: string;
  company_name: string;
  job_title: string | null;
  job_description: string | null;
  company_research: CompanyResearch | null;
  position_research: PositionResearch | null;
  tailored_resume: TailoredResume | null;
  created_at: string;
  updated_at: string;
}
