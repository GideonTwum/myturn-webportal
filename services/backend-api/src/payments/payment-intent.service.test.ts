import { describe, expect, it } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { PaymentIntentService } from "./payment-intent.service";
import { PaymentIntentStatus } from "./payment-intent.types";

describe("PaymentIntentService", () => {
  const svc = new PaymentIntentService();

  it("allows CREATED → PENDING", () => {
    expect(
      svc.transitionIntent(
        PaymentIntentStatus.CREATED,
        PaymentIntentStatus.PENDING,
        { requestId: "r1" },
      ),
    ).toBe(PaymentIntentStatus.PENDING);
  });

  it("blocks invalid transitions", () => {
    expect(() =>
      svc.transitionIntent(
        PaymentIntentStatus.APPROVED,
        PaymentIntentStatus.PENDING,
        { requestId: "r1" },
      ),
    ).toThrow(BadRequestException);
  });
});
