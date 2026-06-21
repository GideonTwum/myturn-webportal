import { describe, expect, it } from "vitest";
import {
  missedContributionMinor,
  selectPayoutRecipient,
  type PayoutQueueMember,
} from "./payout-recipient";

function m(
  userId: string,
  turnOrder: number,
  effectivePayoutOrder: number,
  cycleStanding: PayoutQueueMember["cycleStanding"] = "ACTIVE",
): PayoutQueueMember {
  return { userId, turnOrder, effectivePayoutOrder, cycleStanding };
}

describe("selectPayoutRecipient", () => {
  const members = [
    m("u1", 1, 1),
    m("u2", 2, 2),
    m("u3", 3, 3),
    m("u4", 4, 4),
    m("u5", 5, 5),
  ];

  it("selects member by cycle rotation on effective order", () => {
    expect(selectPayoutRecipient(members, 1).recipient?.userId).toBe("u1");
    expect(selectPayoutRecipient(members, 3).recipient?.userId).toBe("u3");
  });

  it("skips DEFAULTED member and picks next eligible", () => {
    const withDefault = [
      m("u1", 1, 1, "DEFAULTED"),
      m("u2", 2, 2),
      m("u3", 3, 3),
    ];
    const sel = selectPayoutRecipient(withDefault, 1);
    expect(sel.recipient?.userId).toBe("u2");
    expect(sel.skippedDefaulted).toHaveLength(1);
    expect(sel.nominalRecipient?.userId).toBe("u1");
  });

  it("returns null when all members are DEFAULTED", () => {
    const allDefault = members.map((x) => ({ ...x, cycleStanding: "DEFAULTED" as const }));
    expect(selectPayoutRecipient(allDefault, 2).recipient).toBeNull();
  });

  it("honors allowOverride", () => {
    const withDefault = [m("u1", 1, 1, "DEFAULTED"), m("u2", 2, 2)];
    expect(
      selectPayoutRecipient(withDefault, 1, { allowOverride: true }).recipient?.userId,
    ).toBe("u1");
  });

  it("uses effectivePayoutOrder when member was dequeued to end", () => {
    const reordered = [
      m("u1", 1, 1),
      m("u2", 2, 6, "DEFAULTED"),
      m("u3", 3, 3),
      m("u4", 4, 4),
      m("u5", 5, 5),
    ];
    expect(selectPayoutRecipient(reordered, 2).recipient?.userId).toBe("u3");
  });
});

describe("missedContributionMinor", () => {
  it("returns full amount when nothing paid", () => {
    expect(missedContributionMinor(100_000n, 10, 0)).toBe(100_000n);
  });

  it("returns proportional unpaid portion", () => {
    expect(missedContributionMinor(100_000n, 10, 7)).toBe(30_000n);
  });

  it("returns 0 when fully paid", () => {
    expect(missedContributionMinor(100_000n, 10, 10)).toBe(0n);
  });
});
