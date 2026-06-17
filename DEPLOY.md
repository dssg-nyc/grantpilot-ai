# Deploying GrantPilot AI

Production: **https://grantpilot-snowy.vercel.app** · Vercel project `arkfelix7s-projects/grantpilot` (region `iad1`) · deploys from `main`.

The app runs on cloud Supabase, so a deploy shares the same database (and data) as local — there is no separate "prod DB" step once migrations are applied.

---

## 1. Prerequisites

- Cloud Supabase project with migrations `001`–`010` applied (see [Database](#database)).
- API keys: Anthropic, Voyage, Firecrawl, Inngest (event + signing), Upstash Redis, Resend.
- Vercel account/CLI: `npm i -g vercel && vercel login`.

## 2. Environment variables

Set these in **Vercel → Settings → Environment Variables** (Production + Preview). Values live in `.env.local` locally (gitignored — never commit them).

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable key (`sb_publishable_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role key — server-only, bypasses RLS |
| `ANTHROPIC_API_KEY` · `VOYAGE_API_KEY` · `FIRECRAWL_API_KEY` | AI / embeddings / scraping |
| `INNGEST_EVENT_KEY` · `INNGEST_SIGNING_KEY` | background jobs |
| `UPSTASH_REDIS_REST_URL` · `UPSTASH_REDIS_REST_TOKEN` | rate limiting |
| `RESEND_API_KEY` · `EMAIL_FROM` | transactional email (see caveat below) |
| `CRON_SECRET` | strong random string; Vercel Cron sends it as the `Authorization` header |
| `NEXT_PUBLIC_APP_URL` | the production URL, e.g. `https://grantpilot-snowy.vercel.app` |
| `NEXT_PUBLIC_APP_NAME` | `GrantPilot AI` |
| `SENTRY_DSN` · `NEXT_PUBLIC_SENTRY_DSN` | error monitoring (reports in production only) |
| `NEXT_PUBLIC_POSTHOG_KEY` · `NEXT_PUBLIC_POSTHOG_HOST` | analytics |

**Do NOT set:**
- `INNGEST_DEV` — its presence forces dev mode and disables Inngest Cloud + crons.
- `SUPABASE_DB_PASSWORD` — only used for running migrations locally, not at runtime.

## 3. Deploy

```bash
vercel link --project grantpilot          # once
vercel --prod                             # build + deploy
```

Or push to `main` with the GitHub integration connected.

## 4. Post-deploy wiring (dashboard steps — required)

1. **Supabase → Authentication → URL Configuration**
   - Site URL: the production URL
   - Redirect URLs: `<prod>/api/auth/callback` and `<prod>/**`
   - Without this, email-confirmation sign-ups don't route through `/api/auth/callback`.
2. **Inngest → Sync new app**: `<prod>/api/webhooks/inngest` — activates matching, digests, and source-sync crons.
3. **Resend**: `EMAIL_FROM` must be on a **verified domain** before any email sends. A Gmail address will not work; use `onboarding@resend.dev` for testing.

## 5. Cron / background jobs

- `vercel.json` defines one daily cron at `/api/cron` (`0 9 * * *`). **Hobby plan only allows daily crons** — hourly requires Pro.
- Frequent syncs (grants.gov every 4h, foundations daily, RSS) run via **Inngest** once the app is synced. Treat the Vercel cron as a backstop.
- Manual trigger:
  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" "<prod>/api/cron?pages=1&batch=5"
  ```

## Database

Migrations live in `supabase/migrations/`. Apply to a fresh project via direct connection (IPv6) or the Supabase CLI:

```bash
# direct psql (uses SUPABASE_DB_PASSWORD)
for f in supabase/migrations/0*.sql; do
  psql "postgresql://postgres@db.<ref>.supabase.co:5432/postgres?sslmode=require" -f "$f"
done
```

## Manual data scripts

Run locally (each self-loads `.env.local`):

| Script | Purpose |
|---|---|
| `npx tsx scripts/sync-all.ts` | ingest grants.gov + foundations, then re-match all orgs |
| `npx tsx scripts/sync-grants-latest.ts` | federal-only latest sync |
| `ORG_ID=<uuid> npx tsx scripts/match-org.ts` | recompute matches for one org |
| `npx tsx scripts/e2e-pipeline.ts` | full fetch→store→seed→match proof + seeds a demo user |

## Verify

```bash
curl -s -o /dev/null -w "%{http_code}\n" "<prod>/"                     # 200
curl -s "<prod>/api/opportunities?limit=1"                            # returns active opps
```
