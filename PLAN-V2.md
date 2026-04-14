# Feature Refinement Plan — V2

**Overall Progress:** `100%`

## TLDR
Refine all four features and the overall design based on product design session. Key changes: profile becomes multi-select preferences with tags, company research gets real web search + richer output, position research gets dynamic output + actionable advice, resume tailoring gets proper markdown rendering + in-place chat updates + download. Full design overhaul to sleek/techy aesthetic. Scores become percentages with methodology explanations.

## Critical Decisions
- **Multi-select chips** — Build lightweight custom chip/tag component using shadcn primitives (no new library) to keep the stack minimal
- **Web search for company research** — Integrate [Tavily](https://tavily.com) API (simple REST, free tier) so Claude can pull real-time data from Crunchbase, LinkedIn, etc. rather than relying on training knowledge alone
- **Scores → percentages** — Change `score: number (0–10)` to `score: number (0–100)` across all types, prompts, and UI; prompt Claude to explain its scoring methodology inline
- **GlobalInputBar placement** — Remove from `(app)/layout.tsx`; render it only inside Company Research, Position Research, and Tailor Resume pages directly
- **Markdown rendering** — Add `react-markdown` + `remark-gfm` to render the tailored resume as a proper formatted document (not a `<pre>` block)
- **Resume chat → in-place update** — When a follow-up chat message returns a revised resume, update the displayed `resume_markdown` in state directly so the document updates live
- **Salary** — Change from min/max range to a single "floor" value ("X and above")
- **Industry/domain** — Replace fixed dropdown with a free-form tag input (type to add, click to remove); pre-populate with common suggestions

---

## Tasks

- [x] 🟩 **Step 1: Foundation — Types, Schema, Shared Components**
  - [x] 🟩 Update `UserProfile` type: replace `salary_min/max` → `salary_floor`, `company_size: string` → `company_sizes: string[]`, `domain: string` → `domains: string[]`, add `company_types: string[]`, add `funding_stages: string[]`
  - [x] 🟩 Update `FitScore` type: `score: number` stays but represents 0–100; add `methodology: string` field explaining how score was calculated
  - [x] 🟩 Update Supabase schema: alter `profiles` table to add new columns (`salary_floor`, `company_sizes`, `company_types`, `funding_stages`, `domains` as text arrays)
  - [x] 🟩 Build reusable `MultiSelect` chip component (shadcn primitives only) — accepts options list, selected values, onChange; renders as dismissable chips with an add button
  - [x] 🟩 Build reusable `TagInput` component — free-form text input that adds tags on Enter/comma; renders as dismissable chips; accepts optional suggestions list
  - [x] 🟩 Update `ScoreCard` component to display percentage (e.g. "83%") instead of "X / 10"; show methodology in a collapsible or secondary text line

- [x] 🟩 **Step 2: Design Overhaul**
  - [x] 🟩 Update global CSS / Tailwind theme: dark slate base (`zinc-900/950` backgrounds), bright accent (indigo or cyan), high-contrast text
  - [x] 🟩 Redesign Sidebar: darker background, subtle active state glow, tighter spacing
  - [x] 🟩 Constrain all `Textarea` elements to a fixed max-height with `overflow-y-auto` — no auto-grow; apply globally via a wrapper or Tailwind utility
  - [x] 🟩 Remove `GlobalInputBar` from `(app)/layout.tsx`; add it directly to Company Research, Position Research, and Tailor Resume pages
  - [x] 🟩 Polish cards: consistent border radius, subtle shadow, slightly more padding

- [x] 🟩 **Step 3: Profile Redesign**
  - [x] 🟩 Replace salary min/max inputs with single "Minimum salary (and above)" number input
  - [x] 🟩 Replace company size single-select with `MultiSelect` component (options: "1–10", "11–50", "51–200", "201–500", "500+")
  - [x] 🟩 Add company type `MultiSelect` (options: "Startup", "Scale-up", "Corporate", "Agency", "Non-profit")
  - [x] 🟩 Add funding stage `MultiSelect` (options: "Pre-seed", "Seed", "Series A", "Series B", "Series C+", "Public", "Bootstrapped", "Any")
  - [x] 🟩 Replace domain dropdown with `TagInput` component (suggestions: "SaaS", "FinTech", "HealthTech", "EdTech", "Climate Tech", "Developer Tools", "Marketplace", "E-commerce", "Enterprise Software", "Consumer", "Defense")
  - [x] 🟩 Update save/load logic to handle array fields (upsert + pre-fill)

- [x] 🟩 **Step 4: Company Research Overhaul**
  - [x] 🟩 Add Tavily API key to `.env.local` and `.env.example`; install `tavily` npm package
  - [x] 🟩 Update `/api/research-company`: before calling Claude, run a Tavily search for `"{companyName} company funding crunchbase"` + `"{companyName} product overview"` to fetch fresh real-world context; inject search results into the Claude prompt
  - [x] 🟩 Update Claude prompt: dynamic framing (not "startup analyst" — "company research analyst covering any company type"); expanded output fields: `company_type` (startup/corporate/etc.), `funding_stage`, `total_raised`, `last_round_date`, `key_investors`, `value_proposition`, `problem_solved`, `technology_stack`, `gtm_strategy`, `company_size`, `solution_summary`
  - [x] 🟩 Change fit score to percentage (0–100) with `methodology` field explaining which profile preferences were weighted and how
  - [x] 🟩 Update `CompanyResearch` type with all new fields
  - [x] 🟩 Update page UI: render new fields in a clean grid; show `methodology` text beneath the percentage score

- [x] 🟩 **Step 5: Position Research Enhancements**
  - [x] 🟩 Update Claude prompt: remove fixed `key_gaps: string[3]` / `key_strengths: string[3]` — make them dynamic arrays (1–6 items each, as many as genuinely relevant)
  - [x] 🟩 Add `actionable_advice: string[]` to prompt output — 2–4 concrete suggestions (e.g. "Emphasise your X experience in the summary section")
  - [x] 🟩 Change both scores to percentages with `methodology` field
  - [x] 🟩 Update `PositionResearch` type
  - [x] 🟩 Update page UI: render `actionable_advice` as a distinct section with a lightbulb icon

- [x] 🟩 **Step 6: Tailor Resume Enhancements**
  - [x] 🟩 Install `react-markdown` and `remark-gfm`
  - [x] 🟩 Replace `<pre>` block with `<ReactMarkdown>` renderer — apply Tailwind prose styles so headers, bold, bullets render correctly
  - [x] 🟩 Add "Copy to clipboard" button above resume output
  - [x] 🟩 Add "Download .txt" button — triggers browser download of `resume_markdown` as plain text file
  - [x] 🟩 Update chat follow-up logic: when Claude returns a reply that contains a full resume (detected by presence of markdown headers), update `tailored.resume_markdown` in state so the displayed document updates in place
  - [x] 🟩 Change interview likelihood score to percentage with `methodology` field
  - [x] 🟩 Update Claude prompt: add instruction to match company tone/culture (scrappy startup vs. enterprise) based on company type and funding stage
