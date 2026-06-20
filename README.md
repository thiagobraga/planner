<div align="center">
  <img src="app/public/images/bulletjournal-planner.png" alt="Planner" width="120" />
  <h1>Planner</h1>
  <p>Beautiful and easy to use Bullet Journal todo list management.</p>
</div>

## Getting Started

```bash
# Install dependencies
pnpm install

# Start services
docker-compose up -d

# Run migrations
pnpm -F api db:migrate

# Start development
pnpm dev
```

## Architecture

See [design documentation](.kiro/specs/todoist-web-clone/design.md) for detailed system architecture and data model.

## Implementation Plan

The project is organized by task waves as defined in [tasks.md](.kiro/specs/todoist-web-clone/tasks.md).

## Stack

| Resource | Status |
|----------|--------|
| [React](https://react.dev) | `^18.3.1` |
| [TypeScript](https://www.typescriptlang.org) | `^5.6.0` |
| [Express.js](https://expressjs.com) | `^4.21.0` |
| [PostgreSQL](https://www.postgresql.org) | `^8.13.0` |
| [Vite](https://vite.dev) | `^5.4.0` |
| [Vitest](https://vitest.dev) | `^2.1.0` |
| [Tailwind CSS](https://tailwindcss.com) | `^4.3.0` |
| [Zustand](https://zustand.docs.pmnd.rs) | `^5.0.0` |
| [TanStack Query](https://tanstack.com/query) | `^5.56.0` |
| [Docker](https://www.docker.com) | Yes |
| [Docker Compose](https://docs.docker.com/compose/) | Yes |
| Entrypoint | No |
| Image | `node:22-alpine` |
| AI Agents | `AGENTS`, `CLAUDE`, `GEMINI` |
