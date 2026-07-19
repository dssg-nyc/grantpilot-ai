# GrantPilot AI — System Audit & Roadmap
**Date:** 2026-07-12 · **Method:** 6-agent parallel deep-dive across ingestion, matching/AI, frontend, auth/security, API/monetization, and test/infra · **Status at audit time:** live in production at grantpilot-snowy.vercel.app with real nonprofit user data

---

## Executive Summary

The AI/matching core is genuinely well-built — grounded prompts, clamped outputs, real pgvector HNSW indexing, cost-controlled Claude calls, and a UI that actually explains *why* a grant matched. That part is not the risk.

The risk is everything around it:

- **There is no way to make money.** Zero billing, plans, or usage limits exist anywhere in the codebase.
- **There is a live, unauthenticated endpoint that lets anyone trigger expensive Firecrawl/Claude/embedding jobs on demand** — a standing cost-DoS hole in production right now.
- **The Kanban pipeline — the product's headline "track your applications" feature — cannot actually move cards between stages.** The backend supports it; the frontend never wired it. Users can add a grant to the pipeline and then never move it again.
- **A JSON-parse fallback bug can show a user `match_score: 0` on a match that composite-scored 80+**, directly contradicting the code's own "never a misleading 0" comment.
- **The product stops at "here are your matches."** There is no help actually writing a proposal, despite Claude already being wired into the app for other purposes.

None of this is a rewrite. Most of it is 1–3 day fixes. But in priority order, several of these should happen before the next round of new users, not after.

---

## Top 10 — What Matters Most Right Now

### 1. Ship monetization (Stripe + plan gating) — **biggest business gap**
Exhaustive repo search for `stripe|subscription|paywall|usage-limit|billing|plan|pricing|tier` returns nothing. No plan table, no usage counters, no pricing page, no paywall. Every user gets unlimited matches, unlimited AI analysis, unlimited everything, for free. This is the single largest gap between "working demo" and "sellable product."
**Fix:** Stripe Checkout + a `subscriptions`/`plans` table, gate match-compute frequency and pipeline size on the free tier, unlock AI drafting (#6) as the paid hook.

### 2. Lock down `app/api/agents/trigger/route.ts` — **live security hole** — ✅ FIXED 2026-07-12
`POST /api/agents/trigger` (lines 4-13) accepted arbitrary Inngest event names/payloads with **no auth check and no rate limit**. Anyone who finds the URL could fire `grants/sync.requested` repeatedly and burn through Firecrawl/Claude/Voyage spend, or trigger unintended data writes.
**Fix shipped:** requires `Authorization: Bearer ${CRON_SECRET}` in production (same convention as `cron/route.ts`), rate-limited via `strictRateLimiter`, and the `job` field is now whitelisted to the 3 real Inngest event names (`grants/sync.requested`, `grants/new-opportunities`, `org/profile-updated`) — anything else returns 400. Typecheck/tests/build all pass.

### 3. Wire up Pipeline stage changes — **flagship feature is non-functional** — ✅ FIXED 2026-07-12
`PipelineCard.tsx:26` was styled clickable but had no `onClick`. `usePipeline.ts` only exported `usePipeline()`/`useAddToPipeline()` — no `useUpdateStage`/`useDeleteItem` hook existed, even though the backend (`app/api/pipeline/[id]/route.ts` PATCH/DELETE) was fully built and working. Users could add a grant to the pipeline and never move it past "saved."
**Fix shipped:** discovered `@hello-pangea/dnd` was already an installed dependency, completely unused anywhere — confirming real drag-and-drop was the original intent. Wired up `DragDropContext`/`Droppable`/`Draggable` across `PipelineBoard.tsx` → `PipelineColumn.tsx` → `PipelineCard.tsx`, added `useUpdatePipelineStage()` (with optimistic cache update + rollback on error) and `useDeletePipelineItem()` to `hooks/usePipeline.ts`, and a hover-visible remove ("×") button on each card. No new dependency added. Typecheck/tests pass; verified via component-level render smoke test (all 6 columns/Draggable-Droppable wrappers render without errors).

### 4. Fix the `match_score: 0` fallback bug — **corrupts the core trust signal** — ✅ FIXED 2026-07-12
When Claude's response failed `JSON.parse` in `match-analyzer.ts:15-22,36,44`, the fallback object set `match_score: 0`. In `compute.ts:62`, `analysis?.match_score ?? breakdown.composite` uses `??`, and `0` is not nullish — so the composite-score fallback never triggered on this path. A grant that composite-scored 80+ could be persisted and shown to the user as a 0-score match with "Analysis unavailable" as a disqualifier.
**Fix shipped:** `MatchAnalysis.match_score`/`success_probability` retyped `number | null`; fallback now sets both to `null` so `?? breakdown.composite` correctly fires. Disqualifier message clarified to "AI analysis unavailable — showing composite-based score". Bonus: `scripts/sync-grants-latest.ts` and `scripts/ingest-foundations.ts` used the identical `?? composite` pattern and are fixed for free by the type change. Typecheck/tests pass.

### 5. Rate-limit login/signup/search/matches-compute — **brute force & cost-DoS** — ✅ FIXED 2026-07-12
`LoginForm.tsx`/`SignupForm.tsx` called `supabase.auth.signInWithPassword`/`signUp` directly client-side with no wrapping rate-limited route — brute force protection depended solely on Supabase's own limits. `app/api/search/route.ts` had no auth and no rate limit despite calling paid Voyage embeddings per query. `matches/compute` POST was authenticated but unrated.
**Fix shipped:** added new server-side `app/api/auth/login/route.ts` and `app/api/auth/signup/route.ts` (both `rateLimitGuard`'d with `strictRateLimiter`, using `createSupabaseServerClient()` for cookie-persisted sessions — the same pattern already proven in `auth/callback/route.ts`); `LoginForm.tsx`/`SignupForm.tsx` now `fetch()` these routes instead of calling Supabase directly from the browser. Added `rateLimitGuard` to `search` GET and `matches/compute` POST. Verified independently: typecheck/build/tests pass, and a direct curl against the new `/api/auth/login` route plus a direct call to Supabase's own auth API (bypassing the app entirely) both returned the identical "Invalid login credentials" for the seeded demo user — confirming the route works correctly and the 401 seen during testing is a pre-existing stale-credential issue, not a regression from this fix.

### 6. Build AI-assisted proposal/application drafting — **the actual "win grants" feature is missing**
Right now the product finds matches and lets you bookmark them — it does not help you apply. Claude is already integrated for profile extraction and match analysis; there's no reuse of it for narrative/proposal drafting, budget building, or a per-funder requirements checklist. The schema even has unused `checklist`/`documents` JSONB columns on `pipeline_items` (migration 005) sitting dead. This is both the highest-value feature gap and a natural premium-tier hook for #1.

### 7. Add CI and real tests for the matching core — **the product's core IP is unguarded**
No `.github/workflows` exist at all — nothing gates `main` before Vercel auto-deploys. Test coverage is ~91 lines across 6 files; two of five vitest files are empty placeholders (`expect(true).toBe(true)`). `eligibility-checker.ts`, `vector-search.ts`, all 8 Inngest functions, and all 18 API routes have zero test coverage. A regression in scoring logic would ship silently.

### 8. Fix ingestion pipeline gaps
- `sync-grants-gov.ts:93-201` has an unbounded `while(true)` pagination loop with no page cap — runaway risk if grants.gov's result set grows.
- SAM.gov and RSS sources **skip existing rows on re-sync** (`if (existing) continue`) — once inserted, a grant's deadline/status is never refreshed, and closed grants from those sources never flip to `expired`.
- `update-trending-scores.ts` is registered on an hourly cron but its body is literally `async () => ({ ok: true })` — it runs every hour and does nothing.
- No cross-source dedup — the same grant appearing via grants.gov and RSS creates two separate rows.

### 9. Fix scoring soundness: eligibility/geographic dimensions are fake weight
`eligibility_score` and `geographic_score` are only ever `0` or `1`, and they're derived from the *same hard gate* that already filters out ineligible matches before scoring — so every match a user actually sees has `eligibility=1, geographic=1` by construction, contributing a fixed +30 points that differentiates nothing. The advertised composite weighting (35/25/20/10/10) is really only ~70% discriminating (semantic + focus + size). This should either be replaced with real graduated scoring or collapsed into the gate and the weights rebalanced.

### 10. Build team/multi-user support
`users.org_id` has no unique constraint and RLS policy comments reference "org creator + members," but there is no invite flow, no member list, no role management, and no API route to add a second user to an org. The product is effectively single-user-per-org today, which blocks selling to any nonprofit with more than one staffer touching grants.

---

## Full Findings by Subsystem

### Data Ingestion
**Working end-to-end:** grants.gov (4h cron), Firecrawl foundation/corporate scraper (daily), RSS monitor (4h cron) — all fetch → normalize → embed → store correctly with batched Voyage embeddings.
**Partial:** SAM.gov (gated on unset `SAM_GOV_API_KEY`, only fetches page 0/50 records even when configured, no pagination); RSS/SAM.gov never update existing rows.
**Missing:** USA Spending (intentionally excluded, correctly documented as historical-award data), state/local grants (no source exists at all — every ingestion path hardcodes `geographic_scope: "national"`), international coverage (US-only).
**Dead code:** `lib/firecrawl/scrapers/corporate-csr-scraper.ts` — exports a 2-item array, never imported anywhere.

### Matching / AI Scoring
**Sound:** composite weights are transparent and sum to 1.0; LLM output is clamped and axis-decoupled (`success_probability ≤ match_score` enforced); cost control is real (Haiku, 512 max_tokens, only top-20-of-100 candidates get an AI call, concurrency 5); prompt is grounded in real org/opportunity fields, not free-inventing; pgvector HNSW indexing is correctly configured; UI explainability (score-composition bars, strengths/watch-outs, confidence badges) is genuinely good, not a black box; re-ranking fires on org-profile changes.
**Questionable:** vector search is vector-only despite an unused FTS index existing on the same table; magic-number thresholds in size-fit/Jaccard scoring have no calibration documented; a stale code comment claims similarity is normalized to [0,1] but the RPC actually returns raw cosine similarity in [-1,1] — currently masked by the 0.3 threshold but would silently corrupt the composite if that threshold is ever loosened; `passesHardEligibility` only checks the 501(c)(3) flag, nothing else.
**Missing:** no feedback/outcome loop (no win/loss table, no learning from saved/dismissed matches); no re-scoring trigger when an existing opportunity's deadline/amount/focus-area is edited post-ingestion; no competitive-analysis or applicant-volume signal; deadline urgency is cosmetic UI only, not part of the actual score.
**Bug:** see Top 10 #4 (`match_score: 0` fallback).

### Frontend / UX
The prior 24-day-old audit is stale — most flagged stubs (OpportunityDetail, OpportunityFilters, SearchBar, FeedTabs, onboarding steps, landing sections) are now fully implemented and data-wired. No `TODO`/"coming soon" strings remain anywhere in `app/` or `components/`.
**Fully working:** onboarding wizard, matches page, opportunities browse/search/filter/detail, settings (persists notification prefs + threshold), profile view/edit, trending, all auth pages.
**Partial/stub:** Pipeline board is read-only (see Top 10 #3); landing page claims AI extracts mission/budget/geography "from existing documents" but no document upload endpoint exists anywhere — only a pasted-text field.
**Dead buttons:** notification bell (`TopBar.tsx:42-45`, no handler, no notification center exists), avatar/user menu (`TopBar.tsx:48-50`, no handler, no dropdown).
**Missing entirely:** notifications/alerts UI, document upload/management, deadline calendar/reminder view, team collaboration UI, billing/subscription UI, export/reporting (CSV/PDF).

### Auth, Security & Observability
**Solid:** all auth flows (login, signup, OAuth, password reset via PKCE, email verification) are real and complete; server/client Supabase client split is correct for Next.js 16; RLS is enabled on every table across all 10 migrations, including a documented prior fix that closed a world-readable `audit_logs`/`ingestion_logs` gap; org isolation via `org_id` is consistent; Sentry is wired across server/edge/client; cron routes check `CRON_SECRET`.
**Gaps:** `audit_logs` table has RLS but is never actually written to anywhere (no real audit trail despite the schema promising one); `/api/cron/reembed` is orphaned — not in `vercel.json` crons and not triggered by any Inngest cron, so opportunity embeddings likely never auto-refresh; no env-var validation at boot; no `/api/health` endpoint.
**Vulnerabilities (by severity):**
- HIGH — `/api/agents/trigger` unauthenticated (Top 10 #2)
- HIGH — login/signup have no server-side rate limiting (Top 10 #5)
- MEDIUM — `/api/search` unauthenticated + unrated, calls paid Voyage embeddings per query
- MEDIUM — `/api/matches/compute` POST authenticated but unrated
- MEDIUM — prompt injection surface: raw scraped Firecrawl markdown goes into the Claude extraction prompt with only a length truncation, no delimiting/sanitization — a malicious funder page could poison extracted `application_url`/deadline fields
- LOW — no CORS/CSRF hardening (acceptable today given no cross-origin API consumers, but flag before any third-party integration)

### API Completeness & Monetization
All 18 routes across opportunities/matches/pipeline/profile/search/cron/webhooks are implemented against real Supabase calls, not stubs. Digest emails (Resend + react-email) are genuinely live and scheduled, not a stub. However:
- **No input validation library anywhere** (`zod` grep returns zero hits in `app/api`) — manual ad-hoc checks only; `profile` POST/PATCH accepts arbitrary body keys and writes them straight through (mass-assignment risk).
- Several routes leak raw Supabase `error.message` to the client.
- Pipeline `checklist`/`documents` JSONB columns exist in schema but are wired nowhere (Top 10 #6).
- **Zero monetization mechanism of any kind** (Top 10 #1).
- **Effectively single-user-per-org**, no invite system (Top 10 #10).

### Testing & Infrastructure
- Migrations are clean, idempotent, and documented (`DEPLOY.md`); no secrets found in tracked files.
- Freshness cadence in production is actually fine — real scheduling comes from Inngest Cloud crons (4h/daily/hourly), not Vercel's cron, so the earlier Hobby-plan cron-frequency limitation doesn't hurt data freshness. Vercel's daily cron is just a documented backstop.
- `npm test` passes (5 files, 5 tests) — but coverage is ~91 lines total; two of five test files are empty placeholders; matching logic (the product's core IP) is essentially untested (Top 10 #7).
- **No CI at all** — no `.github/workflows`, nothing gates `main` before auto-deploy.
- `INNGEST_DEV` is present in `.env.local`; `DEPLOY.md` explicitly warns this must never be set in Vercel prod (it disables Inngest Cloud + all crons) — worth a one-command production env check.
- `.env.example` is missing several vars actually read in code (`RSS_FEED_URLS`, `ORG_ID`, `GRANT_LIMIT`, `SYNC_COUNT`, `FED_COUNT`).
- `app/api/cron/route.ts` processes opportunities in a serial loop with a 300ms sleep per item — N+1 pattern, currently bounded by query params so not urgent, but will not scale.

---

## Quick Wins (low effort, real value)
- Delete or fix the dead `update-trending-scores` cron (currently runs hourly and does nothing).
- Delete the unused `corporate-csr-scraper.ts` dead file.
- Remove the unused `success-probability.ts` dead prompt file.
- Add `RSS_FEED_URLS`/`ORG_ID`/`GRANT_LIMIT`/`SYNC_COUNT`/`FED_COUNT` to `.env.example`.
- Verify `INNGEST_DEV` is not set in Vercel production env.
- Add `aria-label`s to the icon-only TopBar buttons once wired up.
- Either soften the landing page's "AI extracts from your documents" claim or ship a minimal upload endpoint — current mismatch is a trust risk with real users signing up today.

---

## Suggested Sequencing
1. **This week (security + trust):** #2 (lock down agents/trigger), #4 (match_score:0 bug), #5 (rate limiting on auth/search/compute).
2. **Next 1-2 weeks (core feature completeness):** #3 (pipeline stage wiring — mostly frontend, backend ready), #8 (ingestion pagination cap + SAM.gov/RSS refresh + kill dead cron).
3. **Before next growth push:** #1 (Stripe/billing), #6 (AI drafting as the paid hook), #7 (CI + matching-core tests).
4. **Before selling to multi-staff nonprofits:** #10 (team invites), #9 (real eligibility/geographic scoring).
