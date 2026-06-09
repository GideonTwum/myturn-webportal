import { afterEach, describe, expect, it } from "vitest";
import {
  collectProductionSafetyErrors,
  getDeploymentTier,
} from "./platform-env";

describe("platform-env production safety", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it("allows mock providers in staging", () => {
    process.env.DEPLOYMENT_TIER = "staging";
    process.env.PAYMENT_PROVIDER = "mock";
    process.env.DISBURSEMENT_PROVIDER = "mock";
    process.env.SMS_PROVIDER = "console";
    expect(collectProductionSafetyErrors()).toEqual([]);
  });

  it("rejects mock payment and disbursement in production", () => {
    process.env.DEPLOYMENT_TIER = "production";
    process.env.DATABASE_URL = "postgresql://u:p@localhost/db";
    process.env.JWT_SECRET = "a".repeat(40);
    process.env.CORS_ORIGIN = "https://app.example.com";
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.SMS_PROVIDER = "arkesel";
    process.env.ARKESEL_API_KEY = "key";
    process.env.ARKESEL_SENDER_ID = "MyTurn";
    process.env.PAYMENT_PROVIDER = "mock";
    process.env.DISBURSEMENT_PROVIDER = "mock";
    process.env.WEBHOOK_SECRET = "whsec";
    process.env.STAGING_RELAX_TRUST = "false";

    const errors = collectProductionSafetyErrors();
    expect(errors.some((e) => e.includes("PAYMENT_PROVIDER"))).toBe(true);
    expect(errors.some((e) => e.includes("DISBURSEMENT_PROVIDER"))).toBe(true);
  });

  it("requires MTN and Arkesel credentials in production", () => {
    process.env.DEPLOYMENT_TIER = "production";
    process.env.DATABASE_URL = "postgresql://u:p@localhost/db";
    process.env.JWT_SECRET = "a".repeat(40);
    process.env.CORS_ORIGIN = "https://app.example.com";
    process.env.REDIS_URL = "redis://localhost:6379";
    process.env.SMS_PROVIDER = "arkesel";
    process.env.PAYMENT_PROVIDER = "mtn-momo";
    process.env.DISBURSEMENT_PROVIDER = "mtn-momo";
    process.env.STAGING_RELAX_TRUST = "false";

    const errors = collectProductionSafetyErrors();
    expect(errors.some((e) => e.includes("Arkesel"))).toBe(true);
    expect(errors.some((e) => e.includes("MTN collection"))).toBe(true);
    expect(errors.some((e) => e.includes("MTN disbursement"))).toBe(true);
    expect(errors.some((e) => e.includes("WEBHOOK_SECRET"))).toBe(true);
  });

  it("resolves deployment tier from explicit env", () => {
    process.env.DEPLOYMENT_TIER = "production";
    expect(getDeploymentTier()).toBe("production");
  });
});
