import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listHabits, toggleCompletion } from "../../services/habitService.js";
import { addDaysISO } from "../../services/viewService.js";
import type { McpAuthContext } from "../../types/mcp.js";
import { resolveDue, resolveHabit, todayFor } from "../resolve.js";
import { getUserTimezone, runTool } from "../toolkit.js";

/** Consecutive completed days ending today, or yesterday when today is still open. */
export function currentStreak(completions: Set<string>, today: string): number {
  let day = completions.has(today) ? today : addDaysISO(today, -1);
  let streak = 0;
  while (completions.has(day)) {
    streak++;
    day = addDaysISO(day, -1);
  }
  return streak;
}

export function registerHabitReadTools(server: McpServer, ctx: McpAuthContext): void {
  server.registerTool(
    "list_habits",
    {
      title: "Habits",
      description: "Habits with whether they are done today, completions in the last 7 days, and the current streak.",
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    () =>
      runTool(async () => {
        const [habits, timeZone] = await Promise.all([listHabits(ctx.userId), getUserTimezone(ctx.userId)]);
        if (habits.length === 0) return "No habits.";
        const today = todayFor(timeZone, ctx.now());
        const lastWeek = Array.from({ length: 7 }, (_, i) => addDaysISO(today, -i));
        return habits
          .map((habit) => {
            const done = new Set(habit.completions);
            const week = lastWeek.filter((d) => done.has(d)).length;
            return `- [${done.has(today) ? "x" : " "}] ${habit.name} · ${week}/7 this week · streak ${currentStreak(done, today)} · id:${habit.id}`;
          })
          .join("\n");
      }),
  );
}

export function registerHabitWriteTools(server: McpServer, ctx: McpAuthContext): void {
  server.registerTool(
    "log_habit",
    {
      title: "Log habit",
      description: "Mark a habit done (or not done) for a day, default today. Accepts the habit name or id.",
      inputSchema: {
        habit: z.string().min(1).describe("Habit name or id"),
        date: z.string().optional().describe("YYYY-MM-DD; defaults to today in the user's timezone"),
        done: z.boolean().default(true),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    ({ habit, date, done }) =>
      runTool(async () => {
        const timeZone = await getUserTimezone(ctx.userId);
        const ref = await resolveHabit(ctx.userId, habit);
        const day = date ? resolveDue(date, timeZone, ctx.now()).dueDate : todayFor(timeZone, ctx.now());
        await toggleCompletion(ctx.userId, ref.id, day, done);
        return `${ref.name}: marked ${done ? "done" : "not done"} for ${day}.`;
      }),
  );
}
