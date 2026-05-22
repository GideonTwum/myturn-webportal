import { Injectable, Logger } from "@nestjs/common";
import Redis from "ioredis";
import { createRedisClient } from "../../auth/otp/redis-otp-store.adapter";

const PREFIX = "myturn:idempotency:";

/**
 * Prevents duplicate side effects for payments/webhooks (memory or Redis).
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly memory = new Map<string, { result: string; expiresAt: number }>();
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
    if (this.redis) {
      const existing = await this.redis.get(fullKey);
      if (existing) {
        return { duplicate: true, value: JSON.parse(existing) as T };
      }
      const value = await fn();
      await this.redis.set(fullKey, JSON.stringify(value), "EX", ttlSec);
      return { duplicate: false, value };
    }

    const now = Date.now();
    const hit = this.memory.get(fullKey);
    if (hit && hit.expiresAt > now) {
      return { duplicate: true, value: JSON.parse(hit.result) as T };
    }
    const value = await fn();
    this.memory.set(fullKey, {
      result: JSON.stringify(value),
      expiresAt: now + ttlSec * 1000,
    });
    return { duplicate: false, value };
  }
}
