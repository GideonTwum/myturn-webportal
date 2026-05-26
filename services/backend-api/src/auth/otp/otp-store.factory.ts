import { Logger } from "@nestjs/common";
import Redis from "ioredis";
import { normalizeRedisUrl } from "../../common/redis-connection.util";
import { InMemoryOtpStoreAdapter, type OtpStoreAdapter } from "./otp-store.adapter";
import { createRedisClient, RedisOtpStoreAdapter } from "./redis-otp-store.adapter";

export type OtpStoreKind = "memory" | "redis";

export function createOtpStore(): { store: OtpStoreAdapter; kind: OtpStoreKind } {
  const logger = new Logger("OtpStoreFactory");
  const url = process.env.REDIS_URL?.trim();
  if (url) {
    const redis = createRedisClient(url);
    logger.log("OTP store: Redis");
    return { store: new RedisOtpStoreAdapter(redis), kind: "redis" };
  }
  logger.warn("OTP store: in-memory (set REDIS_URL for multi-instance)");
  return { store: new InMemoryOtpStoreAdapter(), kind: "memory" };
}

export async function pingRedis(
  url: string,
): Promise<{ ok: boolean; error?: string }> {
  const client = new Redis(normalizeRedisUrl(url), {
    maxRetriesPerRequest: 1,
    connectTimeout: 10_000,
  });
  try {
    await client.connect();
    const pong = await client.ping();
    return { ok: pong === "PONG" };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    client.disconnect();
  }
}
