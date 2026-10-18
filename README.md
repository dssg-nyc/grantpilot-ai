# GrantPilot AI

**A human-centered AI platform built by [Data Diplomats](https://datadiplomats.org) (NYC DSSG) for its pro bono nonprofit clients.**

GrantPilot AI does two jobs at once:

1. It gives nonprofit clients a place to **register, learn, and practice** using AI responsibly, with their own mission and community at the center.
2. It gives Data Diplomats the tooling to **manage projects and match volunteers** to the nonprofit clients who need them.

---

## Purpose

### 1. A guided AI education journey for pro bono nonprofit clients

Many nonprofits want to use AI but don't know where to start, what's safe, or what's worth their limited time. GrantPilot AI is the front door to that journey. A nonprofit registers, tells us about their organization, and gets a path into nonprofit tech and AI education built on **human-centered AI**: AI that supports staff and serves the community, with people staying in charge of decisions.

The platform is meant to give each client:

- **Best practices** for using AI responsibly: protecting beneficiary data, checking AI output, keeping a human in the loop, and being transparent about when AI is used.
- **A curated list of resources, tools, and courses** so they can start (or deepen) their nonprofit tech and AI education without sorting through the noise on their own.
- **Hands-on practice with real tools.** The grant-discovery and grant-writing features in this app give clients a working example of human-centered AI. They see the sources, review the reasoning, and edit every draft.

### 2. Project management and volunteer matching for Data Diplomats

Behind the client experience, the same registration data helps the Data Diplomats team run its pro bono program:

- **Understand each client.** Mission, focus areas, size, programs, geography, and goals are captured once at onboarding and reused everywhere.
- **Manage projects.** Track what each nonprofit needs and where each engagement stands.
- **Match volunteers to clients.** Use what we know about each nonprofit, and what volunteers bring, to pair the right people with the right project.

This is why the platform has **built-in AI agents**: they do the repetitive discovery, analysis, and drafting work, so volunteers and staff can spend their time on judgment and relationships.

---

## The AI agents

AI agents are built into the platform and run on Anthropic's Claude. The Claude-powered components in the codebase today are:

| # | Agent | What it does | Where |
|---|-------|--------------|-------|
| 1 | **AI Assistant** | Conversational thought partner. Searches opportunities, reads the client's matches and pipeline, and drafts grant-application sections. | `lib/anthropic/agent/` |
| 2 | **Funding Scout** | Searches and fetches from the web to find funding the database doesn't cover. Records findings that a human reviews before importing. | `lib/anthropic/scout/` |
| 3 | **Match Analyzer** | Scores and explains how well an opportunity fits an organization's profile. | `lib/anthropic/match-analyzer.ts` |
| 4 | **Draft Generator** | Produces grant-application draft sections grounded in the organization's real data. | `lib/anthropic/draft-generator.ts` |
| 5 | **Profile Extractor** | Builds an organization profile from a pasted description or the nonprofit's website, so onboarding is quick. | `lib/anthropic/prompts/profile-extraction.ts`, `app/api/profile/from-website/` |

> **Status note:** The agents above are implemented for the **grant-discovery and onboarding** side of the platform. The education hub (curated resources, tools, courses) and the volunteer-matching / project-management workflows described under [Purpose](#purpose) are the platform's goals; they are not yet implemented in this codebase. This section should be updated as those pieces land.

All agents follow the same principles: ground output in real data, never fabricate facts, label unverified results as unverified, and keep a human reviewing before anything is used.

---

## What the app does today

- **Registration and onboarding** — account signup, a multi-step organization profile wizard, and optional import from a nonprofit's website.
- **Grant discovery** — federal (grants.gov, SAM.gov) and foundation opportunities, refreshed on a schedule, with search and filters.
- **AI match scoring** — vector similarity plus eligibility and geographic checks, with an AI-written explanation for each match.
- **Pipeline board** — drag-and-drop Kanban for tracking grants from interested to submitted.
- **AI drafting** — section-by-section grant-application drafts, through the Assistant or directly from a pipeline item.
- **Funding Scout** — on-demand web research that surfaces leads outside the main database.
- **Team access, billing, and alerts** — team invites, plan limits, and email digests/alerts.

## Tech stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- **Data and auth:** Supabase (Postgres, pgvector, Row Level Security)
- **AI:** Anthropic Claude (agents, analysis, drafting), Voyage AI (embeddings)
- **Ingestion:** Firecrawl, grants.gov / SAM.gov / USAspending, RSS
- **Background jobs:** Inngest, plus a daily Vercel cron backstop
- **Infra and services:** Upstash Redis (rate limiting), Resend + React Email, Stripe, Sentry, Vercel

> This version of Next.js has breaking changes from earlier releases. Before changing code, read the relevant guide in `node_modules/next/dist/docs/` (see `AGENTS.md`).

## Getting started

```bash
npm install
# create .env.local with the variables listed in DEPLOY.md
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Required environment variables (Supabase, Anthropic, Voyage, Firecrawl, Inngest, Upstash, Resend, and others) and database migration steps are documented in [DEPLOY.md](./DEPLOY.md). Migrations live in `supabase/migrations/`.

### Useful scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build and serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit and integration tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) |
| `npx tsx scripts/sync-all.ts` | Ingest grant sources and re-match all organizations |

## Project layout

```
app/            Next.js routes: marketing site, auth, onboarding, dashboard, API
components/     UI components (landing, onboarding, opportunities, pipeline, scout, assistant)
lib/anthropic/  Claude agents, prompts, and tool handlers
lib/matching/   Match scoring and eligibility logic
lib/data-sources/ , lib/firecrawl/   Grant ingestion
inngest/        Background job definitions
supabase/       Database migrations
__tests__/      Unit, integration, and e2e tests
```

## Deployment

See [DEPLOY.md](./DEPLOY.md).

## About Data Diplomats

Data Diplomats (NYC DSSG, Data Science for Social Good) connects skilled volunteers with nonprofits that can't afford this kind of technical help. GrantPilot AI is built pro bono for those nonprofits.
