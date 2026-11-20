import { describe, it, expect, beforeEach, afterEach } from "vitest";
import pool from "../../db/pool.js";
import { createTestUserWithCollection } from "../../test/fixtures.js";
import { createTask, updateTask } from "../taskService.js";

type Fixture = Awaited<ReturnType<typeof createTestUserWithCollection>>;
let owner: Fixture;

const dueDateOf = async (id: string) =>
  ((await pool.query<{ due: string | null }>(`SELECT to_char(due_date, 'YYYY-MM-DD') AS due FROM tasks WHERE id = $1`, [id])).rows[0]).due;

describe("rescheduling a parent (real PostgreSQL)", () => {
  beforeEach(async () => {
    owner = await createTestUserWithCollection();
  });

  afterEach(async () => {
    await owner.cleanup();
  });

  it("moves every subtask to the parent's new date, so they stay nested under it", async () => {
    const parent = await createTask(owner.userId, { title: "Buy medicine", collectionId: owner.collectionId, dueDate: "2026-11-19" });
    const child = await createTask(owner.userId, { title: "Ointment", collectionId: owner.collectionId, parentTaskId: parent.id, dueDate: "2026-11-19" });
    const grandchild = await createTask(owner.userId, { title: "Check dose", collectionId: owner.collectionId, parentTaskId: child.id, dueDate: "2026-11-19" });

    await updateTask(parent.id, owner.userId, { dueDate: "2026-11-20" });

    expect(await dueDateOf(parent.id)).toBe("2026-11-20");
    expect(await dueDateOf(child.id)).toBe("2026-11-20");
    expect(await dueDateOf(grandchild.id)).toBe("2026-11-20");
  });

  it("leaves subtasks alone when the update does not touch the date", async () => {
    const parent = await createTask(owner.userId, { title: "Buy medicine", collectionId: owner.collectionId, dueDate: "2026-11-19" });
    const child = await createTask(owner.userId, { title: "Ointment", collectionId: owner.collectionId, parentTaskId: parent.id, dueDate: "2026-11-18" });

    await updateTask(parent.id, owner.userId, { title: "Buy medicine for Meg" });

    expect(await dueDateOf(child.id)).toBe("2026-11-18");
  });
});
