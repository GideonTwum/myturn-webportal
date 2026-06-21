import { describe, expect, it } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { parseWithdrawalAmount } from "./parse-withdrawal-amount";

describe("parseWithdrawalAmount", () => {
  it("parses comma-formatted amounts", () => {
    expect(parseWithdrawalAmount("10,000").toString()).toBe("10000");
    expect(parseWithdrawalAmount("42,000.50").toString()).toBe("42000.5");
  });

  it("accepts valid decimal amounts", () => {
    expect(parseWithdrawalAmount("201.00").toString()).toBe("201");
  });

  it.each([
    ["abc"],
    [""],
    ["   "],
    ["NaN"],
    ["Infinity"],
    ["-100"],
    ["0"],
    ["0.00"],
  ])("rejects invalid amount %j with 400 message", (raw) => {
    expect(() => parseWithdrawalAmount(raw)).toThrow(BadRequestException);
    expect(() => parseWithdrawalAmount(raw)).toThrow(
      /Please enter a valid withdrawal amount/,
    );
  });
});
