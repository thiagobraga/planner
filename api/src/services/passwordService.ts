import crypto from "node:crypto";
import argon2 from "argon2";
import { AppError } from "../utils/AppError.js";

const MIN_LENGTH = 15;
const MAX_LENGTH = 128;

const ARGON2_OPTIONS: argon2.HashOptions & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
};

const BLOCKLIST: string[] = [
  "password",
  "passw0rd",
  "123456",
  "12345678",
  "123456789",
  "qwerty123",
  "abc123",
  "letmein",
  "welcome",
  "monkey",
  "dragon",
  "master",
  "planner",
  "bulletjournal",
  "dev@planner.local",
  "password123",
];

function normalizeNfc(value: string): string {
  return value.normalize("NFC");
}

function isBlocklisted(value: string): boolean {
  const lower = value.toLowerCase().normalize("NFC");
  return BLOCKLIST.some(
    (word) => lower.includes(word) || word.includes(lower),
  );
}

export function validatePassword(raw: string): string {
  const password = normalizeNfc(raw);

  if (password.length < MIN_LENGTH) {
    throw new AppError({
      code: "WEAK_PASSWORD",
      message: `Password must be at least ${MIN_LENGTH} characters`,
      statusCode: 400,
    });
  }

  if (password.length > MAX_LENGTH) {
    throw new AppError({
      code: "WEAK_PASSWORD",
      message: `Password must be at most ${MAX_LENGTH} characters`,
      statusCode: 400,
    });
  }

  if (isBlocklisted(password)) {
    throw new AppError({
      code: "WEAK_PASSWORD",
      message: "Password is too common. Choose a longer, less common passphrase.",
      statusCode: 400,
    });
  }

  return password;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyArgon2id(
  hash: string,
  password: string,
): Promise<boolean> {
  return argon2.verify(hash, password);
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
