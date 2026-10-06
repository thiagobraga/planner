import { describe, it, expect } from "vitest";
import { dateKey, formatTaskLine, formatTaskList, MAX_LISTED } from "../format.js";

const names = new Map([["c1", "Personal"]]);

describe("MCP task formatting", () => {
  it("renders one compact line ending with the id", () => {
    const line = formatTaskLine(
      {
        id: "t1",
        title: "Call the dentist",
        collectionId: "c1",
        priority: 1,
        dueDate: "2026-10-09",
        dueTime: "15:00",
        deadlineDate: "2026-10-10",
        isCompleted: false,
        recurrenceRule: { type: "weekly" },
        labels: [{ name: "health" }],
      },
      names,
    );

    expect(line).toBe(
      "- [ ] Call the dentist · due 2026-10-09 15:00 · deadline 2026-10-10 · recurring · p1 · @health · #Personal · id:t1",
    );
  });

  it("omits empty fields, the default priority and the plain task type", () => {
    expect(formatTaskLine({ id: "t2", title: "Done thing", priority: 4, type: "task", isCompleted: true }, names)).toBe(
      "- [x] Done thing · id:t2",
    );
  });

  it("prefers an explicit collection name and label names when given (filter results)", () => {
    const line = formatTaskLine({ id: "t3", title: "x", collectionName: "Work", labelNames: ["a"], type: "note" }, names);
    expect(line).toBe("- [ ] x · note · @a · #Work · id:t3");
  });

  it("reads node-postgres local-midnight Dates as calendar dates", () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(dateKey("2026-01-05T00:00:00.000Z")).toBe("2026-01-05");
  });

  it("returns the empty text for no tasks and truncates long lists", () => {
    expect(formatTaskList([], names, "Inbox is empty.")).toBe("Inbox is empty.");

    const many = Array.from({ length: MAX_LISTED + 3 }, (_, i) => ({ id: `t${i}`, title: `Task ${i}` }));
    const lines = formatTaskList(many, names).split("\n");
    expect(lines).toHaveLength(MAX_LISTED + 1);
    expect(lines.at(-1)).toBe("...and 3 more. Narrow it down with filter_tasks.");
  });
});
