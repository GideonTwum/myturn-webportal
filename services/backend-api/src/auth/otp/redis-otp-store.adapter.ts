import Redis from "ioredis";
import { normalizeRedisUrl } from "../../common/redis-connection.util";
import type { OtpRecord, OtpStoreAdapter } from "./otp-store.adapter";

const KEY_PREFIX = "myturn:otp:";

export class RedisOtpStoreAdapter implements OtpStoreAdapter {
  constructor(private readonly redis: Redis) {}

  private key(phoneKey: string): string {
    return `${KEY_PREFIX}${phoneKey}`;
  }

  private ttlSeconds(record: OtpRecord): number {
    const remaining = Math.ceil((record.expiresAt - Date.now()) / 1000);
    return Math.max(60, remaining);
  }

  async set(phoneKey: string, record: OtpRecord): Promise<void> {
    await this.redis.set(
      this.key(phoneKey),
      JSON.stringify(record),
      "EX",
      this.ttlSeconds(record),
    );
  }

  async get(phoneKey: string): Promise<OtpRecord | null> {
    const raw = await this.redis.get(this.key(phoneKey));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as OtpRecord;
    } catch {
      return null;
    }
  }

  async delete(phoneKey: string): Promise<void> {
    await this.redis.del(this.key(phoneKey));
  }
}

export function createRedisClient(url: string): Redis {
  return new Redis(normalizeRedisUrl(url), {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    connectTimeout: 10_000,
  });
}
