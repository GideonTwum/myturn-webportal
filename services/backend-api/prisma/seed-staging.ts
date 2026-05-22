/**
 * Deterministic staging demo data — run after `prisma/seed.ts` (users).
 * Fixed invite codes: STAGING-DEMO (join flow), STAGING-PAY (payments).
 */
import {
  ContributionFrequency,
  ContributionStatus,
  GroupMemberStatus,
  GroupScheduleUnit,
  GroupStatus,
  GhanaCardVerificationStatus,
  MemberAuthorizationLevel,
  PayoutMode,
  Prisma,
  PrismaClient,
  UserRole,
} from "@prisma/client";
import { resolve } from "node:path";

const {
  loadPrismaEnv,
  logDatabaseUrlHost,
}: {
  loadPrismaEnv: (packageRoot?: string) => { railwayPublicLoaded: boolean };
  logDatabaseUrlHost: (prefix?: string) => void;
} = require("../load-env.cjs");

const packageRoot = resolve(__dirname, "..");
loadPrismaEnv(packageRoot);

const prisma = new PrismaClient();

export const STAGING_INVITE_DEMO = "STAGING-DEMO";
export const STAGING_INVITE_PAY = "STAGING-PAY";

async function requireUser(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(
      `[seed:staging] Missing user ${email}. Run \`npm run db:seed\` first.`,
    );
  }
  return user;
}

async function upsertDemoGroup(params: {
  inviteCode: string;
  name: string;
  adminId: string;
  status: GroupStatus;
  memberUserIds: string[];
}) {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 7);
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);

  const group = await prisma.group.upsert({
    where: { inviteCode: params.inviteCode },
    create: {
      inviteCode: params.inviteCode,
      name: params.name,
      description: "Deterministic staging demo — safe to reset",
      adminId: params.adminId,
      contributionAmount: new Prisma.Decimal("50.00"),
      daysPerCycle: 1,
      payoutMode: PayoutMode.DAILY,
      frequency: ContributionFrequency.MONTHLY,
      memberSlots: 5,
      serviceMarginBps: 1000,
      scheduleFrequencyValue: 1,
      scheduleFrequencyUnit: GroupScheduleUnit.MONTH,
      groupStartDate: start,
      groupEndDate: end,
      status: params.status,
      currentCycle: params.status === GroupStatus.ACTIVE ? 1 : 0,
    },
    update: {
      name: params.name,
      status: params.status,
      currentCycle: params.status === GroupStatus.ACTIVE ? 1 : 0,
    },
  });

  for (let i = 0; i < params.memberUserIds.length; i++) {
    const userId = params.memberUserIds[i];
    await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId } },
      create: {
        groupId: group.id,
        userId,
        turnOrder: i + 1,
        status: GroupMemberStatus.ACTIVE,
      },
      update: { status: GroupMemberStatus.ACTIVE, turnOrder: i + 1 },
    });
  }

  return group;
}

async function seedContributions(
  groupId: string,
  memberUserIds: string[],
  paidUserId?: string,
) {
  for (const userId of memberUserIds) {
    const existing = await prisma.contribution.findFirst({
      where: { groupId, userId, cycleNumber: 1 },
    });
    const isPaid = userId === paidUserId;
    const data = {
      groupId,
      userId,
      cycleNumber: 1,
      amount: new Prisma.Decimal("50.00"),
      expectedDayCount: 1,
      paidDayCount: isPaid ? 1 : 0,
      status: isPaid ? ContributionStatus.PAID : ContributionStatus.PENDING,
      paidAt: isPaid ? new Date() : null,
    };
    if (existing) {
      await prisma.contribution.update({ where: { id: existing.id }, data });
    } else {
      await prisma.contribution.create({ data });
    }
  }
}

async function seedNotifications(userId: string, groupName: string) {
  const samples = [
    {
      title: "Welcome to MyTurn staging",
      body: `You are connected to ${groupName}. Payments are simulated.`,
      type: "STAGING_WELCOME",
    },
    {
      title: "Contribution reminder",
      body: "Your cycle 1 contribution is due. Pay via MoMo (staging mock).",
      type: "CONTRIBUTION_DUE",
    },
  ];
  for (const s of samples) {
    const exists = await prisma.notification.findFirst({
      where: { userId, type: s.type },
    });
    if (!exists) {
      await prisma.notification.create({
        data: { userId, ...s, metadata: { staging: true } },
      });
    }
  }
}

async function ensureVerifiedMembers() {
  await prisma.user.updateMany({
    where: {
      email: {
        in: [
          "member@myturn.local",
          "member2@myturn.local",
          "member3@myturn.local",
        ],
      },
    },
    data: {
      memberAuthorizationLevel: MemberAuthorizationLevel.VERIFIED_MEMBER,
      ghanaCardVerificationStatus: GhanaCardVerificationStatus.VERIFIED,
      trustScore: 80,
    },
  });
}

async function main() {
  console.log("[seed:staging] MyTurn deterministic staging ecosystem");
  logDatabaseUrlHost("[seed:staging]");

  await ensureVerifiedMembers();

  const admin = await requireUser("admin@myturn.local");
  const member1 = await requireUser("member@myturn.local");
  const member2 = await requireUser("member2@myturn.local");
  const member3 = await requireUser("member3@myturn.local");

  const demoGroup = await upsertDemoGroup({
    inviteCode: STAGING_INVITE_DEMO,
    name: "Staging Demo Circle",
    adminId: admin.id,
    status: GroupStatus.DRAFT,
    memberUserIds: [member1.id, member2.id],
  });

  const payGroup = await upsertDemoGroup({
    inviteCode: STAGING_INVITE_PAY,
    name: "Staging Payments Lab",
    adminId: admin.id,
    status: GroupStatus.ACTIVE,
    memberUserIds: [member1.id, member2.id, member3.id],
  });

  // All cycle-1 contributions PENDING so member1 (0240000001) can test MoMo pay flow
  await seedContributions(payGroup.id, [member1.id, member2.id, member3.id]);
  await seedNotifications(member1.id, payGroup.name);

  console.log("[seed:staging] --- demo accounts ---");
  console.log("[seed:staging] HQ:       hq@myturn.local / ChangeMe123!");
  console.log("[seed:staging] Admin:    admin@myturn.local / ChangeMe123!");
  console.log("[seed:staging] Member 1: member@myturn.local (0240000001)");
  console.log("[seed:staging] Member 2: member2@myturn.local (0240000002)");
  console.log("[seed:staging] --- invite codes (this database) ---");
  console.log(`[seed:staging] Join demo:  ${STAGING_INVITE_DEMO} (${demoGroup.name}, DRAFT, 2/5 members)`);
  console.log(
    `[seed:staging] Payments:   ${STAGING_INVITE_PAY} (${payGroup.name}, ACTIVE, cycle-1 PENDING for all)`,
  );
  console.log("[seed:staging] Mobile: OTP 0240000001 → Groups → Staging Payments Lab → Contribute via MoMo");
  console.log("[seed:staging] API should be: http://localhost:3001/api (local) or your Railway URL");
  console.log("[seed:staging] done");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("[seed:staging] failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
