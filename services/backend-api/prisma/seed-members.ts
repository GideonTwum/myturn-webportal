/**
 * Staging-only: bulk-add USER accounts and GroupMember rows for load testing.
 *
 * Contribution.expectedDayCount / paidDayCount are defined at group activation
 * (see GroupsService.activate), not on GroupMember.
 *
 * Usage:
 *   DATABASE_URL=... npm run seed:members
 *
 * Optional env:
 *   SEED_INVITE_CODE=MT-SNOU   (default: MT-SNOU)
 *   SEED_MEMBER_COUNT=99       (default: 99)
 *   SEED_ALLOW_NON_DRAFT=1     allow joining when group status !== DRAFT
 */
import {
  DepositStatus,
  GroupMemberStatus,
  GroupStatus,
  LedgerAccountType,
  PaymentStatus,
  PaymentType,
  PayoutMode,
  Prisma,
  PrismaClient,
  UserRole,
} from "@prisma/client";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

const PLATFORM_MAX_GROUP_SIZE = 250;

function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function ghanaStylePhone(index: number): string {
  return `024${String(index).padStart(7, "0")}`;
}

function depositRequiredAmount(group: {
  payoutMode: PayoutMode;
  contributionAmount: Prisma.Decimal;
  daysPerCycle: number;
}): Prisma.Decimal {
  if (group.payoutMode !== PayoutMode.CYCLE) {
    return new Prisma.Decimal(0);
  }
  return new Prisma.Decimal(group.contributionAmount.toString()).mul(
    group.daysPerCycle,
  );
}

async function getOrCreateLedgerAccount(
  tx: Prisma.TransactionClient,
  accountKey: string,
  accountType: LedgerAccountType,
  userId?: string,
) {
  const existing = await tx.ledgerAccount.findUnique({ where: { accountKey } });
  if (existing) return existing;
  return tx.ledgerAccount.create({
    data: {
      accountKey,
      accountType,
      userId: userId ?? null,
      currency: "GHS",
      balance: 0,
    },
  });
}

async function postTransferInTx(
  tx: Prisma.TransactionClient,
  params: {
    idempotencyKey: string;
    referenceType: string;
    referenceId: string;
    description: string;
    fromAccountId: string;
    toAccountId: string;
    amount: Prisma.Decimal;
  },
) {
  const neg = params.amount.mul(-1);
  const transaction = await tx.ledgerTransaction.create({
    data: {
      idempotencyKey: params.idempotencyKey,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      description: params.description,
    },
  });
  for (const [accountId, delta] of [
    [params.fromAccountId, neg],
    [params.toAccountId, params.amount],
  ] as const) {
    const account = await tx.ledgerAccount.findUniqueOrThrow({
      where: { id: accountId },
    });
    const nextBalance = new Prisma.Decimal(account.balance.toString()).add(delta);
    await tx.ledgerAccount.update({
      where: { id: account.id },
      data: { balance: nextBalance },
    });
    await tx.ledgerLine.create({
      data: {
        transactionId: transaction.id,
        accountId: account.id,
        delta,
        balanceAfter: nextBalance,
      },
    });
  }
}

async function applyDepositOnJoin(
  tx: Prisma.TransactionClient,
  params: {
    userId: string;
    groupId: string;
    memberId: string;
    groupName: string;
    group: {
      contributionAmount: Prisma.Decimal;
      daysPerCycle: number;
      payoutMode: PayoutMode;
    };
  },
): Promise<{ depositAmount: Prisma.Decimal; depositStatus: DepositStatus }> {
  const amount = depositRequiredAmount(params.group);
  if (params.group.payoutMode !== PayoutMode.CYCLE || amount.lte(0)) {
    return {
      depositAmount: new Prisma.Decimal(0),
      depositStatus: DepositStatus.NOT_REQUIRED,
    };
  }

  const pay = await tx.payment.create({
    data: {
      userId: params.userId,
      groupId: params.groupId,
      amount,
      type: PaymentType.DEPOSIT,
      status: PaymentStatus.COMPLETED,
      externalRef: `seed_deposit_${params.memberId}`,
      completedAt: new Date(),
      metadata: { mockDeposit: true, groupMemberId: params.memberId, seed: true },
    },
  });

  const external = await getOrCreateLedgerAccount(
    tx,
    "SYSTEM_EXTERNAL:GHS",
    LedgerAccountType.SYSTEM_EXTERNAL,
  );
  const escrow = await getOrCreateLedgerAccount(
    tx,
    `MEMBER_DEPOSIT_ESCROW:${params.userId}:GHS`,
    LedgerAccountType.MEMBER_DEPOSIT_ESCROW,
    params.userId,
  );

  await postTransferInTx(tx, {
    idempotencyKey: `seed:deposit:hold:${pay.id}`,
    referenceType: "Deposit",
    referenceId: pay.id,
    description: `Security deposit held in escrow for ${params.groupName} (CYCLE mode)`,
    fromAccountId: external.id,
    toAccountId: escrow.id,
    amount,
  });

  return { depositAmount: amount, depositStatus: DepositStatus.HELD };
}

async function main() {
  const inviteRaw = process.env.SEED_INVITE_CODE ?? "MT-SNOU";
  const inviteCode = normalizeInviteCode(inviteRaw);
  const count = Math.max(
    0,
    parseInt(process.env.SEED_MEMBER_COUNT ?? "99", 10) || 0,
  );
  const allowNonDraft = process.env.SEED_ALLOW_NON_DRAFT === "1";

  if (count === 0) {
    console.log("SEED_MEMBER_COUNT is 0; nothing to do.");
    return;
  }

  const group = await prisma.group.findUnique({
    where: { inviteCode },
    include: {
      members: { where: { status: GroupMemberStatus.ACTIVE } },
    },
  });

  if (!group) {
    console.error(`Group not found for invite code: ${inviteCode}`);
    process.exit(1);
  }

  if (!allowNonDraft && group.status !== GroupStatus.DRAFT) {
    console.error(
      `Group ${group.id} is not DRAFT (status=${group.status}). ` +
        `Set SEED_ALLOW_NON_DRAFT=1 to override.`,
    );
    process.exit(1);
  }

  const capacityCap = Math.min(group.memberSlots, PLATFORM_MAX_GROUP_SIZE);
  let nextTurnOrder = group.members.reduce(
    (max, m) => Math.max(max, m.turnOrder),
    0,
  );

  let newUsersCreated = 0;
  let membershipsAdded = 0;
  let skippedAlreadyInGroup = 0;
  let skippedGroupFull = 0;

  const passwordHash = await bcrypt.hash(randomBytes(24).toString("base64url"), 10);
  let activeCount = group.members.length;

  for (let i = 1; i <= count; i++) {
    const email = `member${i}@myturn.local`;
    const phone = ghanaStylePhone(i);
    const firstName = "Member";
    const lastName = String(i);

    if (activeCount >= capacityCap) {
      skippedGroupFull++;
      continue;
    }

    let user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const already = await prisma.groupMember.findFirst({
        where: {
          groupId: group.id,
          userId: user.id,
          status: GroupMemberStatus.ACTIVE,
        },
      });
      if (already) {
        skippedAlreadyInGroup++;
        continue;
      }
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: UserRole.USER,
          firstName,
          lastName,
          phone,
        },
      });
      newUsersCreated++;
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { phone, firstName, lastName, role: UserRole.USER },
      });
    }

    nextTurnOrder += 1;

    await prisma.$transaction(async (tx) => {
      const m = await tx.groupMember.create({
        data: {
          groupId: group.id,
          userId: user.id,
          turnOrder: nextTurnOrder,
          effectivePayoutOrder: nextTurnOrder,
          depositAmount: 0,
          depositStatus: DepositStatus.NOT_REQUIRED,
        },
      });
      const dep = await applyDepositOnJoin(tx, {
        userId: user.id,
        groupId: group.id,
        memberId: m.id,
        groupName: group.name,
        group: {
          contributionAmount: group.contributionAmount,
          daysPerCycle: group.daysPerCycle,
          payoutMode: group.payoutMode,
        },
      });
      await tx.groupMember.update({
        where: { id: m.id },
        data: {
          depositAmount: dep.depositAmount,
          depositStatus: dep.depositStatus,
        },
      });
    });

    membershipsAdded++;
    activeCount++;
  }

  const finalMemberCount = await prisma.groupMember.count({
    where: { groupId: group.id, status: GroupMemberStatus.ACTIVE },
  });

  console.log("--- seed-members complete ---");
  console.log(`Invite code: ${inviteCode}`);
  console.log(`New users created: ${newUsersCreated}`);
  console.log(`Group memberships added this run: ${membershipsAdded}`);
  console.log(`Skipped (already in group): ${skippedAlreadyInGroup}`);
  console.log(`Skipped (group at capacity cap): ${skippedGroupFull}`);
  console.log(`Active group member count now: ${finalMemberCount}`);
  console.log(
    `Note: expectedDayCount/paidDayCount on contributions are created when the group is activated (cycle 1).`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
