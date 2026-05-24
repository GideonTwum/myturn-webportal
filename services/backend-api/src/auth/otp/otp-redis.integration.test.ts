import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Redis from "ioredis";
import { RedisOtpStoreAdapter } from "./redis-otp-store.adapter";
import { pingRedis } from "./otp-store.factory";

const REDIS_URL = process.env.REDIS_URL?.trim() ?? "redis://127.0.0.1:6379";

describe("Redis OTP store", () => {
  let redis: Redis | null = null;
  let reachable = false;

  beforeAll(async () => {
    reachable = await pingRedis(REDIS_URL);
    if (reachable) {
      redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
      await redis.connect();
    }
  });

  afterAll(async () => {
    if (redis) {
      await redis.quit();
    }
  });

  it.skipIf(!reachable)("persists OTP across adapter instances", async () => {
    const adapter1 = new RedisOtpStoreAdapter(redis!);
    const phone = `test-${Date.now()}`;
    await adapter1.set(phone, {
      code: "654321",
      expiresAt: Date.now() + 120_000,
      attempts: 0,
    });
    const adapter2 = new RedisOtpStoreAdapter(redis!);
    const got = await adapter2.get(phone);
    expect(got?.code).toBe("654321");
    await adapter1.delete(phone);
  });
});
