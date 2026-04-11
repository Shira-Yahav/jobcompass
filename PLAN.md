# Feature Implementation Plan

**Overall Progress:** `0%`

## TLDR
Build an AI-powered job search platform MVP with 4 core features: a user profile capturing job preferences, company research (AI overview + fit score), position research (JD match against profile + resume), and resume tailoring (AI-rewritten resume + iterative chat). A shared global input bar (company name + job description) propagates context across all features.

## Critical Decisions
- **Next.js App Router (full-stack)** — single repo, API routes handle Claude calls, deploys to Vercel with no backend infra
- **Claude API (claude-sonnet-4-6)** — all AI features (research, scoring, resume rewriting, chat)
- **Supabase** — auth, Postgres (profile + sessions), file storage (resume PDF)
- **shadcn/ui + Tailwind** — clean UI fast, no custom design system needed for MVP
- **Zustand** — lightweight global state for company name + JD that propagates across features without prop drilling
- **PDF parsing via `pdf-parse`** — extract resume text server-side before sending to Claude

---

## Tasks

- [ ] 🟥 **Step 1: Project Scaffold**
  - [ ] 🟥 Init Next.js 14 app (App Router, TypeScript, Tailwind)
  - [ ] 🟥 Install and configure shadcn/ui
  - [ ] 🟥 Install Anthropic SDK, Supabase client, Zustand, pdf-parse
  - [ ] 🟥 Set up Supabase project: auth, `profiles` table, resume file storage bucket
  - [ ] 🟥 Configure `.env.local` with Supabase URL/key and Anthropic API key
  - [ ] 🟥 Build app shell: sidebar nav with links to all 4 features + auth (sign in / sign up)

- [ ] 🟥 **Step 2: My Profile**
  - [ ] 🟥 Build profile form with fields: desired position, target salary range, company size, domain/industry, role type (IC / manager / both), work style (remote / hybrid / onsite)
  - [ ] 🟥 Save profile to Supabase `profiles` table on submit
  - [ ] 🟥 Load and pre-fill saved profile on page mount

- [ ] 🟥 **Step 3: Global Inputs (shared state)**
  - [ ] 🟥 Create Zustand store with `companyName` and `jobDescription` fields
  - [ ] 🟥 Add a persistent input bar (or sidebar section) visible across all feature pages
  - [ ] 🟥 Verify values are accessible in Company Research, Position Research, and Tailor Resume pages

- [ ] 🟥 **Step 4: Company Research**
  - [ ] 🟥 Build page that reads `companyName` from global store
  - [ ] 🟥 Create `/api/research-company` route: sends company name + user profile to Claude, returns structured overview (funding round, size, GTM strategy, approx. customers, product/solution summary) and a fit score (0–10) with explanation
  - [ ] 🟥 Render output: overview cards + score badge + fit reasoning

- [ ] 🟥 **Step 5: Position Research**
  - [ ] 🟥 Build page that reads `companyName` and `jobDescription` from global store
  - [ ] 🟥 Create `/api/research-position` route: sends JD + user profile + resume text to Claude, returns role fit score (vs. preferences) and experience match score (vs. resume) with explanations
  - [ ] 🟥 Render output: two scored sections (preference match, experience match) with reasoning

- [ ] 🟥 **Step 6: Tailor Resume**
  - [ ] 🟥 Build page with resume upload (PDF) + optional free-text field for additional context
  - [ ] 🟥 On upload: parse PDF server-side, store extracted text in Supabase against the user's profile
  - [ ] 🟥 Create `/api/tailor-resume` route: sends resume text + additional context + JD + profile to Claude, returns a rewritten resume (markdown) and a likelihood score of advancing to interview
  - [ ] 🟥 Render output: formatted resume preview + score badge
  - [ ] 🟥 Add iterative chat: stream follow-up messages to the same Claude conversation thread so the user can refine the resume inline
