---
name: db-migration
description: Use when creating a database migration for Planner. Triggers: adding a table, adding a column, any schema change to api/src/db/migrations/.
---

# DB Migration

## Overview

Migrations are numbered SQL files in `api/src/db/migrations/`. They run once in order. No idempotency guards needed — the runner tracks applied migrations in `schema_migrations`.

## Naming

```bash
ls api/src/db/migrations/ | sort | tail -1   # find current max (currently 015_)
```

Next file: `NNN_snake_case_description.sql` where NNN = current max + 1.

## New Table Template

```sql
CREATE TABLE things (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_things_user ON things(user_id);
```

**Common FK patterns:**
- User-owned: `REFERENCES users(id) ON DELETE CASCADE`
- Project-scoped: `REFERENCES projects(id) ON DELETE CASCADE`
- Optional parent: `REFERENCES x(id) ON DELETE SET NULL`

## Add Column

```sql
ALTER TABLE things ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'active';
```

## Index Patterns

```sql
-- Standard
CREATE INDEX idx_things_user ON things(user_id);

-- Partial (active records only)
CREATE INDEX idx_things_user_active ON things(user_id) WHERE NOT is_completed;

-- Composite
CREATE INDEX idx_things_user_project ON things(user_id, project_id);

-- Full-text search
CREATE INDEX idx_things_search ON things USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));
```

Naming convention: `idx_{table}_{columns}`.

## Apply Migration

Migrations auto-apply on API start. To apply manually:
```bash
pnpm -F api tsx src/db/migrate.ts
```

Verify: check that `schema_migrations` table contains the new filename.

## Common Types

| Use case | Type |
|----------|------|
| Primary key | `UUID DEFAULT uuid_generate_v4()` |
| Short text | `VARCHAR(500)` |
| Long text | `TEXT` |
| Integer | `SMALLINT` / `INTEGER` |
| Flag | `BOOLEAN NOT NULL DEFAULT false` |
| Timestamp | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` |
| Date | `DATE` |
| Structured | `JSONB` |

## Don'ts

- No `DROP TABLE` or `DROP COLUMN` without explicit user request
- No `DELETE FROM` data tables in migrations
- No `IF NOT EXISTS` on `CREATE TABLE` — migrations run once
- No data backfills inside migrations (do in a separate script)
- Transactions wrap automatically — don't add `BEGIN`/`COMMIT`
