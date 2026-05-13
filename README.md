# Todoist Web Clone

Full-stack implementation of a Todoist clone with React, Node.js/Express, PostgreSQL, and real-time synchronization.

## Tech Stack

- **Frontend**: React + TypeScript, Zustand, React Query
- **Backend**: Node.js + Express, PostgreSQL, Redis
- **Infrastructure**: Docker, Docker Compose

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
