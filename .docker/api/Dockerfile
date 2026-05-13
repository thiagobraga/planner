# Stage 1: Build
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@11.1.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/
RUN pnpm install --frozen-lockfile --filter api

COPY api api
RUN pnpm --filter api build

# Stage 2: Production
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@11.1.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY api/package.json api/
RUN pnpm install --frozen-lockfile --filter api --prod

COPY --from=builder /app/api/dist api/dist

EXPOSE 4000

CMD ["node", "api/dist/index.js"]
