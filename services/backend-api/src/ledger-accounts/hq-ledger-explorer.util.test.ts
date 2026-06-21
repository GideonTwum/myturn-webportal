import { describe, expect, it } from "vitest";
import {
  parseExplorerLimit,
  sanitizeLedgerMetadata,
} from "./hq-ledger-explorer.util";

describe("hq-ledger-explorer.util", () => {
  it("caps pagination limit at 200", () => {
    expect(parseExplorerLimit()).toBe(50);
    expect(parseExplorerLimit("25")).toBe(25);
    expect(parseExplorerLimit("500")).toBe(200);
    expect(parseExplorerLimit("0")).toBe(50);
  });

  it("sanitizes sensitive metadata keys", () => {
    const sanitized = sanitizeLedgerMetadata({
      groupId: "g1",
      providerRef: "abc",
      apiKey: "secret-value",
      nested: { subscriptionKey: "hide-me", amount: "10.00" },
    }) as Record<string, unknown>;

    expect(sanitized.groupId).toBe("g1");
    expect(sanitized.apiKey).toBe("[REDACTED]");
    expect((sanitized.nested as Record<string, unknown>).subscriptionKey).toBe(
      "[REDACTED]",
    );
    expect((sanitized.nested as Record<string, unknown>).amount).toBe("10.00");
  });
});
