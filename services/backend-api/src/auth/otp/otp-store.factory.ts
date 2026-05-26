import { Logger } from "@nestjs/common";
import { InMemoryOtpStoreAdapter, type OtpStoreAdapter } from "./otp-store.adapter";
import { createRedisClient, RedisOtpStoreAdapter } from "./redis-otp-store.adapter";

export type OtpStoreKind = "memory" | "redis";

export { pingRedis } from "../../common/redis-connection.util";

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
