# SoftStop API — self-host image (in-memory by default).
# Build / run via compose: `docker compose up --build`
# Or: `docker build -t softstop . && docker run --rm -p 3000:3000 softstop`
#
# Storage: GOVERNOR_STORAGE=memory (default here). For persistence, pass
# SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and omit or unset memory force.
# Policy: SOFTSTOP_POLICY=default|strict|lenient or SOFTSTOP_POLICY_FILE.
# See .env.example and apps/docs/self-host/

# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@8.15.4 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
RUN pnpm install --frozen-lockfile

FROM node:20-alpine AS runner
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@8.15.4 --activate
ENV NODE_ENV=production
ENV PORT=3000
# Honest default for 1-click / compose: ephemeral memory, no Supabase required.
ENV GOVERNOR_STORAGE=memory
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY governor ./governor
COPY demo ./demo
COPY policies ./policies
COPY tsconfig.json ./
COPY scripts ./scripts
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["pnpm", "exec", "tsx", "governor/api/src/server.ts"]
