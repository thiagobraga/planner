# Stage 1: Install deps
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@11.1.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY app/package.json app/
RUN pnpm install --frozen-lockfile --filter app

COPY app app

EXPOSE 5173

CMD ["pnpm", "--filter", "app", "dev", "--host"]
