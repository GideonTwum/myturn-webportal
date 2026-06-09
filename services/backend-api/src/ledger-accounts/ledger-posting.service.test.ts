import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { LedgerAccountType, Prisma } from "@prisma/client";
import { LedgerPostingService } from "./ledger-posting.service";

function makeAccount(id: string, balance: string, type: LedgerAccountType = LedgerAccountType.GROUP_POOL) {
  return {
    id,
    accountKey: `TEST:${id}`,
    accountType: type,
    balance: new Prisma.Decimal(balance),
    currency: "GHS",
  };
}

function makeTx(accounts: Map<string, ReturnType<typeof makeAccount>>) {
  const transactions = new Map<string, unknown>();
  const lines: unknown[] = [];

  return {
    ledgerTransaction: {
      findUnique: vi.fn(async ({ where }: { where: { idempotencyKey: string } }) =>
        transactions.get(where.idempotencyKey) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: "tx-1", ...data, lines: [] };
        transactions.set(data.idempotencyKey as string, row);
        return row;
      }),
    },
    ledgerAccount: {
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const acct = accounts.get(where.id);
        if (!acct) throw new Error("missing");
        return acct;
      }),
      update: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { balance: Prisma.Decimal };
        }) => {
          const acct = accounts.get(where.id)!;
          acct.balance = data.balance;
          return acct;
        },
      ),
    },
    ledgerLine: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `line-${lines.length + 1}`, ...data };
        lines.push(row);
        return row;
      }),
    },
    _lines: lines,
    _transactions: transactions,
  };
}

describe("LedgerPostingService", () => {
  let svc: LedgerPostingService;

  beforeEach(() => {
    svc = new LedgerPostingService({} as never);
  });

  it("posts a balanced journal and updates account balances", async () => {
    const accounts = new Map([
      ["a", makeAccount("a", "100.00", LedgerAccountType.GROUP_POOL)],
      ["b", makeAccount("b", "0.00", LedgerAccountType.MEMBER_WALLET)],
    ]);
    const tx = makeTx(accounts);

    const result = await svc.postJournalInTx(tx as never, {
      idempotencyKey: "test:1",
      referenceType: "Test",
      referenceId: "ref-1",
      lines: [
        { accountId: "a", delta: new Prisma.Decimal("-25.00") },
        { accountId: "b", delta: new Prisma.Decimal("25.00") },
      ],
    });

    expect(result.duplicate).toBe(false);
    expect(accounts.get("a")!.balance.toString()).toBe("75");
    expect(accounts.get("b")!.balance.toString()).toBe("25");
    expect(tx.ledgerLine.create).toHaveBeenCalledTimes(2);
  });

  it("rejects unbalanced journals", async () => {
    const accounts = new Map([
      ["a", makeAccount("a", "100.00")],
      ["b", makeAccount("b", "0.00")],
    ]);
    const tx = makeTx(accounts);

    await expect(
      svc.postJournalInTx(tx as never, {
        idempotencyKey: "test:unbalanced",
        referenceType: "Test",
        referenceId: "ref-1",
        lines: [
          { accountId: "a", delta: new Prisma.Decimal("-25.00") },
          { accountId: "b", delta: new Prisma.Decimal("20.00") },
        ],
      }),
    ).rejects.toThrow(ConflictException);
  });

  it("returns duplicate without double-posting when idempotency key exists", async () => {
    const accounts = new Map([
      ["a", makeAccount("a", "100.00")],
      ["b", makeAccount("b", "25.00")],
    ]);
    const tx = makeTx(accounts);
    tx._transactions.set("test:dup", { id: "existing", lines: [] });

    const result = await svc.postJournalInTx(tx as never, {
      idempotencyKey: "test:dup",
      referenceType: "Test",
      referenceId: "ref-1",
      lines: [
        { accountId: "a", delta: new Prisma.Decimal("-25.00") },
        { accountId: "b", delta: new Prisma.Decimal("25.00") },
      ],
    });

    expect(result.duplicate).toBe(true);
    expect(tx.ledgerTransaction.create).not.toHaveBeenCalled();
    expect(accounts.get("a")!.balance.toString()).toBe("100");
  });

  it("allows same-account credit then debit within one balanced journal", async () => {
    const accounts = new Map([
      ["ext", makeAccount("ext", "0", LedgerAccountType.SYSTEM_EXTERNAL)],
      ["float", makeAccount("float", "0", LedgerAccountType.PLATFORM_FLOAT)],
      ["pool", makeAccount("pool", "0", LedgerAccountType.GROUP_POOL)],
    ]);
    const tx = makeTx(accounts);
    const amount = new Prisma.Decimal("100.00");

    const result = await svc.postJournalInTx(tx as never, {
      idempotencyKey: "test:contribution",
      referenceType: "Payment",
      referenceId: "pay-1",
      lines: [
        { accountId: "ext", delta: amount.mul(-1) },
        { accountId: "float", delta: amount },
        { accountId: "float", delta: amount.mul(-1) },
        { accountId: "pool", delta: amount },
      ],
    });

    expect(result.duplicate).toBe(false);
    expect(accounts.get("float")!.balance.toString()).toBe("0");
    expect(accounts.get("pool")!.balance.toString()).toBe("100");
  });

  it("rejects postings that would make internal accounts negative", async () => {
    const accounts = new Map([
      ["a", makeAccount("a", "10.00", LedgerAccountType.MEMBER_WALLET)],
      ["b", makeAccount("b", "0.00", LedgerAccountType.WITHDRAWAL_CLEARING)],
    ]);
    const tx = makeTx(accounts);

    await expect(
      svc.postJournalInTx(tx as never, {
        idempotencyKey: "test:negative",
        referenceType: "Test",
        referenceId: "ref-1",
        lines: [
          { accountId: "a", delta: new Prisma.Decimal("-15.00") },
          { accountId: "b", delta: new Prisma.Decimal("15.00") },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
