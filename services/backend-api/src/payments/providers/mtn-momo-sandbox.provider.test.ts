import { describe, expect, it } from "vitest";
import {
  formatMtnPartyId,
  resolveMtnCallbackUrl,
} from "./mtn-momo-sandbox.provider";

describe("formatMtnPartyId", () => {
  it("normalizes Ghana numbers to 233 MSISDN", () => {
    expect(formatMtnPartyId("0240000001")).toBe("233240000001");
    expect(formatMtnPartyId("233240000001")).toBe("233240000001");
  });
});

describe("resolveMtnCallbackUrl", () => {
  it("includes /api/webhooks/mtn", () => {
    const prev = process.env.MTN_MOMO_CALLBACK_HOST;
    process.env.MTN_MOMO_CALLBACK_HOST =
      "https://myturn-webportal-staging.up.railway.app";
    expect(resolveMtnCallbackUrl()).toBe(
      "https://myturn-webportal-staging.up.railway.app/api/webhooks/mtn",
    );
    if (prev) process.env.MTN_MOMO_CALLBACK_HOST = prev;
    else delete process.env.MTN_MOMO_CALLBACK_HOST;
  });
});
