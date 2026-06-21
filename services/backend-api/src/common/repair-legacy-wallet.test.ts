import { describe, expect, it } from "vitest";
import { planLegacyWalletRepair } from "../../scripts/repair-legacy-wallet-staging.lib";

describe("planLegacyWalletRepair", () => {
  it("plans locked balance migration", () => {
    const actions = planLegacyWalletRepair({
      userId: "u1",
      balance: "0.00",
      lockedBalance: "5300.00",
    });
    expect(actions.some((a) => a.kind === "migrate_locked")).toBe(true);
  });

  it("plans available balance migration", () => {
    const actions = planLegacyWalletRepair({
      userId: "u2",
      balance: "100.00",
      lockedBalance: "0.00",
    });
    expect(actions.some((a) => a.kind === "migrate_balance")).toBe(true);
  });

  it("skips zero rows", () => {
    const actions = planLegacyWalletRepair({
      userId: "u3",
      balance: "0.00",
      lockedBalance: "0.00",
    });
    expect(actions[0]?.kind).toBe("skip");
  });
});
