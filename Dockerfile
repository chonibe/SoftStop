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
ENV GOVERNOR_STORAGE=memory
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY governor ./governor
COPY demo ./demo
COPY policies ./policies
COPY tsconfig.json ./
COPY scripts ./scripts
EXPOSE 3000
CMD ["pnpm", "exec", "tsx", "governor/api/src/server.ts"]
