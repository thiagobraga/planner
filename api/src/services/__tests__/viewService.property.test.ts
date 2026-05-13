import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";

const mockQuery = vi.fn();

vi.mock("../../db/pool.js", () => ({
  default: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

import { getTodayView, getUpcomingView } from "../viewService.js";

const userId = "user-1";

function row(id: string, dueDate: string, priority: number, orderValue: number) {
  return {
    id,
    user_id: userId,
    project_id: "p-1",
    section_id: null,
    parent_task_id: null,
    assignee_user_id: null,
    title: `T-${id}`,
    description: null,
    priority,
    due_date: dueDate,
    due_time: null,
    due_timezone: null,
    recurrence_rule: null,
    is_completed: false,
    completed_at: null,
    order_value: orderValue,
    depth: 0,
    created_at: "2024-06-01T00:00:00Z",
    updated_at: "2024-06-01T00:00:00Z",
  };
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

const arbPriority = fc.integer({ min: 1, max: 4 });
const arbOrder = fc.integer({ min: 0, max: 100000 });
const arbDayOffset = fc.integer({ min: -30, max: 0 });

beforeEach(() => {
  mockQuery.mockReset();
});

describe("Property 20: Today view correctness (Requirements 15.2, 15.5, 15.6)", () => {
  it("partitions tasks into overdue (< today) and today (=== today), sorted by priority then order_value", () => {
    const today = "2024-06-15";

    fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(arbDayOffset, arbPriority, arbOrder), { minLength: 0, maxLength: 30 }),
        async (tasks) => {
          mockQuery.mockReset();
          // Order rows the way the SQL would: priority ASC, order_value ASC
          const rows = tasks
            .map(([off, prio, ord], i) => row(`t${i}`, addDays(today, off), prio, ord))
            .sort((a, b) => a.priority - b.priority || a.order_value - b.order_value);

          mockQuery
            .mockResolvedValueOnce({ rows: [{ time_zone: "UTC" }] })
            .mockResolvedValueOnce({ rows });

          const view = await getTodayView(userId, new Date(`${today}T12:00:00Z`));

          expect(view.date).toBe(today);

          for (const t of view.overdue) {
            expect(t.dueDate! < today).toBe(true);
          }
          for (const t of view.today) {
            expect(t.dueDate).toBe(today);
          }
          expect(view.overdue.length + view.today.length).toBe(rows.length);

          // Both groups preserve priority ASC then order_value ASC
          for (const group of [view.overdue, view.today]) {
            for (let i = 1; i < group.length; i++) {
              const a = group[i - 1];
              const b = group[i];
              expect(
                a.priority < b.priority ||
                  (a.priority === b.priority && a.orderValue <= b.orderValue),
              ).toBe(true);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Property 21: Upcoming view correctness (Requirements 15.3, 15.4, 15.5)", () => {
  it("groups tasks by due_date with all days in [start, end] present, in order", () => {
    const today = "2024-06-15";

    fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 7, max: 30 }),
        fc.array(fc.tuple(fc.integer({ min: 0, max: 29 }), arbPriority, arbOrder), { minLength: 0, maxLength: 40 }),
        async (days, tasks) => {
          mockQuery.mockReset();
          // Only tasks within window
          const rows = tasks
            .filter(([off]) => off < days)
            .map(([off, prio, ord], i) => row(`t${i}`, addDays(today, off), prio, ord))
            .sort((a, b) =>
              a.due_date.localeCompare(b.due_date) ||
              a.priority - b.priority ||
              a.order_value - b.order_value,
            );

          mockQuery
            .mockResolvedValueOnce({ rows: [{ time_zone: "UTC" }] })
            .mockResolvedValueOnce({ rows });

          const view = await getUpcomingView(userId, days, new Date(`${today}T12:00:00Z`));

          expect(view.start).toBe(today);
          expect(view.end).toBe(addDays(today, days - 1));
          expect(view.days).toHaveLength(days);

          // Days are consecutive starting at today
          for (let i = 0; i < days; i++) {
            expect(view.days[i].date).toBe(addDays(today, i));
          }

          // Every task ends up in the bucket matching its due_date
          const flattened = view.days.flatMap((d) => d.tasks);
          expect(flattened).toHaveLength(rows.length);
          for (const day of view.days) {
            for (const t of day.tasks) {
              expect(t.dueDate).toBe(day.date);
            }
            // Within a day: priority ASC then order_value ASC
            for (let i = 1; i < day.tasks.length; i++) {
              const a = day.tasks[i - 1];
              const b = day.tasks[i];
              expect(
                a.priority < b.priority ||
                  (a.priority === b.priority && a.orderValue <= b.orderValue),
              ).toBe(true);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
