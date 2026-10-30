# syntax=docker/dockerfile:1.7
#
# GrantPilot images (built by deploy/docker-compose.yml):
#   docker build --target app    -t grantpilot-app .     # Next.js standalone server
#   docker build --target worker -t grantpilot-worker .  # pg-boss worker (tsx worker/index.ts)
#
# NEXT_PUBLIC_* values are inlined into the browser bundle at build time, so
# they are build args; everything else is read at runtime from the environment.

ARG NODE_IMAGE=node:22-bookworm-slim

# ---- deps: full install (dev deps included — the build and tsx need them) ----
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# ---- builder: next build -> .next/standalone ----
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APP_NAME="GrantPilot AI"
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}

# Server-only placeholders so modules that read process.env.X! at import time
# survive page-data collection. Scoped to this RUN; real values come at runtime.
RUN SUPABASE_SERVICE_ROLE_KEY=build-placeholder \
    SUPABASE_JWT_SECRET=build-placeholder \
    ANTHROPIC_API_KEY=build-placeholder \
    RESEND_API_KEY=re_build_placeholder \
    STRIPE_SECRET_KEY=sk_build_placeholder \
    CRON_SECRET=build-placeholder \
    npm run build

# ---- app: minimal runtime (standalone server + static assets) ----
FROM ${NODE_IMAGE} AS app
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

# ---- worker: pg-boss jobs + crons, run from TypeScript source via tsx ----
FROM ${NODE_IMAGE} AS worker
ENV NODE_ENV=production
# Writable app dir: one-off scripts (scripts/reembed-all.ts) checkpoint into cwd.
RUN mkdir -p /app && chown node:node /app
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .
USER node
CMD ["npx", "--no-install", "tsx", "worker/index.ts"]
