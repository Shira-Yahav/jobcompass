# Feature Implementation Plan

**Overall Progress:** `100%`

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

- [x] 🟩 **Step 1: Project Scaffold**
  - [x] 🟩 Init Next.js 14 app (App Router, TypeScript, Tailwind)
  - [x] 🟩 Install and configure shadcn/ui
  - [x] 🟩 Install Anthropic SDK, Supabase client, Zustand, pdf-parse
  - [x] 🟩 Set up Supabase project: auth, `profiles` table, resume file storage bucket
  - [x] 🟩 Configure `.env.local` with Supabase URL/key and Anthropic API key
  - [x] 🟩 Build app shell: sidebar nav with links to all 4 features + auth (sign in / sign up)

- [x] 🟩 **Step 2: My Profile**
  - [x] 🟩 Build profile form with fields: desired position, target salary range, company size, domain/industry, role type (IC / manager / both), work style (remote / hybrid / onsite)
  - [x] 🟩 Save profile to Supabase `profiles` table on submit
  - [x] 🟩 Load and pre-fill saved profile on page mount

- [x] 🟩 **Step 3: Global Inputs (shared state)**
  - [x] 🟩 Create Zustand store with `companyName` and `jobDescription` fields
  - [x] 🟩 Add a persistent input bar (or sidebar section) visible across all feature pages
  - [x] 🟩 Verify values are accessible in Company Research, Position Research, and Tailor Resume pages

- [x] 🟩 **Step 4: Company Research**
  - [x] 🟩 Build page that reads `companyName` from global store
  - [x] 🟩 Create `/api/research-company` route: sends company name + user profile to Claude, returns structured overview (funding round, size, GTM strategy, approx. customers, product/solution summary) and a fit score (0–10) with explanation
  - [x] 🟩 Render output: overview cards + score badge + fit reasoning

- [x] 🟩 **Step 5: Position Research**
  - [x] 🟩 Build page that reads `companyName` and `jobDescription` from global store
  - [x] 🟩 Create `/api/research-position` route: sends JD + user profile + resume text to Claude, returns role fit score (vs. preferences) and experience match score (vs. resume) with explanations
  - [x] 🟩 Render output: two scored sections (preference match, experience match) with reasoning

- [x] 🟩 **Step 6: Tailor Resume**
  - [x] 🟩 Build page with resume upload (PDF) + optional free-text field for additional context
  - [x] 🟩 On upload: parse PDF server-side, store extracted text in Supabase against the user's profile
  - [x] 🟩 Create `/api/tailor-resume` route: sends resume text + additional context + JD + profile to Claude, returns a rewritten resume (markdown) and a likelihood score of advancing to interview
  - [x] 🟩 Render output: formatted resume preview + score badge
  - [x] 🟩 Add iterative chat: stream follow-up messages to the same Claude conversation thread so the user can refine the resume inline
