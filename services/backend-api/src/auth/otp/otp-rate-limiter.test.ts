import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HttpException } from "@nestjs/common";
import { OtpRateLimiter } from "./otp-rate-limiter";

describe("OtpRateLimiter (memory)", () => {
  const prevRedis = process.env.REDIS_URL;
  const prevCooldown = process.env.OTP_RESEND_COOLDOWN_SEC;

  beforeEach(() => {
    delete process.env.REDIS_URL;
    process.env.OTP_RESEND_COOLDOWN_SEC = "2";
  });

  afterEach(() => {
    if (prevRedis) process.env.REDIS_URL = prevRedis;
    else delete process.env.REDIS_URL;
    if (prevCooldown) process.env.OTP_RESEND_COOLDOWN_SEC = prevCooldown;
    else delete process.env.OTP_RESEND_COOLDOWN_SEC;
  });

  it("allows first OTP request", async () => {
    const limiter = new OtpRateLimiter();
    await expect(limiter.assertCanRequestOtp("240000001")).resolves.toBeUndefined();
  });

  it("enforces resend cooldown", async () => {
    const limiter = new OtpRateLimiter();
    await limiter.assertCanRequestOtp("240000003");
    await expect(limiter.assertCanRequestOtp("240000003")).rejects.toThrow(
      HttpException,
    );
  });

  it("allows verify attempts within window", async () => {
    const limiter = new OtpRateLimiter();
    await expect(limiter.assertCanVerify("240000004")).resolves.toBeUndefined();
  });
});
