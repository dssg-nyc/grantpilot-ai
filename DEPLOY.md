# Deploying GrantPilot AI (single VPS, self-hosted)

Everything runs on one Linux box under Docker Compose (`deploy/docker-compose.yml`):

| Service | Image | Role |
|---|---|---|
| `db` | `supabase/postgres` 17 (pgvector) | all data, auth users, pg-boss queue |
| `auth` | `supabase/gotrue` | email/password + Google OAuth (`/auth/v1`) |
| `rest` | `postgrest/postgrest` | supabase-js queries + RPC (`/rest/v1`) |
| `kong` | `kong/kong` | Supabase API gateway (apikey → role) |
| `ollama` (+ one-shot `ollama-pull`) | `ollama/ollama` | `bge-m3` embeddings (1024-dim) |
| `migrate` (one-shot) | `supabase/postgres` | applies `supabase/migrations/*.sql` once each |
| `app` | built from `Dockerfile` target `app` | Next.js standalone server (:3000) |
| `worker` | built from `Dockerfile` target `worker` | pg-boss jobs + crons (`tsx worker/index.ts`) |
| `caddy` | `caddy` | HTTPS (Let's Encrypt) + routing |
| `meta`, `studio` (profile `studio`) | Supabase | optional admin dashboard |

Paid services still used: **Anthropic** (AI), **Resend** (app email + GoTrue SMTP), **Stripe** (billing). Voyage, Firecrawl, Inngest, Upstash, Sentry and Vercel are gone.

Routing (single domain): `https://APP_DOMAIN/auth/v1/*` and `/rest/v1/*` → Kong; everything else → Next.js. Only ports 80/443 are public; Postgres (5432) and Kong (8000) bind to `127.0.0.1` for SSH-tunnel access.

---

## 1. VPS sizing

| | Minimum | Recommended |
|---|---|---|
| RAM | 4 GB + 4 GB swap (build images elsewhere) | **8 GB** |
| vCPU | 2 | 4 (embedding throughput scales with cores) |
| Disk | 40 GB SSD | 80 GB SSD |

Rough steady-state memory: Postgres 0.5–1.5 GB, Ollama with `bge-m3` loaded ~1.5–2 GB, Next.js ~400 MB, worker ~300 MB, GoTrue/PostgREST/Kong/Caddy ~400 MB. `next build` peaks at 2–3 GB, which is why 8 GB is the comfortable size when building on the box. No GPU needed — `bge-m3` on CPU embeds a few docs per second, plenty for sync jobs; the one-time full re-embed is the only slow part.

## 2. From a bare Ubuntu 24.04 box to running

```bash
# --- as root on the new server ---
apt-get update && apt-get -y upgrade
apt-get -y install ca-certificates curl git ufw postgresql-client
curl -fsSL https://get.docker.com | sh            # Docker Engine + compose plugin

adduser --disabled-password --gecos "" grantpilot
usermod -aG docker grantpilot

ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw --force enable

# Optional on 4 GB boxes:
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

DNS: create an `A` (and `AAAA` if you have IPv6) record for your domain → the VPS IP. Caddy can only issue the certificate once it resolves.

```bash
# --- as grantpilot ---
sudo mkdir -p /opt/grantpilot && sudo chown grantpilot: /opt/grantpilot
git clone <repo-url> /opt/grantpilot && cd /opt/grantpilot/deploy

cp .env.example .env
./generate-keys.sh          # fills POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY, …
nano .env                   # APP_DOMAIN, SITE_URL, ACME_EMAIL, SMTP_*, ANTHROPIC_API_KEY, RESEND_API_KEY, STRIPE_*, …

docker compose up -d --build
docker compose ps           # migrate + ollama-pull should show "Exited (0)", the rest "healthy"/"running"
docker compose logs -f app worker
```

First boot order is handled by compose: `db` → `migrate` (applies all migrations) → `auth`/`rest` → `kong` → `app`; `ollama` → `ollama-pull` (downloads `bge-m3`, ~1.2 GB, once) → `worker`.

### Behind an existing Traefik (shared host)

If the box already runs Traefik on 80/443 (e.g. alongside n8n), don't fight it for the ports: `deploy/docker-compose.traefik.yml` drops Caddy's published ports, joins Traefik's Docker network and labels Caddy so Traefik routes `APP_DOMAIN` to it and issues the certificate. Caddy keeps doing the internal `/auth/v1`, `/rest/v1` → Kong split over plain HTTP (`Caddyfile.behind-proxy`).

```bash
# deploy/.env additionally:
TRAEFIK_NETWORK=root_default          # docker inspect <traefik> -f '{{json .NetworkSettings.Networks}}'
TRAEFIK_CERTRESOLVER=mytlschallenge   # Traefik's --certificatesresolvers.<name>

alias dc='docker compose -f docker-compose.yml -f docker-compose.traefik.yml'
dc up -d --build                      # use `dc` instead of `docker compose` everywhere below
```

### Environment (`deploy/.env`)

| Variable | Notes |
|---|---|
| `APP_DOMAIN`, `ACME_EMAIL` | public hostname, Let's Encrypt contact |
| `SITE_URL` | `https://APP_DOMAIN` — app URL and GoTrue Site URL |
| `SUPABASE_PUBLIC_URL` | defaults to `${SITE_URL}` (same domain) |
| `POSTGRES_PASSWORD` | URL-safe (generate-keys uses hex); used inside `DATABASE_URL` |
| `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY` | `./generate-keys.sh` — keys are HS256 JWTs signed with the secret. Rotating the secret means re-minting both keys (`--force`) **and rebuilding `app`** (the anon key is baked into the browser bundle) |
| `SMTP_*` | GoTrue's mailer (signup confirmation, password reset). Resend SMTP: `smtp.resend.com:587`, user `resend`, password = Resend API key |
| `GOOGLE_ENABLED`, `GOOGLE_CLIENT_ID`, `GOOGLE_SECRET` | Google OAuth; Google Cloud redirect URI = `${SITE_URL}/auth/v1/callback` |
| `EMBEDDING_MODEL` | `bge-m3` (must output 1024 dims) |
| `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `STRIPE_*`, `SAM_GOV_API_KEY`, `RSS_FEED_URLS` | app secrets |
| `CRON_SECRET` | bearer token for the manual `/api/cron/*` triggers |

The app containers get derived values from compose: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL=postgres://postgres:…@db:5432/postgres`, `OLLAMA_URL=http://ollama:11434`.

`NEXT_PUBLIC_*` values are inlined at **build** time — after changing `SITE_URL`, `SUPABASE_PUBLIC_URL` or `ANON_KEY`, run `docker compose up -d --build app`.

### Post-deploy wiring

1. **Stripe → Webhooks**: endpoint `https://APP_DOMAIN/api/webhooks/stripe`, copy the signing secret into `STRIPE_WEBHOOK_SECRET`, then `docker compose up -d app`.
2. **Resend**: `EMAIL_FROM` and `SMTP_ADMIN_EMAIL` must be on a verified domain.
3. **Google OAuth** (if used): authorized redirect URI `https://APP_DOMAIN/auth/v1/callback`.

### Smoke test

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://APP_DOMAIN/                 # 200
curl -s https://APP_DOMAIN/auth/v1/health -H "apikey: $ANON_KEY"            # GoTrue JSON
curl -s "https://APP_DOMAIN/rest/v1/opportunities?select=id&limit=1" -H "apikey: $ANON_KEY"
docker compose exec ollama ollama list                                     # bge-m3 present
docker compose logs worker | grep -i cron                                  # schedules registered
```

## 3. Background jobs

The `worker` container runs pg-boss against Postgres (schema `pgboss`); the schedules live in `lib/jobs/definitions.ts` (UTC):

| Job | Schedule |
|---|---|
| `grants/sync.requested` (grants.gov) | every 4h |
| `monitor-rss` | every 4h |
| `sync-sam-gov` | 02:00 daily |
| `crawl-foundations` | 06:00 daily |
| `send-digest-emails` | Mondays 09:00 |
| `update-trending-scores` | hourly |

No system cron or Vercel cron is needed. The old HTTP endpoints still work for one-off manual runs:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://APP_DOMAIN/api/cron?pages=1&batch=5"   # grants.gov
curl -H "Authorization: Bearer $CRON_SECRET" "https://APP_DOMAIN/api/cron/foundations"
curl -H "Authorization: Bearer $CRON_SECRET" "https://APP_DOMAIN/api/cron/rss"
curl -H "Authorization: Bearer $CRON_SECRET" "https://APP_DOMAIN/api/cron/reembed"
```

One-off scripts run inside the worker image (it has the full source, dev deps and the same env):

```bash
docker compose run --rm worker npx tsx scripts/sync-all.ts
```

## 4. Database

### Migrations

`deploy/migrate.sh` applies `supabase/migrations/*.sql` in filename order, each in its own transaction, and records them in `_grantpilot.schema_migrations`. The `migrate` service runs it on every `docker compose up`; already-applied files are skipped. To add a migration, drop `017_….sql` into `supabase/migrations/` and redeploy (or `docker compose run --rm migrate`).

Manual run from the host: `DATABASE_URL=postgres://postgres:$POSTGRES_PASSWORD@127.0.0.1:5432/postgres deploy/migrate.sh`.

### Admin access

```bash
# psql
psql "postgres://postgres:$POSTGRES_PASSWORD@127.0.0.1:5432/postgres"
# Studio (optional): on the server
docker compose --profile studio up -d
# from your laptop
ssh -L 8000:127.0.0.1:8000 grantpilot@your-vps   # open http://localhost:8000, DASHBOARD_USERNAME / DASHBOARD_PASSWORD
```

## 5. Backups

`deploy/backup.sh` writes a compressed `pg_dump` (schemas `public`, `auth`, `_grantpilot`, `pgboss`) to `/var/backups/grantpilot` and prunes dumps older than 14 days.

```bash
sudo mkdir -p /var/backups/grantpilot && sudo chown grantpilot: /var/backups/grantpilot
crontab -e
# 15 3 * * * /opt/grantpilot/deploy/backup.sh >> /var/log/grantpilot-backup.log 2>&1
```

Copy dumps off the box (e.g. `rclone copy /var/backups/grantpilot remote:grantpilot-backups` in the same cron) — a backup on the same disk is not a backup.

Restore into a fresh stack:

```bash
docker compose up -d db && docker compose run --rm migrate   # recreate schema + tracking table
docker compose up -d auth                                     # let GoTrue create/upgrade the auth schema
docker compose exec -T db pg_restore -U supabase_admin -d postgres --data-only --disable-triggers \
  < /var/backups/grantpilot/grantpilot-YYYYMMDDTHHMMSSZ.dump
docker compose up -d
```

(For a full disaster restore you can also restore schema + data with `--clean --if-exists` instead of `--data-only`.)

## 6. Migrating from the hosted Supabase project

Users keep their passwords (bcrypt hashes move with `auth.users`) but must sign in again — sessions were signed with the old project's JWT secret.

```bash
OLD="postgresql://postgres:<old-db-password>@db.<ref>.supabase.co:5432/postgres?sslmode=require"

# 1. Dump from hosted (data only; the schema comes from our migrations)
pg_dump "$OLD" --data-only --table=auth.users --table=auth.identities -Fc -f auth.dump
pg_dump "$OLD" --data-only --schema=public -Fc -f public.dump

# 2. On the VPS: create schema, start GoTrue so the auth tables exist
docker compose up -d db && docker compose run --rm migrate && docker compose up -d auth

# 3. Load auth users first (public.users references them), then app data.
#    --disable-triggers needs the superuser, hence supabase_admin.
docker compose exec -T db pg_restore -U supabase_admin -d postgres --data-only --disable-triggers < auth.dump
docker compose exec -T db pg_restore -U supabase_admin -d postgres --data-only --disable-triggers < public.dump

# 4. Bring everything up, then re-embed (next section)
docker compose up -d
```

If `pg_restore` complains about a column in `auth.users` that doesn't exist (hosted GoTrue newer than the pinned image), bump the `auth` image tag in `deploy/docker-compose.yml` to the hosted version, restart `auth`, and retry. To also move `auth.sessions`/`refresh_tokens` is pointless — they're invalid under the new JWT secret.

## 7. Re-embedding (required after migrating data or changing `EMBEDDING_MODEL`)

Vectors from Voyage and `bge-m3` live in different spaces — every `opportunities.embedding` and `organizations.profile_embedding` must be regenerated before matching/search results are meaningful:

```bash
# scripts/reembed-all.ts — resumable. The checkpoint lives in /tmp/reembed on the
# host so an interrupted `run --rm` container can pick up where it stopped.
mkdir -p /tmp/reembed && chmod 777 /tmp/reembed
docker compose run --rm -v /tmp/reembed:/state -e STATE_FILE=/state/reembed-state.json worker npx tsx scripts/reembed-all.ts
# smoke test first:  docker compose run --rm -e LIMIT=50 -e DRY_RUN=1 worker npx tsx scripts/reembed-all.ts
```

Afterwards recompute every org's matches so stored scores reflect the new vectors:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" -H "Content-Type: application/json" \
  -d '{"job":"grants/new-opportunities"}' "https://APP_DOMAIN/api/agents/trigger"
```

The recompute replaces each org's match set: Voyage-era matches that no longer qualify are deleted, except ones the user has saved, applied to or dismissed. Match statuses are never reset by a recompute.

`bge-m3` similarities are mapped back onto the Voyage scale (`calibrateSimilarity` in `lib/embeddings.ts`) so thresholds and match scores keep their meaning. If you change `EMBEDDING_MODEL`, re-measure that calibration.

## 8. Updates and rollbacks

```bash
cd /opt/grantpilot
deploy/backup.sh                                  # always before a deploy
git pull
cd deploy
export IMAGE_TAG=$(git rev-parse --short HEAD)    # tag images per commit
docker compose build app worker
docker compose up -d                              # migrate runs first, then app/worker restart
docker image prune -f
```

Rollback (code only): check out the previous commit and start its images, which are still tagged locally:

```bash
git checkout <previous-sha>
IMAGE_TAG=<previous-sha> docker compose up -d app worker
```

Migrations are forward-only. If a release included a migration that must be undone, restore the pre-deploy backup (section 5) or write a corrective migration.

Updating Supabase/Ollama/Caddy images: bump the pinned tags in `deploy/docker-compose.yml`, `docker compose pull && docker compose up -d`. Read Supabase's self-hosting changelog first; GoTrue runs its own migrations on start.

## 9. Operations cheat sheet

| Task | Command |
|---|---|
| Status | `docker compose ps` |
| Logs | `docker compose logs -f --tail=200 app worker auth` |
| Restart app | `docker compose restart app` |
| Shell in DB | `docker compose exec db psql -U postgres` |
| Queue state | `docker compose exec db psql -U postgres -c "select name, state, count(*) from pgboss.job group by 1,2 order by 1"` |
| Disk usage | `docker system df` |
