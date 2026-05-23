import { createHash } from "crypto";
import { Injectable, Logger } from "@nestjs/common";
import Redis from "ioredis";
import { createRedisClient } from "../../auth/otp/redis-otp-store.adapter";

const PREFIX = "myturn:idempotency:";
const LOCK_PREFIX = "myturn:idempotency:lock:";

export function hashIdempotencyPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly memory = new Map<
    string,
    { result: string; expiresAt: number; inFlight?: boolean }
  >();
  private redis: Redis | null = null;

  constructor() {
    const url = process.env.REDIS_URL?.trim();
    if (url) {
      this.redis = createRedisClient(url);
      this.logger.log("Idempotency: Redis-backed");
    }
  }

  async runOnce<T>(
    key: string,
    ttlSec: number,
    fn: () => Promise<T>,
  ): Promise<{ duplicate: false; value: T } | { duplicate: true; value: T }> {
    const fullKey = `${PREFIX}${key}`;
    const lockKey = `${LOCK_PREFIX}${key}`;

    if (this.redis) {
      const locked = await this.redis.set(lockKey, "1", "EX", 30, "NX");
      if (!locked) {
        await this.sleep(50);
        const existing = await this.redis.get(fullKey);
        if (existing) {
          return { duplicate: true, value: JSON.parse(existing) as T };
        }
      }
      try {
        const existing = await this.redis.get(fullKey);
        if (existing) {
          return { duplicate: true, value: JSON.parse(existing) as T };
        }
        const value = await fn();
        await this.redis.set(fullKey, JSON.stringify(value), "EX", ttlSec);
        return { duplicate: false, value };
      } finally {
        await this.redis.del(lockKey);
      }
    }

    const now = Date.now();
    const hit = this.memory.get(fullKey);
    if (hit?.inFlight) {
      await this.sleep(50);
    }
    if (hit && hit.expiresAt > now && hit.result) {
      return { duplicate: true, value: JSON.parse(hit.result) as T };
    }
    this.memory.set(fullKey, {
      result: "",
      expiresAt: now + ttlSec * 1000,
      inFlight: true,
    });
    const value = await fn();
    this.memory.set(fullKey, {
      result: JSON.stringify(value),
      expiresAt: now + ttlSec * 1000,
      inFlight: false,
    });
    return { duplicate: false, value };
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }
}
