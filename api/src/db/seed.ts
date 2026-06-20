import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import pool from "./pool.js";

const BCRYPT_COST = 12;

async function seed() {
  const email = "dev@planner.local";
  const password = "password123";
  const displayName = "Dev User";

  const existing = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [email]
  );

  if (existing.rows.length > 0) {
    console.log("Seed user already exists.");
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const userId = uuidv4();
  const projectId = uuidv4();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO users (id, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4)`,
      [userId, email, passwordHash, displayName]
    );

    await client.query(
      `INSERT INTO projects (id, user_id, name, color, is_inbox)
       VALUES ($1, $2, 'Inbox', 'grey', true)`,
      [projectId, userId]
    );

    await client.query(
      `INSERT INTO preferences (user_id) VALUES ($1)`,
      [userId]
    );

    await client.query("COMMIT");
    console.log(`Seeded user: ${email} with password: ${password}`);
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
