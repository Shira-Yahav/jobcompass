# JobCompass — AI-Powered Job Search Intelligence Platform

**Live Demo → [jobcompass-nine.vercel.app](https://jobcompass-nine.vercel.app)**  
**GitHub → [github.com/Shira-Yahav/jobcompass](https://github.com/Shira-Yahav/jobcompass)**

---

## The Problem

Job searching is broken — especially for Product Managers.

The typical process looks like this: find a job posting, spend 45 minutes researching the company across Crunchbase, LinkedIn, Glassdoor, and news articles, paste the JD into ChatGPT and ask it to tailor a resume, then hope for the best in the interview. Repeat this 20–50 times per search cycle.

The problems are well-documented:

- **Information is scattered.** Company funding, size, culture, and product context live across five different sites with no synthesis.
- **Generic preparation.** Most AI tools don't know your background, so advice doesn't actually apply to you.
- **Resume tailoring is a grind.** Every application deserves a customised resume, but the effort-to-reward ratio makes most candidates skip the step.
- **Interview practice lacks realism.** Practicing with a general-purpose chatbot feels nothing like talking to a real interviewer — no dynamic follow-ups, no persona, no scoring.

The result: candidates are either underprepared and outcompeted, or they burn out trying to keep up.

---

## The Solution

JobCompass is a full-stack AI-powered job search platform that replaces manual research and generic prep with a personalised, data-driven workflow — from first look at a job posting to walking into the interview room.

It connects to live web data, understands your resume and preferences, and carries that context across every feature. Instead of starting from scratch on every application, candidates work with an intelligent co-pilot that already knows them.

---

## Features

### Company Research
*Know the company better than the interviewer expects.*

Enter a company name and JobCompass runs parallel web searches across funding databases, product pages, and hiring signals — then synthesises everything into a structured intelligence brief covering funding stage, total raised, key investors, team size, top competitors, business model, go-to-market strategy, and technology approach.

The brief is scored against your personal preferences (company type, funding stage, industry, work style, salary floor) using a weighted fit model you configure. Every dimension is explained — not just a number.

**Why it matters:** Candidates walk into conversations knowing exactly how the company works, where it is in its lifecycle, and whether the opportunity genuinely fits their goals — before spending a single hour applying.

---

### Position Research
*Understand your odds before you apply.*

Paste a job description and JobCompass produces a dual-score assessment: how well the role matches your stated preferences, and how well your actual experience qualifies you for it. It identifies specific strengths and gaps grounded in the JD and your resume — not generic advice — and gives 2–4 immediately actionable suggestions for improving your candidacy.

**Why it matters:** Knowing your honest fit score upfront helps candidates prioritise where to invest time and enter applications with a clear strategy for addressing gaps — not false confidence.

---

### Resume Tailoring
*One resume base, personalised to every role.*

JobCompass rewrites your resume for each application using the JD as a targeting document. The output includes a likelihood-of-interview score and a summary of changes. A follow-up chat lets you refine further — ask for different emphasis, a more senior tone, or changes to specific sections.

**Why it matters:** Tailored resumes consistently outperform generic ones in ATS screening and recruiter review. Removing the friction means more candidates actually do it.

---

### Application Tracker
*One place for every active opportunity.*

A clean tracker that organises every application by stage (Applied → Intro Call → Hiring Manager → Technical → Panel → Offer) and status. Each row links directly into research and practice features, carries the submitted resume, and surfaces the job description — so context is always one click away.

**Why it matters:** Active job seekers typically manage 10–30 simultaneous applications. Without structure, important follow-ups get missed and interview prep happens reactively.

---

### Practice Mode — AI Interview Simulator
*The most realistic interview prep available outside a real conversation.*

Practice Mode is the platform's flagship feature. Select a stage, generate a set of tailored questions, and enter a live conversation with an AI interviewer that adapts dynamically to your answers.

Key behaviours:

- **Stage-specific personas.** A Talent Acquisition Specialist behaves differently from a VP of Product or a Senior PM. The AI adopts the right tone, focus, and depth expectations for each stage.
- **Company-aware questions.** Before generating questions, the system runs a live web search on the company so questions reference real products, known challenges, and actual business context — not generic PM frameworks.
- **JD and resume grounding.** Every question is anchored to the specific job description or something in your submitted resume.
- **Dynamic follow-ups.** When an answer is vague or interesting, the interviewer probes deeper with a targeted follow-up. One per question, enforced server-side.
- **Real-time scoring.** In "as you go" mode, each answer is scored across four dimensions: structure, relevance, depth, and clarity. Feedback is specific, not generic encouragement.
- **Retry.** Any question can be retried after feedback so you can practise the weak spots.

**Why it matters:** Generic interview prep ignores your actual background and the company's real context. JobCompass delivers preparation that mirrors what the real conversation will actually feel like.

---

### Session History
*Nothing gets lost.*

Every company research session, position analysis, and practice run is saved and accessible from a unified history view. Practice sessions show answered/total questions and average score at a glance, with a direct link to continue where you left off.

---

## Technical Architecture

### Stack

| Layer | Technology | Rationale |
|---|---|---|
| Framework | Next.js 16 (App Router) | Server components, API routes, and file-based routing in a single framework — no separate backend |
| Language | TypeScript | End-to-end type safety across API contracts, database types, and UI state |
| Database + Auth | Supabase (Postgres + RLS) | Managed Postgres with built-in auth, storage, and Row-Level Security policies that enforce per-user data isolation at the database layer |
| File Storage | Supabase Storage | PDFs stored per-user; features that display the document use short-lived signed URLs, never public links |
| AI — Analysis | Claude Sonnet 4.6 | Used for company research and interview question generation where output quality and structured JSON accuracy are the constraint |
| AI — Conversation | Claude Haiku 4.5 | Used for the real-time interview respond loop where latency is the primary constraint |
| Web Search | Tavily API | Structured web search with deduplication — more reliable for factual company data than raw LLM knowledge |
| State Management | Zustand (persisted) | Lightweight store that survives tab navigation; async actions live in the store so in-flight API calls aren't cancelled by component unmounts |
| Styling | Tailwind CSS v4 | Utility-first, zero-runtime CSS |
| Deployment | Vercel | Zero-config Next.js deployment with automatic preview URLs per branch |

---

### Key Technical Decisions

**AI model selection by task type.**
Not all AI calls are created equal. Company research and question generation use Claude Sonnet because quality and structured output accuracy are the bottleneck. The interview respond loop uses Haiku because a conversation feels broken if the AI takes more than 2–3 seconds to reply. Explicitly matching model choice to task requirements meaningfully improves both quality and user experience without unnecessary cost.

**Server-side enforcement over AI trust.**
The practice interview enforces a maximum of one follow-up question per topic at the server level — not just in the prompt. If the model misclassifies despite the instruction, a post-processing step overrides the result before any state is persisted. The principle: LLM behaviour is probabilistic; rules that affect user experience need to be enforced deterministically in code.

**Row-Level Security as the security model.**
All Supabase tables have RLS policies that check `auth.uid()` directly in the database. A bug at the API layer that forgets a user filter does not become a data exposure — the database refuses the query. This is a materially stronger guarantee than application-level filtering alone.

**Parallel web search to contain research latency.**
Company research runs three Tavily searches in parallel rather than sequentially. The AI analysis call begins only once all results are available. This keeps total latency in the 15–20 second range rather than 30+ seconds for sequential calls. The client shows step-by-step progress labels so the wait feels tracked rather than frozen.

**Zustand store as the async boundary.**
API calls for major features live in a Zustand store, not in component-level `useEffect` hooks. Navigating between tabs mid-request doesn't cancel the fetch, results are immediately available on return, and loading state is global rather than per-component — which prevents the jarring experience of results disappearing when the user clicks away.

**PDF storage for resume fidelity.**
Resumes are stored as original PDFs (not just extracted text). Features that need content for AI prompts use the extracted text. Features that show the document to the user — the practice page, application detail — generate a short-lived signed URL and render it in an `<iframe>`. This preserves formatting for human review without complicating the AI pipeline.

---

## Product Philosophy

JobCompass was built on a specific belief: the quality of a job search outcome is largely determined by the quality of preparation — and most people don't prepare well because good preparation is genuinely hard.

Every feature decision follows from this: reduce the friction between "I found a job posting" and "I'm ready to interview," while making the output more personalised and more accurate than anything a candidate would produce manually.

The features compound on each other. Research informs resume tailoring. The tailored resume informs practice questions. Practice feedback tells you what to revisit. Each feature makes the others more valuable — which is the structural difference between a toolkit and a platform.

---

## Local Setup

```bash
git clone https://github.com/Shira-Yahav/jobcompass.git
cd jobcompass
npm install
```

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_key
TAVILY_API_KEY=your_tavily_key
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

*Built with Next.js · Supabase · Anthropic Claude · Tavily · Deployed on Vercel*
