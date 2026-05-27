import { describe, expect, it } from "vitest";
import {
  formatArkeselRecipient,
  parseArkeselSendSuccess,
  pingArkesel,
} from "./arkesel-sms.provider";

describe("formatArkeselRecipient", () => {
  it("normalizes Ghana local numbers", () => {
    expect(formatArkeselRecipient("0240000001")).toBe("233240000001");
    expect(formatArkeselRecipient("233240000001")).toBe("233240000001");
    expect(formatArkeselRecipient("240000001")).toBe("233240000001");
  });
});

describe("parseArkeselSendSuccess", () => {
  it("accepts success with matching recipient id", () => {
    const r = parseArkeselSendSuccess(
      {
        status: "success",
        data: [{ recipient: "233240000001", id: "abc-123" }],
      },
      "233240000001",
    );
    expect(r.providerRef).toBe("abc-123");
  });

  it("rejects invalid numbers in data", () => {
    expect(() =>
      parseArkeselSendSuccess(
        {
          status: "success",
          data: [{ "invalid numbers": ["233999999999"] }],
        },
        "233240000001",
      ),
    ).toThrow(/rejected recipient/);
  });

  it("rejects non-success status", () => {
    expect(() =>
      parseArkeselSendSuccess(
        { status: "failed", message: "Insufficient balance" },
        "233240000001",
      ),
    ).toThrow(/Insufficient balance/);
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
