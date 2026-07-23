import { v4 as uuidv4 } from "uuid";
import pool from "./pool.js";
import { hashPassword } from "../services/passwordService.js";

async function seed() {
  const email = "dev@planner.local";
  const password = process.env.SEED_PASSWORD || "password123";
  const displayName = "Dev User";

  const existing = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [email]
  );

  if (existing.rows.length > 0) {
    console.log("Seed user already exists.");
    process.exit(0);
  }

  const passwordHash = await hashPassword(password);
  const userId = uuidv4();
  const collectionId = uuidv4();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO users (id, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4)`,
      [userId, email, passwordHash, displayName]
    );

    await client.query(
      `INSERT INTO collections (id, user_id, name, color, is_inbox)
       VALUES ($1, $2, 'Inbox', 'grey', true)`,
      [collectionId, userId]
    );

    // Example collections + tasks so the Collections page has content out of the box.
    const exampleCollections: Array<{
      name: string;
      color: string;
      parentName?: string;
      tasks: Array<{ title: string; priority?: number }>;
    }> = [
      {
        name: "Work",
        color: "blue",
        tasks: [
          { title: "Review quarterly roadmap", priority: 2 },
          { title: "Reply to the design feedback thread", priority: 3 },
          { title: "Prepare standup notes" },
        ],
      },
      {
        name: "Website Redesign",
        color: "sky_blue",
        parentName: "Work",
        tasks: [
          { title: "Audit current landing page", priority: 2 },
          { title: "Draft new hero section copy", priority: 3 },
        ],
      },
      {
        name: "Personal",
        color: "green",
        tasks: [
          { title: "Book dentist appointment", priority: 1 },
          { title: "Plan weekend trip" },
        ],
      },
      {
        name: "Reading List",
        color: "violet",
        tasks: [
          { title: "Finish 'The Pragmatic Programmer'" },
          { title: "Start 'Thinking, Fast and Slow'" },
        ],
      },
    ];

    const collectionIdByName = new Map<string, string>();
    let collectionOrder = 1;
    for (const proj of exampleCollections) {
      const id = uuidv4();
      collectionIdByName.set(proj.name, id);
      await client.query(
        `INSERT INTO collections (id, user_id, parent_id, name, color, order_value)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          userId,
          proj.parentName ? collectionIdByName.get(proj.parentName) ?? null : null,
          proj.name,
          proj.color,
          collectionOrder++,
        ]
      );

      let taskOrder = 1;
      for (const task of proj.tasks) {
        await client.query(
          `INSERT INTO tasks (id, user_id, collection_id, title, priority, order_value)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [uuidv4(), userId, id, task.title, task.priority ?? 4, taskOrder++]
        );
      }
    }

    await client.query(
      `INSERT INTO preferences (user_id) VALUES ($1)`,
      [userId]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seeding failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
