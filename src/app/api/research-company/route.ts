import Anthropic from "@anthropic-ai/sdk";
import { tavily } from "@tavily/core";
import { createClient } from "@/lib/supabase/server";
import { parseJsonResponse } from "@/lib/parseJson";
import type { UserProfile, FitWeights, CompanyResearch } from "@/types";
import { DEFAULT_FIT_WEIGHTS } from "@/types";

const anthropic = new Anthropic();

/**
 * POST /api/research-company
 * Body: { companyName: string }
 *
 * Flow:
 * 1. Run two Tavily web searches to pull fresh, real-world data about the company
 * 2. Load the user's profile preferences from Supabase
 * 3. Send the search results + preferences to Claude for structured analysis
 *
 * Returns: CompanyResearch JSON with all fields + a percentage fit score
 */
export async function POST(request: Request) {
  const { companyName } = (await request.json()) as { companyName: string };

  if (!companyName?.trim()) {
    return Response.json({ error: "companyName is required" }, { status: 400 });
  }

  // ── 1. Load user profile ─────────────────────────────────────────────────
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

  const preferenceSummary = p
    ? `
- Desired role: ${p.desired_position || "not specified"}
- Minimum salary: $${p.salary_floor?.toLocaleString()} and above
- Preferred company types: ${p.company_types?.join(", ") || "any"}
- Preferred funding stages: ${p.funding_stages?.join(", ") || "any"}
- Preferred company sizes: ${p.company_sizes?.join(", ") || "any"} employees
- Preferred domains/industries: ${p.domains?.join(", ") || "any"}
- Work style: ${p.work_style || "not specified"}
`.trim()
    : "No preferences saved.";

  // Normalize fit weights to percentages (same logic as research-position)
  const rawWeights = (p?.fit_weights as FitWeights | null) ?? DEFAULT_FIT_WEIGHTS;
  const total = Object.values(rawWeights).reduce((a, b) => a + b, 0) || 1;
  const pct = (v: number) => Math.round((v / total) * 100);
  const weightConfig = `SCORING CONFIGURATION — User importance weights (must sum to ~100%):
- Salary potential: ${pct(rawWeights.salary)}%
- Company type: ${pct(rawWeights.company_type)}%
- Funding stage: ${pct(rawWeights.funding_stage)}%
- Industry / domain: ${pct(rawWeights.domain)}%
- Work style: ${pct(rawWeights.work_style)}%`;

  // ── 2. Tavily web search — pull fresh company data ───────────────────────
  let searchContext = "";
  // Track sources with index so Claude can reference them by number
  const sourcesMap: Array<{ url: string; title: string }> = [];

  try {
    const tv = tavily({ apiKey: process.env.TAVILY_API_KEY! });

    // Run five searches in parallel
    const [fundingSearch, productSearch, linkedinSearch, employeesSearch, competitorsSearch] = await Promise.all([
      tv.search(`${companyName} funding rounds history crunchbase series seed`, {
        maxResults: 4,
        searchDepth: "basic",
      }),
      tv.search(`${companyName} product value proposition what they do`, {
        maxResults: 4,
        searchDepth: "basic",
      }),
      tv.search(`${companyName} linkedin company employees headcount`, {
        maxResults: 3,
        searchDepth: "basic",
      }),
      tv.search(`${companyName} total employees team size 2024 2025`, {
        maxResults: 3,
        searchDepth: "basic",
      }),
      tv.search(`${companyName} founded year history top competitors market`, {
        maxResults: 4,
        searchDepth: "basic",
      }),
    ]);

    const allResults = [
      ...fundingSearch.results,
      ...productSearch.results,
      ...linkedinSearch.results,
      ...employeesSearch.results,
      ...competitorsSearch.results,
    ];

    // Deduplicate by URL, build numbered source list
    const seen = new Set<string>();
    const dedupedResults: typeof allResults = [];
    for (const r of allResults) {
      if (!seen.has(r.url)) {
        seen.add(r.url);
        dedupedResults.push(r);
        sourcesMap.push({ url: r.url, title: r.title ?? r.url });
      }
    }

    // Number each source so Claude can cite them as [1], [2], etc.
    searchContext = dedupedResults
      .map((r, i) => `[${i + 1}] SOURCE: ${r.url}\nTITLE: ${r.title ?? ""}\n${r.content}`)
      .join("\n\n---\n\n");
  } catch {
    // Tavily search is best-effort — Claude will fall back to training knowledge
    searchContext = "Web search unavailable. Use your training knowledge.";
  }

  // ── 3. Claude analysis ───────────────────────────────────────────────────
  const prompt = `You are a senior company research analyst with expertise in venture capital, product strategy, and job-market intelligence. Your job is to produce an accurate, well-sourced briefing on "${companyName}" to help a job candidate decide whether to pursue a role there.

━━━ WEB SEARCH RESULTS ━━━
The following sources were retrieved in real time. Each is numbered [1], [2], etc.
${searchContext}

━━━ CANDIDATE PREFERENCES ━━━
${preferenceSummary}

━━━ ${weightConfig}

━━━ YOUR TASK ━━━
Synthesise the search results (prioritised) with your training knowledge (as a fallback) to fill in every field below. For factual claims (funding, investors, size, stage), ONLY state information you found in the search results or are highly confident about. If a field is genuinely unknown, use the string "unknown" — do not guess or invent.

Return ONLY valid JSON matching this exact structure (no markdown fences, no extra text):
{
  "name": "string — official company name as found in sources",
  "company_type": "string — Startup / Scale-up / Corporate / Public Company / Agency / Non-profit / Government",
  "funding_stage": "string — e.g. Series B / IPO / Bootstrapped / unknown",
  "total_raised": "string — total disclosed funding e.g. $42M; if you find individual round amounts (seed, Series A, B, etc.), ADD THEM UP to produce a total; use 'unknown' if no funding figures found in sources",
  "last_round_date": "string — month/quarter and year of most recent round e.g. Q3 2023; 'unknown' if not found",
  "key_investors": ["string", "..."],
  "company_size": "string — employee count or range e.g. '200–500 employees'; check LinkedIn and headcount sources — 'unknown' only if genuinely not found",
  "founded_year": "string — year the company was founded e.g. '2018'; 'unknown' if not found in sources",
  "competitors": ["string — top competitor company name", "..."],
  "business_model": "string — primary model: B2B / B2C / B2B2C / B2E / Marketplace / Other (be specific, e.g. 'B2B SaaS')",
  "value_proposition": "string — 2–3 sentences on the value they deliver and to whom",
  "problem_solved": "string — 2–3 sentences on the specific problem they address",
  "technology_stack": "string — notable technologies, architecture, or technical approach mentioned in sources (1–2 sentences; omit if nothing found)",
  "gtm_strategy": "string — 2–3 sentences on their go-to-market motion (sales-led, PLG, channel, etc.)",
  "solution_summary": "string — clear, jargon-free 1–2 sentence description of their product or service",
  "fit_score": {
    "score": number (0–100, integer),
    "explanation": "string — 3–4 sentences overall evaluation of whether this company is a good match",
    "methodology": "string — one sentence explaining the scoring approach",
    "dimensions": [
      {
        "label": "Company type",
        "status": "match|partial|mismatch|unknown",
        "detail": "string — '[preference] preferred → this company is [type]. [one sentence why it matches/doesn't]'"
      },
      {
        "label": "Funding stage",
        "status": "match|partial|mismatch|unknown",
        "detail": "string — '[stage(s)] preferred → [actual stage]. [brief assessment]'"
      },
      {
        "label": "Company size",
        "status": "match|partial|mismatch|unknown",
        "detail": "string — '[size range] preferred → [actual size]. [brief assessment]'"
      },
      {
        "label": "Industry / domain",
        "status": "match|partial|mismatch|unknown",
        "detail": "string — '[domain(s)] preferred → [company domain]. [brief assessment]'"
      },
      {
        "label": "Work style",
        "status": "match|partial|mismatch|unknown",
        "detail": "string — '[style] preferred → [what is known about this company's policy]. [assessment or 'unknown from available sources']'"
      },
      {
        "label": "Salary potential",
        "status": "match|partial|mismatch|unknown",
        "detail": "string — '$[floor]+ expected → Companies at this [stage]/[size] typically offer $[range] for [role]. [assessment of likelihood of meeting floor]'"
      }
    ]
  },
  "sources": [
    { "url": "string — exact URL from search results above", "title": "string — page title or descriptive label" }
  ]
}

SOURCE CITATION RULES:
- The "sources" array must list every search result that you actually drew on to populate the fields above.
- Only include sources from the numbered list provided — do not fabricate URLs.
- If web search was unavailable and you relied on training knowledge, set "sources" to an empty array [].

SCORING RULES:
- Weight each dimension by the percentage in the SCORING CONFIGURATION block above. Dimensions with higher weight should have proportionally more impact on the final score.
- 85–100: strong match on high-weight dimensions
- 65–84: good match with minor mismatches on lower-weight dimensions
- 40–64: meaningful gaps on 2+ dimensions that carry significant weight
- 0–39: significant misalignment on the most important dimensions
- Be honest — a score of 50 is not a failure, it just means real trade-offs exist.`;


  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const result = parseJsonResponse<CompanyResearch>(text);
    return Response.json(result);
  } catch {
    return Response.json(
      { error: "Failed to parse AI response", raw: text },
      { status: 500 }
    );
  }
}
