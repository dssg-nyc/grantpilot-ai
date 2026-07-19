# GrantPilot AI — System Audit v2 (Re-Audit)
**Date:** 2026-07-12 (follow-up to `SYSTEM_AUDIT_2026-07-12.md`) · **Method:** 6-agent parallel deep-dive, each independently re-verifying the prior audit's findings against current code plus scanning fresh for new issues · **Status:** live in production with real nonprofit user data; 4 of the original top-10 items (#2, #3, #4, #5) were fixed between the two audits

---

## Executive Summary

The four fixes shipped since the last audit are real and hold up under independent re-verification: `/api/agents/trigger` is locked down, login/signup now run through rate-limited server routes, and the pipeline Kanban board actually drags-and-drops now (using a dependency — `@hello-pangea/dnd` — that had been sitting installed and unused). Good work, confirmed sound.

But this re-audit surfaced two things that matter more than anything left on the original list:

1. **A live RLS privilege-escalation hole.** The `public.users` RLS policy has no `WITH CHECK` clause, so any authenticated user can run `UPDATE users SET role='admin' WHERE id=auth.uid()` directly from the browser using the public anon key — and `role='admin'` is exactly what gates write access to the `opportunities` table. This is exploitable today, in production, by anyone with an account.
2. **The `match_score: 0` bug is only half-fixed.** The fix added a type-safe guard on the primary JSON-parse path, but a second fallback path — the regex-extraction branch that runs whenever Claude wraps its JSON in any commentary — calls `normalizeAnalysis()` without that same guard, and `normalizeAnalysis`'s `clamp()` defaults invalid input back to `0`. The exact bug the fix was meant to eliminate is still reachable, just through a narrower trigger.

Beyond those two, the picture from the first audit is largely unchanged: still no monetization, still no AI drafting tool, still no CI, still no team invites. The gap between "working demo" and "sellable, secure product" hasn't closed much — but two new items now outrank everything else on the list.

---

## Top 10 — Refreshed Priority List

### 1. Fix the `public.users` RLS self-escalation hole — **NEW, CRITICAL, exploitable today**
`supabase/migrations/003_rls_policies.sql:8` — `CREATE POLICY users_self_access ON public.users FOR ALL USING (auth.uid() = id)` has no `WITH CHECK`. Postgres reuses the `USING` clause as the check clause when one isn't given, which means the policy only restricts *which rows* a user can touch, not *which columns/values* they can write. Any logged-in user can call `supabase.from("users").update({role: "admin"}).eq("id", myId)` from the browser anon client. `opportunities_admin_write` then checks `role='admin'` and grants that user write access to the shared `opportunities` table — every nonprofit's data becomes writable by anyone who signs up.
**Fix:** split the policy into separate SELECT/UPDATE grants, and either drop `role` from the user-writable column set or add a `WITH CHECK` that pins `role` to its prior value (e.g. via a trigger or a column-level revoke). This should happen before anything else on this list.

### 2. Close the reopened `match_score: 0` path — **quick fix, same bug class as before**
`lib/anthropic/match-analyzer.ts:34-45`. The primary path (line 36: `if (typeof parsed.match_score !== "number") return fallback;`) is correctly guarded. But the `catch` block's regex-extraction fallback (line 40-42) calls `normalizeAnalysis(JSON.parse(jsonMatch[0]))` directly, with no type check first. `clamp()` (line 48-51) silently defaults a missing/invalid `match_score` to `0` — reproducing the exact "misleading 0 on a genuinely strong match" bug the prior fix targeted, just triggered by Claude wrapping JSON in prose instead of full parse failure.
**Fix:** apply the same `typeof parsed.match_score !== "number"` guard to the regex-extracted object before calling `normalizeAnalysis`, matching line 36's pattern.

### 3. Ship monetization (Stripe + plan gating) — **unchanged, still the biggest business gap**
Confirmed fresh: zero Stripe/plan/subscription/usage-limit code anywhere. Fully free, fully unlimited. Nothing else on this list matters commercially until this exists.

### 4. Build AI-assisted grant application drafting — **unchanged, the real value-prop gap**
Confirmed fresh: Claude is only used for profile extraction and match analysis, never for narrative/proposal drafting. The `pipeline_items.checklist`/`documents` JSONB columns (migration 005) are still completely unwired — cheap adjacent win once this is tackled.

### 5. Wire zod validation into mutating routes — **NEW finding, closes a mass-assignment hole**
`lib/utils/validators.ts` defines real zod schemas (`profileSchema`, `pipelineCreateSchema`) — **and nothing imports them.** Zero references anywhere in `app/api`. Every mutating route (`app/api/profile/route.ts`, `app/api/pipeline/route.ts`, `app/api/pipeline/[id]/route.ts`) still spreads the raw request body directly into Supabase `insert`/`update` calls with no allow-list, so a client can set arbitrary columns — including `profile_completeness`, or `id` on a PATCH (`app/api/profile/route.ts:197-208`). The schemas already exist; this is close to a free fix.

### 6. Add error/loading feedback to the new pipeline drag-and-drop — **NEW finding on the #3 fix**
The drag-and-drop implementation itself is sound (correct optimistic update + rollback, keyboard-accessible via `@hello-pangea/dnd`'s built-in support). But there's no `isPending` state shown during a stage-change mutation, and `onError` silently reverts the cache with **no toast or visible error** — a failed drag looks like nothing happened, with no explanation. The delete ("×") button also has no confirmation dialog — one misclick permanently removes a pipeline item.
**Fix:** add a lightweight toast/error surface on mutation failure, a subtle in-flight indicator on the dragged card, and a confirm step (or an "Undo" toast) before delete.

### 7. Fix data-refresh gaps still open in SAM.gov/RSS, and kill the dead trending-scores cron
**Progress since the last audit:** `sync-grants-gov.ts` now correctly updates existing rows on re-sync (this was fixed as a side effect of other work, not explicitly requested). **Still broken:** SAM.gov (`sync-sam-gov.ts:53-60`) and RSS (`monitor-rss.ts:36-42`) both still `if (existing) continue` — those sources' opportunities never get their deadline/status refreshed or expired. `update-trending-scores.ts` still runs hourly and does nothing (`async () => ({ok:true})`), still registered live. `corporate-csr-scraper.ts` is still dead, unimported code.

### 8. Stand up CI — **unchanged, and the untested surface keeps growing**
Still zero `.github/workflows`. Since the last audit, three more meaningful pieces of untested logic shipped with no coverage: `app/api/auth/login`/`signup` (highest blast-radius surface in the app — a silent regression here breaks the entire funnel), and the pipeline optimistic-update/rollback logic in `hooks/usePipeline.ts`. Test coverage is still ~91 lines total across 5 files, two of which are still literal placeholders (`expect(true).toBe(true)`).

### 9. Fix eligibility/geographic scoring being non-discriminating — **unchanged**
`eligibility_score`/`geographic_score` are still binary 0/1 gates duplicated into the composite, contributing a fixed +30 points that never differentiates surfaced matches (they're already filtered to pass the gate before scoring). Still no hybrid vector+FTS search despite a live, unused GIN index on `opportunities`.

### 10. Build team/multi-user invite support — **unchanged**
Still no `org_members`/invite table or endpoint; RLS policy comments reference "org creator + members" but nothing populates a second member. Blocks selling to any nonprofit with more than one staffer.

---

## Full Findings by Subsystem (Confirmed / Changed / New)

### Data Ingestion
**Confirmed still open:** `update-trending-scores.ts` still a live no-op hourly cron; SAM.gov and RSS still skip refreshing existing rows; no cross-source dedup; no state/local or international coverage (every source hardcodes `geographic_scope: "national"`); `corporate-csr-scraper.ts` still dead code; `sync-grants-gov.ts`'s pagination loop still has no hard page cap.
**Changed:** `sync-grants-gov.ts` now actually updates existing rows on re-sync (fixed as a side effect of other work) — refresh/expiry now works for federal grants specifically, though not SAM.gov/RSS. A new `crawl-foundations.ts` (properly upserting with refresh) is now live.
**New:** SAM.gov and RSS both do slow sequential `sleep(400)` per-item processing with duplicate per-item DB round-trips (unlike grants-gov's batched approach); both use `.single()` instead of `.maybeSingle()` for existence checks, generating log noise on every genuinely-new insert.

### Matching / AI Scoring
**Confirmed fixed:** the primary `match_score:0` path is fixed and verified end-to-end — the DB column stays `NOT NULL DEFAULT 0` but never actually receives `null` because `compute.ts` always resolves to a number before upsert; no UI code was broken by the type change.
**Still broken:** eligibility/geographic scoring non-discrimination; vector-only search despite a live unused FTS GIN index; no feedback/outcome loop; no re-scoring trigger on opportunity edits; no competitive-analysis or urgency-weighted scoring.
**New (see Top 10 #2):** the regex-extraction fallback path reopens the exact `match_score:0` bug via a narrower trigger.

### Frontend / UX
**Confirmed fixed:** pipeline drag-and-drop is real, correctly built (optimistic update + rollback, keyboard-accessible out of the box via `@hello-pangea/dnd`).
**Still broken:** no document upload (landing page still overstates this capability); TopBar bell/avatar still dead; no billing UI, calendar view, notification center, or export.
**New (see Top 10 #6):** no in-flight/error UI feedback on pipeline mutations; no delete confirmation.

### Auth, Security & Observability
**Confirmed fixed:** `/api/agents/trigger` lockdown is sound (auth check runs before body parsing, no bypass path); new `/api/auth/login`+`/signup` routes are correctly rate-limited and use the proper cookie-persisting server client; the signup route's `users` upsert runs under the new user's own session/RLS (same trust boundary as the old client-side version — not over-privileged).
**Still broken:** `audit_logs` never written to; `/api/cron/reembed` orphaned (embeddings never auto-refresh); no boot-time env validation; no `/api/health`; prompt-injection surface in `grant-page-parser.ts` unchanged.
**New (see Top 10 #1):** the `public.users` RLS self-escalation hole — this is the most serious finding in this re-audit. Also newly noted: all cron/admin routes' `CRON_SECRET` check is gated behind `NODE_ENV === "production"`, meaning any preview/staging deploy has these wide open to trigger real Claude/Voyage/Firecrawl spend.

### API Completeness & Monetization
**Confirmed still open:** zero monetization; single-user-per-org with no invite system; no AI drafting tool; dead `checklist`/`documents` schema columns.
**New (see Top 10 #5):** zod schemas exist in `lib/utils/validators.ts` and are entirely unused — every mutating route is open to mass-assignment. Also newly noted: raw Supabase `error.message` leaked to clients across nearly every route; `ai-extract`'s `request.json()` isn't wrapped in try/catch (crashes with a raw 500 on malformed input instead of a clean 400).

### Testing & Infrastructure
**Confirmed still open:** no CI; ~91 lines of test coverage across 5 files, two still placeholders; `INNGEST_DEV` still present in `.env.local`; `.env.example` still missing 5 vars actually read in code.
**New:** the three pieces of code shipped since the last audit (`auth/login`, `auth/signup`, pipeline optimistic-update hooks) have zero test coverage — the untested surface area is growing with each fix rather than shrinking.

---

## Suggested Sequencing (revised)
1. **Immediately (live exploitable + regressed bug):** #1 (RLS self-escalation), #2 (reopened match_score:0 path). Both are small, surgical fixes.
2. **This week:** #5 (wire the already-written zod schemas), #6 (pipeline error/loading UX), #7 (SAM.gov/RSS refresh parity + kill dead cron).
3. **Next 1–2 weeks:** #8 (CI — stop the untested-surface bleeding), #10 (team invites) if selling to multi-staff orgs is imminent.
4. **Before next growth push:** #3 (Stripe/billing), #4 (AI drafting as the paid hook), #9 (real eligibility/geographic scoring).
