#!/bin/sh
set -e

npm ci

# Run migrations
echo "Running database migrations..."
npx tsx src/db/migrate.ts

# Seed development database
echo "Seeding development database..."
npx tsx src/db/seed.ts || true

# Run with tsx directly (not watch) to avoid EMFILE in containers
# For development with hot reload, use `npm run build && npm run start` in CI/containers
exec npx tsx src/index.ts
