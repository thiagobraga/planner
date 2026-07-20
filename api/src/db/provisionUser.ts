import fs from "node:fs";
import { v4 as uuidv4 } from "uuid";
import pool from "./pool.js";
import { validatePassword, hashPassword } from "../services/passwordService.js";
import { securityLog } from "../utils/securityLogger.js";

async function provisionUser(
  email: string,
  password: string,
): Promise<void> {
  const normalizedEmail = email.toLowerCase().normalize("NFC");
  const validatedPassword = validatePassword(password);
  const passwordHash = await hashPassword(validatedPassword);
  const userId = uuidv4();
  const collectionId = uuidv4();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO users (id, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (LOWER(email)) DO UPDATE SET password_hash = $3`,
      [userId, normalizedEmail, passwordHash],
    );

    await client.query(
      `INSERT INTO collections (id, user_id, name, color, is_inbox)
       VALUES ($1, $2, 'Inbox', 'grey', true)
       ON CONFLICT DO NOTHING`,
      [collectionId, userId],
    );

    await client.query(
      `INSERT INTO preferences (user_id)
       VALUES ($1)
       ON CONFLICT DO NOTHING`,
      [userId],
    );

    await client.query("COMMIT");
    console.log("User provisioned successfully.");
    securityLog.provisioningUserCreated(userId, normalizedEmail);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to provision user:", (err as Error).message);
    process.exit(1);
  } finally {
    client.release();
  }

  await pool.end();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const productionFlagIndex = args.indexOf("--production");
  if (productionFlagIndex === -1) {
    console.error("Refusing to run without --production flag.");
    process.exit(1);
  }

  const emailFlagIndex = args.indexOf("--email");
  const passwordFlagIndex = args.indexOf("--password");
  const passwordFileIndex = args.indexOf("--password-file");
  const passwordStdinIndex = args.indexOf("--password-stdin");

  if (emailFlagIndex === -1 || emailFlagIndex === args.length - 1) {
    console.error("Usage: --email <email> --password-file <path> | --password-stdin");
    process.exit(1);
  }
  const email = args[emailFlagIndex + 1];

  if (passwordFlagIndex !== -1) {
    console.error("Do not pass passwords as command-line arguments. Use --password-file or --password-stdin.");
    process.exit(1);
  }

  let password: string;

  if (passwordFileIndex !== -1 && passwordFileIndex < args.length - 1) {
    password = fs.readFileSync(args[passwordFileIndex + 1], "utf8").replace(/\n$/, "");
  } else if (passwordStdinIndex !== -1) {
    password = await new Promise<string>((resolve) => {
      let data = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk: string) => {
        data += chunk;
      });
      process.stdin.on("end", () => {
        resolve(data.replace(/\n$/, ""));
      });
    });
  } else {
    console.error("Provide --password-file <path> or --password-stdin.");
    process.exit(1);
  }

  await provisionUser(email, password);
}

main().catch((err) => {
  console.error("Provisioning failed:", (err as Error).message);
  process.exit(1);
});
