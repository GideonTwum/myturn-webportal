/**
 * Local-dev cleanup: delete all data except "Big Men Group" and platform seed accounts.
 * Dry-run by default; pass --execute to apply.
 */
import { Prisma, PrismaClient, UserRole } from "@prisma/client";
import { resolve } from "node:path";

const {
  loadPrismaEnv,
  logDatabaseUrlHost,
}: {
  loadPrismaEnv: (packageRoot?: string) => void;
  logDatabaseUrlHost: (prefix?: string) => void;
} = require("../load-env.cjs");

const PRESERVE_GROUP_NAME = "Big men";
const SEED_EMAILS = ["hq@myturn.local", "admin@myturn.local"] as const;

const PLATFORM_LEDGER_TYPES = [
  "PLATFORM_FLOAT",
  "MYTURN_REVENUE",
  "WITHDRAWAL_CLEARING",
  "SYSTEM_EXTERNAL",
] as const;

const packageRoot = resolve(__dirname, "..");
process.env.MYTURN_LOCAL_DB = "1";
loadPrismaEnv(packageRoot);

const prisma = new PrismaClient();
const execute = process.argv.includes("--execute");

function assertLocalDatabaseOnly() {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    throw new Error("[cleanup] DATABASE_URL is not set.");
  }
  const host = new URL(raw.replace(/^postgres(ql)?:/i, "http:"))
    .hostname.toLowerCase();
  const allowed = host === "127.0.0.1" || host === "localhost" || host === "::1";
  if (!allowed) {
    throw new Error(
      `[cleanup] Refusing to run against non-local database (host=${host}).`,
    );
  }
}

type PreservationMap = {
  group: {
    id: string;
    name: string;
    adminId: string;
    status: string;
    currentCycle: number;
    memberSlots: number;
  };
  memberUserIds: string[];
  memberCount: number;
  preserveUserIds: Set<string>;
  preserveGroupId: string;
  otherGroupIds: string[];
  usersToDelete: string[];
  preservedLedgerAccountIds: Set<string>;
  preservedTransactionIds: Set<string>;
  counts: {
    preserve: Record<string, number>;
    delete: Record<string, number>;
  };
};

async function buildPreservationMap(): Promise<PreservationMap> {
  const matches = await prisma.group.findMany({
    where: { name: PRESERVE_GROUP_NAME },
    select: {
      id: true,
      name: true,
      adminId: true,
      status: true,
      currentCycle: true,
      memberSlots: true,
    },
  });

  if (matches.length === 0) {
    throw new Error(
      `[cleanup] Group "${PRESERVE_GROUP_NAME}" not found. Aborting.`,
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `[cleanup] Ambiguous: ${matches.length} groups named "${PRESERVE_GROUP_NAME}". Rename duplicates first.`,
    );
  }

  const group = matches[0]!;
  const members = await prisma.groupMember.findMany({
    where: { groupId: group.id },
    select: { userId: true },
  });
  const memberUserIds = members.map((m) => m.userId);

  const preserveUserIds = new Set<string>([
    group.adminId,
    ...memberUserIds,
  ]);

  const platformUsers = await prisma.user.findMany({
    where: {
      OR: [
        { role: UserRole.SUPER_ADMIN },
        { email: { in: [...SEED_EMAILS] } },
      ],
    },
    select: { id: true },
  });
  for (const u of platformUsers) {
    preserveUserIds.add(u.id);
  }

  const otherGroups = await prisma.group.findMany({
    where: { id: { not: group.id } },
    select: { id: true },
  });
  const otherGroupIds = otherGroups.map((g) => g.id);

  const allUsers = await prisma.user.findMany({ select: { id: true } });
  const usersToDelete = allUsers
    .map((u) => u.id)
    .filter((id) => !preserveUserIds.has(id));

  const preservedAccounts = await prisma.ledgerAccount.findMany({
    where: {
      OR: [
        { accountType: { in: [...PLATFORM_LEDGER_TYPES] } },
        { groupId: group.id },
        { userId: { in: [...preserveUserIds] } },
      ],
    },
    select: { id: true },
  });
  const preservedLedgerAccountIds = new Set(
    preservedAccounts.map((a) => a.id),
  );

  const linesOnPreserved = await prisma.ledgerLine.findMany({
    where: { accountId: { in: [...preservedLedgerAccountIds] } },
    select: { transactionId: true },
  });
  const preservedTransactionIds = new Set(
    linesOnPreserved.map((l) => l.transactionId),
  );

  const preserveUserIdList = [...preserveUserIds];

  const [
    contributions,
    payments,
    payouts,
    reserves,
    notifications,
    withdrawals,
    paymentRequests,
    adminEarnings,
    memberships,
    wallets,
    ledgerAccounts,
    ledgerTransactions,
    ledgerLines,
    ledgerEntries,
    auditLogs,
    adminRequests,
    deviceTokens,
    users,
    groups,
  ] = await Promise.all([
    prisma.contribution.count({ where: { groupId: group.id } }),
    prisma.payment.count({ where: { groupId: group.id } }),
    prisma.payout.count({ where: { groupId: group.id } }),
    prisma.contributionGuaranteeReserve.count({ where: { groupId: group.id } }),
    prisma.notification.count({ where: { userId: { in: preserveUserIdList } } }),
    prisma.withdrawalRequest.count({
      where: { actorId: { in: preserveUserIdList } },
    }),
    prisma.paymentRequest.count({ where: { groupId: group.id } }),
    prisma.adminEarning.count({ where: { groupId: group.id } }),
    prisma.groupMember.count({ where: { groupId: group.id } }),
    prisma.wallet.count({ where: { userId: { in: preserveUserIdList } } }),
    prisma.ledgerAccount.count({
      where: { id: { in: [...preservedLedgerAccountIds] } },
    }),
    prisma.ledgerTransaction.count({
      where: { id: { in: [...preservedTransactionIds] } },
    }),
    prisma.ledgerLine.count({
      where: { transactionId: { in: [...preservedTransactionIds] } },
    }),
    prisma.ledgerEntry.count({
      where: {
        OR: [
          { groupId: group.id },
          { userId: { in: preserveUserIdList }, groupId: null },
        ],
      },
    }),
    prisma.auditLog.count({
      where: {
        OR: [
          { actorId: { in: preserveUserIdList } },
          {
            metadata: {
              path: ["groupId"],
              equals: group.id,
            },
          },
        ],
      },
    }),
    prisma.adminRequest.count({
      where: { applicantId: { in: preserveUserIdList } },
    }),
    prisma.deviceToken.count({
      where: { userId: { in: preserveUserIdList } },
    }),
    prisma.user.count({ where: { id: { in: preserveUserIdList } } }),
    prisma.group.count({ where: { id: group.id } }),
  ]);

  const del = async (label: string, countFn: () => Promise<number>) => {
    const n = await countFn();
    return [label, n] as const;
  };

  const deleteCounts = Object.fromEntries(
    await Promise.all([
      del("groups", () =>
        prisma.group.count({ where: { id: { in: otherGroupIds } } }),
      ),
      del("memberships", () =>
        prisma.groupMember.count({ where: { groupId: { in: otherGroupIds } } }),
      ),
      del("contributions", () =>
        prisma.contribution.count({ where: { groupId: { in: otherGroupIds } } }),
      ),
      del("payments", () =>
        prisma.payment.count({
          where: {
            OR: [
              { groupId: { in: otherGroupIds } },
              { userId: { in: usersToDelete } },
            ],
          },
        }),
      ),
      del("payouts", () =>
        prisma.payout.count({ where: { groupId: { in: otherGroupIds } } }),
      ),
      del("reserves", () =>
        prisma.contributionGuaranteeReserve.count({
          where: { groupId: { in: otherGroupIds } },
        }),
      ),
      del("notifications", () =>
        prisma.notification.count({
          where: { userId: { in: usersToDelete } },
        }),
      ),
      del("withdrawals", () =>
        prisma.withdrawalRequest.count({
          where: { actorId: { in: usersToDelete } },
        }),
      ),
      del("paymentRequests", () =>
        prisma.paymentRequest.count({
          where: { groupId: { in: otherGroupIds } },
        }),
      ),
      del("adminEarnings", () =>
        prisma.adminEarning.count({
          where: {
            OR: [
              { groupId: { in: otherGroupIds } },
              { adminId: { in: usersToDelete } },
            ],
          },
        }),
      ),
      del("ledgerTransactions", () =>
        prisma.ledgerTransaction.count({
          where: { id: { notIn: [...preservedTransactionIds] } },
        }),
      ),
      del("ledgerLines", () =>
        prisma.ledgerLine.count({
          where: { transactionId: { notIn: [...preservedTransactionIds] } },
        }),
      ),
      del("ledgerAccounts", () =>
        prisma.ledgerAccount.count({
          where: { id: { notIn: [...preservedLedgerAccountIds] } },
        }),
      ),
      del("ledgerEntries", () =>
        prisma.ledgerEntry.count({
          where: {
            OR: [
              { groupId: { in: otherGroupIds } },
              { userId: { in: usersToDelete } },
            ],
          },
        }),
      ),
      del("auditLogs", () =>
        prisma.auditLog.count({
          where: {
            NOT: {
              OR: [
                { actorId: { in: preserveUserIdList } },
                {
                  metadata: {
                    path: ["groupId"],
                    equals: group.id,
                  },
                },
              ],
            },
          },
        }),
      ),
      del("adminRequests", () =>
        prisma.adminRequest.count({
          where: { applicantId: { in: usersToDelete } },
        }),
      ),
      del("deviceTokens", () =>
        prisma.deviceToken.count({
          where: { userId: { in: usersToDelete } },
        }),
      ),
      del("wallets", () =>
        prisma.wallet.count({ where: { userId: { in: usersToDelete } } }),
      ),
      del("users", () =>
        prisma.user.count({ where: { id: { in: usersToDelete } } }),
      ),
      del("reconciliationSnapshots", () =>
        prisma.reconciliationSnapshot.count(),
      ),
    ]),
  );

  return {
    group,
    memberUserIds,
    memberCount: memberUserIds.length,
    preserveUserIds,
    preserveGroupId: group.id,
    otherGroupIds,
    usersToDelete,
    preservedLedgerAccountIds,
    preservedTransactionIds,
    counts: {
      preserve: {
        groups,
        members: memberships,
        contributions,
        payments,
        payouts,
        reserves,
        notifications,
        withdrawals,
        paymentRequests,
        adminEarnings,
        wallets,
        ledgerAccounts,
        ledgerTransactions,
        ledgerLines,
        ledgerEntries,
        auditLogs,
        adminRequests,
        deviceTokens,
        users,
        settings: await prisma.setting.count(),
      },
      delete: deleteCounts,
    },
  };
}

function printSummary(map: PreservationMap) {
  console.log("\n=== PRESERVATION MAP ===");
  console.log(`Group: ${map.group.name} (${map.group.id})`);
  console.log(`  status=${map.group.status} cycle=${map.group.currentCycle} slots=${map.group.memberSlots}`);
  console.log(`  adminId=${map.group.adminId}`);
  console.log(`  memberIds (${map.memberCount}): ${map.memberUserIds.join(", ") || "(none)"}`);
  console.log(`  preservedUserIds (${map.preserveUserIds.size}): ${[...map.preserveUserIds].join(", ")}`);

  console.log("\n=== PRESERVING ===");
  for (const [k, v] of Object.entries(map.counts.preserve)) {
    console.log(`  ${k}: ${v}`);
  }

  console.log("\n=== DELETING ===");
  for (const [k, v] of Object.entries(map.counts.delete)) {
    if (v > 0) console.log(`  ${k}: ${v}`);
  }
  const totalDelete = Object.values(map.counts.delete).reduce((a, b) => a + b, 0);
  console.log(`  (total row operations: ${totalDelete})`);

  console.log("\nNote: contribution days are stored on Contribution.paidDayCount (no separate table).");
  console.log("Settings table is always preserved.");
  console.log("HQ (SUPER_ADMIN) and seed logins (hq@myturn.local, admin@myturn.local) are always preserved.");
}

async function executeCleanup(map: PreservationMap) {
  const preserveUserIdList = [...map.preserveUserIds];
  const { otherGroupIds, usersToDelete, preserveGroupId } = map;
  const preservedAccountIds = [...map.preservedLedgerAccountIds];
  const preservedTxIds = [...map.preservedTransactionIds];

  await prisma.$transaction(
    async (tx) => {
      await tx.reconciliationSnapshot.deleteMany();

      await tx.ledgerLine.deleteMany({
        where: { transactionId: { notIn: preservedTxIds } },
      });
      await tx.ledgerTransaction.deleteMany({
        where: { id: { notIn: preservedTxIds } },
      });
      await tx.ledgerAccount.deleteMany({
        where: { id: { notIn: preservedAccountIds } },
      });

      await tx.ledgerEntry.deleteMany({
        where: {
          OR: [
            { groupId: { in: otherGroupIds } },
            { userId: { in: usersToDelete } },
          ],
        },
      });

      await tx.withdrawalRequest.deleteMany({
        where: { actorId: { in: usersToDelete } },
      });

      await tx.notification.deleteMany({
        where: { userId: { in: usersToDelete } },
      });

      await tx.deviceToken.deleteMany({
        where: { userId: { in: usersToDelete } },
      });

      await tx.paymentRequest.deleteMany({
        where: { groupId: { in: otherGroupIds } },
      });

      await tx.payment.deleteMany({
        where: {
          OR: [
            { groupId: { in: otherGroupIds } },
            { userId: { in: usersToDelete } },
          ],
        },
      });

      await tx.adminEarning.deleteMany({
        where: {
          OR: [
            { groupId: { in: otherGroupIds } },
            { adminId: { in: usersToDelete } },
          ],
        },
      });

      await tx.auditLog.deleteMany({
        where: {
          NOT: {
            OR: [
              { actorId: { in: preserveUserIdList } },
              {
                metadata: {
                  path: ["groupId"],
                  equals: preserveGroupId,
                },
              },
            ],
          },
        },
      });

      await tx.adminRequest.deleteMany({
        where: { applicantId: { in: usersToDelete } },
      });

      if (otherGroupIds.length > 0) {
        await tx.group.deleteMany({
          where: { id: { in: otherGroupIds } },
        });
      }

      await tx.wallet.deleteMany({
        where: { userId: { in: usersToDelete } },
      });

      if (usersToDelete.length > 0) {
        await tx.user.deleteMany({
          where: { id: { in: usersToDelete } },
        });
      }
    },
    { timeout: 120_000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

async function main() {
  assertLocalDatabaseOnly();
  console.log(`[cleanup] MyTurn local cleanup — keep "${PRESERVE_GROUP_NAME}"`);
  logDatabaseUrlHost("[cleanup]");
  console.log(`[cleanup] mode: ${execute ? "EXECUTE" : "DRY-RUN"}`);

  const map = await buildPreservationMap();
  printSummary(map);

  if (!execute) {
    console.log("\n[cleanup] Dry-run only. Re-run with --execute to apply deletions.");
    return;
  }

  console.log("\n[cleanup] Applying deletions in a transaction...");
  await executeCleanup(map);
  console.log("[cleanup] Done.");

  const after = await buildPreservationMap();
  console.log("\n=== AFTER CLEANUP ===");
  console.log(`  groups: ${after.counts.preserve.groups}`);
  console.log(`  users: ${after.counts.preserve.users}`);
  console.log(`  other groups remaining: ${after.otherGroupIds.length}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("[cleanup] failed:", e instanceof Error ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
