import { createClient, type RedisClientType } from "redis";
import { REDIS_URL } from "../config.js";

export const redisClient: RedisClientType = createClient({ url: REDIS_URL });
export const redisPubClient: RedisClientType = createClient({ url: REDIS_URL });
export const redisSubClient: RedisClientType = createClient({ url: REDIS_URL });

export async function connectRedis(): Promise<void> {
  await redisClient.connect();
  await redisPubClient.connect();
  await redisSubClient.connect();
}
