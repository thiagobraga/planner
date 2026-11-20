import { redisClient } from "../../db/redis.js";
import { currentActor } from "../../middleware/requestContext.js";
import { AppError } from "../../utils/AppError.js";
import type { ActorType, RequestActor } from "../../types/activity.js";
import { attachLabels } from "../labelService.js";
import { runMutation } from "../mutationRunner.js";
import { getAccessibleTask } from "./access.js";
import { taskEvent } from "./events.js";
import { formatTask } from "./format.js";

export const DEFAULT_CLAIM_TTL_SECONDS = 1800;
export const MIN_CLAIM_TTL_SECONDS = 30;
export const MAX_CLAIM_TTL_SECONDS = 86400;

export interface TaskClaim {
  taskId: string;
  userId: string;
  actorType: ActorType;
  credentialId: string;
  label: string;
  claimedAt: string;
  expiresAt: string;
}

export interface ClaimTaskOptions {
  ttlSeconds?: number;
  force?: boolean;
  now?: Date;
}

export interface ReleaseTaskClaimOptions {
  force?: boolean;
  now?: Date;
}

const CLAIM_KEY_PREFIX = "task:claim:";

// Atomic check-and-set in Redis: succeeds if unclaimed, expired, forced, or already held by the same credential.
const CLAIM_LUA = `
local current = redis.call('GET', KEYS[1])
local nowMs = tonumber(ARGV[1])
local ttlMs = tonumber(ARGV[2])
local credentialId = ARGV[3]
local actorType = ARGV[4]
local force = ARGV[5] == '1'
local nextJson = ARGV[6]

if current then
  local ok, parsed = pcall(cjson.decode, current)
  if ok and type(parsed) == 'table' then
    local expiresMs = tonumber(parsed.expiresAtMs) or 0
    local sameHolder = parsed.credentialId == credentialId and parsed.actorType == actorType
    if expiresMs > nowMs and not force and not sameHolder then
      return { 0, current }
    end
  end
end

redis.call('SET', KEYS[1], nextJson, 'PX', ttlMs)
return { 1, nextJson }
`;

const RELEASE_LUA = `
local current = redis.call('GET', KEYS[1])
if not current then
  return { 1, '' }
end
local nowMs = tonumber(ARGV[1])
local credentialId = ARGV[2]
local actorType = ARGV[3]
local force = ARGV[4] == '1'

local ok, parsed = pcall(cjson.decode, current)
if ok and type(parsed) == 'table' then
  local expiresMs = tonumber(parsed.expiresAtMs) or 0
  local sameHolder = parsed.credentialId == credentialId and parsed.actorType == actorType
  if expiresMs > nowMs and not force and not sameHolder then
    return { 0, current }
  end
end

redis.call('DEL', KEYS[1])
return { 1, current }
`;

interface StoredClaim extends TaskClaim {
  expiresAtMs: number;
}

function claimKey(taskId: string): string {
  return `${CLAIM_KEY_PREFIX}${taskId}`;
}

function resolveCallerActor(userId: string): RequestActor | { type: "session"; credentialId: string; label: string } {
  const actor = currentActor();
  if (actor) return actor;
  return { type: "session", credentialId: userId, label: "Browser session" };
}

function toPublicClaim(stored: StoredClaim): TaskClaim {
  return {
    taskId: stored.taskId,
    userId: stored.userId,
    actorType: stored.actorType,
    credentialId: stored.credentialId,
    label: stored.label,
    claimedAt: stored.claimedAt,
    expiresAt: stored.expiresAt,
  };
}

function conflictError(raw: string): AppError {
  const existing = toPublicClaim(JSON.parse(raw) as StoredClaim);
  return new AppError({
    code: "TASK_CLAIMED",
    message: `Task is currently claimed by ${existing.label} until ${existing.expiresAt}. Wait for expiry or pass force: true to recover.`,
    statusCode: 409,
    details: [{ claim: existing }],
  });
}

export async function getTaskClaim(taskId: string, userId: string, now = new Date()): Promise<TaskClaim | null> {
  await getAccessibleTask(taskId, userId);
  const raw = await redisClient.get(claimKey(taskId));
  if (!raw) return null;
  const parsed = JSON.parse(raw) as StoredClaim;
  if (parsed.expiresAtMs <= now.getTime()) return null;
  return toPublicClaim(parsed);
}

export async function claimTask(taskId: string, userId: string, options: ClaimTaskOptions = {}): Promise<TaskClaim> {
  const ttlSeconds = options.ttlSeconds ?? DEFAULT_CLAIM_TTL_SECONDS;
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < MIN_CLAIM_TTL_SECONDS || ttlSeconds > MAX_CLAIM_TTL_SECONDS) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: `Claim TTL must be between ${MIN_CLAIM_TTL_SECONDS} and ${MAX_CLAIM_TTL_SECONDS} seconds`,
      statusCode: 400,
    });
  }

  const task = await getAccessibleTask(taskId, userId);
  const actor = resolveCallerActor(userId);
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const ttlMs = ttlSeconds * 1000;
  const expiresAtMs = nowMs + ttlMs;

  const stored: StoredClaim = {
    taskId,
    userId,
    actorType: actor.type,
    credentialId: actor.credentialId,
    label: actor.label,
    claimedAt: now.toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString(),
    expiresAtMs,
  };

  const [won, payload] = (await redisClient.eval(CLAIM_LUA, {
    keys: [claimKey(taskId)],
    arguments: [
      String(nowMs),
      String(ttlMs),
      actor.credentialId,
      actor.type,
      options.force ? "1" : "0",
      JSON.stringify(stored),
    ],
  })) as [number, string];

  if (won !== 1) {
    throw conflictError(payload);
  }

  const claim = toPublicClaim(stored);
  await runMutation(async (tx) => {
    const [formatted] = await attachLabels([formatTask(task)], tx.client);
    await tx.recordActivity({
      userId,
      collectionId: task.collection_id,
      entityType: "task",
      entityId: taskId,
      eventType: "task_claimed",
      afterData: { title: task.title, actorLabel: claim.label, expiresAt: claim.expiresAt },
    });
    tx.emit(taskEvent("updated", userId, formatted));
  });

  return claim;
}

export async function releaseTaskClaim(
  taskId: string,
  userId: string,
  options: ReleaseTaskClaimOptions = {},
): Promise<{ released: boolean }> {
  const task = await getAccessibleTask(taskId, userId);
  const actor = resolveCallerActor(userId);
  const now = options.now ?? new Date();

  const [ok, payload] = (await redisClient.eval(RELEASE_LUA, {
    keys: [claimKey(taskId)],
    arguments: [String(now.getTime()), actor.credentialId, actor.type, options.force ? "1" : "0"],
  })) as [number, string];

  if (ok !== 1) {
    throw conflictError(payload);
  }

  if (payload) {
    await runMutation(async (tx) => {
      const [formatted] = await attachLabels([formatTask(task)], tx.client);
      await tx.recordActivity({
        userId,
        collectionId: task.collection_id,
        entityType: "task",
        entityId: taskId,
        eventType: "task_released",
        afterData: { title: task.title, actorLabel: actor.label },
      });
      tx.emit(taskEvent("updated", userId, formatted));
    });
  }

  return { released: Boolean(payload) };
}
