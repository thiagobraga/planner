import { createClient, type RedisClientType } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redisClient: RedisClientType = createClient({ url: redisUrl });
export const redisPubClient: RedisClientType = createClient({ url: redisUrl });
export const redisSubClient: RedisClientType = createClient({ url: redisUrl });

export async function connectRedis(): Promise<void> {
  await redisClient.connect();
  await redisPubClient.connect();
  await redisSubClient.connect();
}
