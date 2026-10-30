@AGENTS.md

## Stack & deployment

- Deployed to a single VPS via `deploy/docker-compose.yml` (see DEPLOY.md): self-hosted Supabase (db/auth/rest/kong), Ollama `bge-m3`, Next.js `app` (standalone build), pg-boss `worker`, Caddy.
- No Vercel, Inngest, Upstash, Sentry, Voyage or Firecrawl. Don't reintroduce them.
- Rate limiting is in-memory (`lib/redis/rate-limiter.ts`) — correct only while there is one app instance.
- `NEXT_PUBLIC_*` values are baked in at image build time (Dockerfile build args).
- Schema changes go in a new `supabase/migrations/NNN_*.sql`; `deploy/migrate.sh` applies each file once.
