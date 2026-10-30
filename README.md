# GrantPilot AI

Grant discovery and matching for nonprofits: ingests federal (grants.gov, SAM.gov), foundation and RSS opportunities, embeds them, and matches them against each organization's profile; plus a pipeline, AI drafting and an assistant.

## Stack

- **Next.js 16** (App Router, `output: "standalone"`) — web app + API routes
- **Supabase, self-hosted** — Postgres 17 + pgvector, GoTrue auth, PostgREST, Kong (`@supabase/ssr` / `supabase-js` in the app)
- **pg-boss** — job queue + crons in Postgres; consumed by a separate worker (`worker/index.ts`)
- **Ollama `bge-m3`** — local 1024-dim embeddings
- **fetch + cheerio + turndown** — web scraping
- **Anthropic** (AI), **Resend** (email), **Stripe** (billing)
- Rate limiting is in-process (`lib/redis/rate-limiter.ts`, single app instance)

## Local development

Prerequisites: Node 22, Docker (for Postgres/Supabase), [Ollama](https://ollama.com) with `ollama pull bge-m3`.

```bash
npm install
cp .env.example .env.local          # fill in Supabase URL/keys, DATABASE_URL, API keys
# apply supabase/migrations/*.sql to your database, e.g.
DATABASE_URL=postgres://postgres:...@127.0.0.1:5432/postgres deploy/migrate.sh

npm run dev                         # web app
npx tsx --env-file=.env.local worker/index.ts   # background worker (separate terminal)
```

For a local Supabase you can either run `supabase start` (Supabase CLI) or the production compose stack in `deploy/`.

## Scripts

| Command | Purpose |
|---|---|
| `npm test` | Vitest unit + integration tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:e2e` | Playwright |
| `npx tsx scripts/sync-all.ts` | ingest grants.gov + foundations, re-match all orgs |
| `npx tsx scripts/reembed-all.ts` | regenerate every embedding with the current model |

## Deployment

Single VPS with Docker Compose (Caddy TLS, self-hosted Supabase, Ollama, app, worker). See **[DEPLOY.md](DEPLOY.md)**.
