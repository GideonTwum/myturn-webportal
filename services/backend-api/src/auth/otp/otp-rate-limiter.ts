import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import Redis from "ioredis";
import { createRedisClient } from "./redis-otp-store.adapter";

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSec: number };

/**
 * OTP request + verify throttling. Uses Redis when REDIS_URL is set, else in-memory.
 */
@Injectable()
export class OtpRateLimiter {
  private readonly logger = new Logger(OtpRateLimiter.name);
  private readonly memory = new Map<string, { count: number; resetAt: number }>();
  private redis: Redis | null = null;

  private readonly requestLimit = Number(process.env.OTP_REQUEST_LIMIT ?? 5);
  private readonly requestWindowSec = Number(process.env.OTP_REQUEST_WINDOW_SEC ?? 900);
  private readonly resendCooldownSec = Number(process.env.OTP_RESEND_COOLDOWN_SEC ?? 60);
  private readonly verifyLimit = Number(process.env.OTP_VERIFY_LIMIT ?? 10);
  private readonly verifyWindowSec = Number(process.env.OTP_VERIFY_WINDOW_SEC ?? 900);

  constructor() {
    const url = process.env.REDIS_URL?.trim();
    if (url) {
      this.redis = createRedisClient(url);
      this.logger.log("OTP rate limits: Redis-backed");
    } else {
      this.logger.warn("OTP rate limits: in-memory");
    }
  }

  async assertCanRequestOtp(phoneKey: string): Promise<void> {
    const resend = await this.checkCooldown(`resend:${phoneKey}`, this.resendCooldownSec);
    if (!resend.allowed) {
      throw new HttpException(
        `Wait ${resend.retryAfterSec}s before requesting another code`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const window = await this.consume(`req:${phoneKey}`, this.requestLimit, this.requestWindowSec);
    if (!window.allowed) {
      throw new HttpException(
        "Too many OTP requests. Try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.setCooldown(`resend:${phoneKey}`, this.resendCooldownSec);
  }

  async assertCanVerify(phoneKey: string): Promise<void> {
    const window = await this.consume(
      `verify:${phoneKey}`,
      this.verifyLimit,
      this.verifyWindowSec,
    );
    if (!window.allowed) {
      throw new HttpException(
        "Too many verification attempts. Try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async checkCooldown(
    key: string,
    ttlSec: number,
  ): Promise<RateLimitResult> {
    if (this.redis) {
      const exists = await this.redis.exists(`myturn:otp:rl:${key}`);
      if (exists) {
        const ttl = await this.redis.ttl(`myturn:otp:rl:${key}`);
        return { allowed: false, retryAfterSec: Math.max(1, ttl) };
      }
      return { allowed: true };
    }
    const entry = this.memory.get(key);
    if (entry && entry.resetAt > Date.now()) {
      return {
        allowed: false,
        retryAfterSec: Math.ceil((entry.resetAt - Date.now()) / 1000),
      };
    }
    return { allowed: true };
  }

  private async setCooldown(key: string, ttlSec: number): Promise<void> {
    if (this.redis) {
      await this.redis.set(`myturn:otp:rl:${key}`, "1", "EX", ttlSec);
      return;
    }
    this.memory.set(key, { count: 1, resetAt: Date.now() + ttlSec * 1000 });
  }

  private async consume(
    key: string,
    limit: number,
    windowSec: number,
  ): Promise<RateLimitResult> {
    if (this.redis) {
      const rk = `myturn:otp:rl:${key}`;
      const count = await this.redis.incr(rk);
      if (count === 1) await this.redis.expire(rk, windowSec);
      if (count > limit) {
        const ttl = await this.redis.ttl(rk);
        return { allowed: false, retryAfterSec: Math.max(1, ttl) };
      }
      return { allowed: true };
    }
    const now = Date.now();
    const entry = this.memory.get(key);
    if (!entry || entry.resetAt <= now) {
      this.memory.set(key, { count: 1, resetAt: now + windowSec * 1000 });
      return { allowed: true };
    }
    entry.count += 1;
    if (entry.count > limit) {
      return {
        allowed: false,
        retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
      };
    }
    return { allowed: true };
  }
}
