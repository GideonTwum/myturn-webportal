import { describe, expect, it } from "vitest";
import { formatArkeselRecipient, pingArkesel } from "./arkesel-sms.provider";

describe("formatArkeselRecipient", () => {
  it("normalizes Ghana local numbers", () => {
    expect(formatArkeselRecipient("0240000001")).toBe("233240000001");
    expect(formatArkeselRecipient("233240000001")).toBe("233240000001");
    expect(formatArkeselRecipient("240000001")).toBe("233240000001");
  });
});

describe("pingArkesel", () => {
  it("reports unconfigured without credentials", async () => {
    const prevKey = process.env.ARKESEL_API_KEY;
    const prevSender = process.env.ARKESEL_SENDER_ID;
    delete process.env.ARKESEL_API_KEY;
    delete process.env.ARKESEL_SENDER_ID;
    expect(await pingArkesel()).toBe("unconfigured");
    if (prevKey) process.env.ARKESEL_API_KEY = prevKey;
    if (prevSender) process.env.ARKESEL_SENDER_ID = prevSender;
  });
});
