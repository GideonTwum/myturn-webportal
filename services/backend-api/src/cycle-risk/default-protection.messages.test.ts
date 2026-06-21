import { describe, expect, it } from "vitest";
import {
  reserveFullCoverNotificationBody,
  reservePartialCoverNotificationBody,
} from "./default-protection.messages";

describe("default-protection messages", () => {
  it("full cover body mentions active again and continued contributions", () => {
    const body = reserveFullCoverNotificationBody("Savings Circle");
    expect(body).toContain("Savings Circle");
    expect(body).toContain("active again");
    expect(body).toContain("continue contributing on time");
    expect(body).toContain("Repeated defaults");
  });

  it("partial cover body asks to settle remaining balance", () => {
    const body = reservePartialCoverNotificationBody("Savings Circle");
    expect(body).toContain("Savings Circle");
    expect(body).toContain("settle the remaining balance");
  });
});
