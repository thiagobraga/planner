import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";

export interface SearchableEntity {
  id: string;
  type: "task" | "project" | "label";
  text: string;
  updatedAt: string;
  description?: string | null;
}

export interface SearchResults {
  tasks: SearchableEntity[];
  projects: SearchableEntity[];
  labels: SearchableEntity[];
}

const MAX_PER_TYPE = 50;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;

export function validateQuery(q: string): { tooShort: boolean } {
  if (q.length > MAX_QUERY_LENGTH) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Search query is too long",
      statusCode: 400,
      details: [{ field: "q", message: `Query must be at most ${MAX_QUERY_LENGTH} characters` }],
    });
  }
  return { tooShort: q.length < MIN_QUERY_LENGTH };
}

// Pure matcher kept testable in isolation
export function matchesQuery(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function applySearch<T extends { text: string; description?: string | null; updatedAt: string }>(
  entities: T[],
  query: string,
): T[] {
  return entities
    .filter((e) => matchesQuery(e.text, query) || (e.description ? matchesQuery(e.description, query) : false))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_PER_TYPE);
}

export async function searchEntities(userId: string, query: string): Promise<SearchResults> {
  const { tooShort } = validateQuery(query);

  if (tooShort) {
    return { tasks: [], projects: [], labels: [] };
  }

  const pattern = `%${query.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

  const [tasksResult, projectsResult, labelsResult] = await Promise.all([
    pool.query(
      `SELECT id, title AS text, description, updated_at
       FROM tasks
       WHERE (user_id = $1 OR project_id IN (SELECT project_id FROM collaborators WHERE user_id = $1))
         AND (title ILIKE $2 OR COALESCE(description, '') ILIKE $2)
       ORDER BY updated_at DESC
       LIMIT $3`,
      [userId, pattern, MAX_PER_TYPE],
    ),
    pool.query(
      `SELECT id, name AS text, updated_at
       FROM projects
       WHERE (user_id = $1 OR id IN (SELECT project_id FROM collaborators WHERE user_id = $1))
         AND name ILIKE $2
       ORDER BY updated_at DESC
       LIMIT $3`,
      [userId, pattern, MAX_PER_TYPE],
    ),
    pool.query(
      `SELECT id, name AS text, updated_at
       FROM labels
       WHERE user_id = $1
         AND name ILIKE $2
       ORDER BY updated_at DESC
       LIMIT $3`,
      [userId, pattern, MAX_PER_TYPE],
    ),
  ]);

  return {
    tasks: (tasksResult.rows as { id: string; text: string; description: string | null; updated_at: string }[])
      .map((r) => ({ id: r.id, type: "task" as const, text: r.text, description: r.description, updatedAt: r.updated_at })),
    projects: (projectsResult.rows as { id: string; text: string; updated_at: string }[])
      .map((r) => ({ id: r.id, type: "project" as const, text: r.text, updatedAt: r.updated_at })),
    labels: (labelsResult.rows as { id: string; text: string; updated_at: string }[])
      .map((r) => ({ id: r.id, type: "label" as const, text: r.text, updatedAt: r.updated_at })),
  };
}
