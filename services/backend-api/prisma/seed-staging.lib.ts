/**
 * Idempotent staging demo seed helpers — safe to import from tests.
 */
import {
  ContributionFrequency,
  GroupScheduleUnit,
  GroupStatus,
  PayoutMode,
  Prisma,
  PrismaClient,
  UserRole,
} from "@prisma/client";
import * as bcrypt from "bcrypt";
import {
  computeGroupFinancePreview,
  getFixedGroupFinancePlatformSettings,
} from "@myturn/shared";

export const STAGING_INVITE_DEMO = "STAGING-DEMO";
export const STAGING_INVITE_PAY = "STAGING-PAY";
export const DEFAULT_STAGING_PASSWORD = "ChangeMe123!";

const STORE_SCHEDULE_FREQUENCY_VALUE = 1;
const STORE_SCHEDULE_FREQUENCY_UNIT = GroupScheduleUnit.DAY;
const STORE_LEGACY_CONTRIBUTION_FREQUENCY = ContributionFrequency.MONTHLY;

type SeedUser = {
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
};

const SEED_USERS: SeedUser[] = [
  {
    email: "hq@myturn.local",
    role: UserRole.SUPER_ADMIN,
    firstName: "MyTurn",
    lastName: "HQ",
  },
  {
    email: "admin@myturn.local",
    role: UserRole.ADMIN,
    firstName: "Group",
    lastName: "Admin",
  },
];

export type StagingGroupSpec = {
  inviteCode: string;
  name: string;
  description: string;
  contributionAmount: number;
  groupSize: number;
  daysPerCycle: number;
  startDate: string;
  serviceMarginBps?: number;
};

export const STAGING_GROUP_SPECS: StagingGroupSpec[] = [
  {
    inviteCode: STAGING_INVITE_DEMO,
    name: "Staging Demo (Join)",
    description: "Joinable onboarding circle for staging UAT.",
    contributionAmount: 50,
    groupSize: 5,
    daysPerCycle: 7,
    startDate: new Date().toISOString().slice(0, 10),
  },
  {
    inviteCode: STAGING_INVITE_PAY,
    name: "Staging Pay Lab",
    description: "Mock contribution and payout lab — join, fill slots, activate.",
    contributionAmount: 25,
    groupSize: 5,
    daysPerCycle: 3,
    startDate: new Date().toISOString().slice(0, 10),
  },
];

export async function ensureSeedUser(
  prisma: PrismaClient,
  passwordHash: string,
  spec: SeedUser,
): Promise<"created" | "skipped" | "reactivated"> {
  const existing = await prisma.user.findUnique({
    where: { email: spec.email },
    select: { id: true, role: true, isActive: true },
  });
  if (existing) {
    if (!existing.isActive) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
      return "reactivated";
    }
    return "skipped";
  }
  await prisma.user.create({
    data: {
      email: spec.email,
      passwordHash,
      role: spec.role,
      firstName: spec.firstName,
      lastName: spec.lastName,
      isActive: true,
    },
  });
  return "created";
}

export async function ensureStagingGroup(
  prisma: PrismaClient,
  adminId: string,
  spec: StagingGroupSpec,
): Promise<"created" | "skipped"> {
  const inviteCode = spec.inviteCode.trim().toUpperCase();
  const existing = await prisma.group.findUnique({
    where: { inviteCode },
    select: { id: true, adminId: true },
  });
  if (existing) {
    if (existing.adminId !== adminId) {
      console.warn(
        `[seed:staging] ${inviteCode} exists under another admin — leaving unchanged`,
      );
    }
    return "skipped";
  }

  const platform = getFixedGroupFinancePlatformSettings();
  const previewResult = computeGroupFinancePreview({
    contributionAmount: spec.contributionAmount,
    groupSize: spec.groupSize,
    payoutMode: PayoutMode.CYCLE,
    daysPerCycle: spec.daysPerCycle,
    startDate: spec.startDate,
    platformSettings: platform,
    serviceMarginBps: spec.serviceMarginBps,
  });
  if (!previewResult.ok) {
    throw new Error(`${inviteCode}: ${previewResult.reason}`);
  }
  const { preview } = previewResult;
  const groupStart = new Date(`${spec.startDate}T12:00:00.000Z`);
  const groupEnd = new Date(`${preview.endDate}T12:00:00.000Z`);

  await prisma.group.create({
    data: {
      name: spec.name,
      description: spec.description,
      inviteCode,
      adminId,
      contributionAmount: new Prisma.Decimal(spec.contributionAmount),
      daysPerCycle: spec.daysPerCycle,
      payoutMode: PayoutMode.CYCLE,
      frequency: STORE_LEGACY_CONTRIBUTION_FREQUENCY,
      memberSlots: spec.groupSize,
      serviceMarginBps: preview.serviceMarginBps,
      scheduleFrequencyValue: STORE_SCHEDULE_FREQUENCY_VALUE,
      scheduleFrequencyUnit: STORE_SCHEDULE_FREQUENCY_UNIT,
      groupStartDate: groupStart,
      groupEndDate: groupEnd,
      status: GroupStatus.DRAFT,
    },
  });
  return "created";
}

export async function runStagingSeed(prisma: PrismaClient): Promise<void> {
  const passwordHash = await bcrypt.hash(DEFAULT_STAGING_PASSWORD, 10);
  const userCounts = { created: 0, skipped: 0, reactivated: 0 };
  for (const spec of SEED_USERS) {
    const result = await ensureSeedUser(prisma, passwordHash, spec);
    userCounts[result] += 1;
    console.log(`[seed:staging] user ${spec.email}: ${result}`);
  }

  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@myturn.local" },
    select: { id: true },
  });

  const groupCounts = { created: 0, skipped: 0 };
  for (const spec of STAGING_GROUP_SPECS) {
    const result = await ensureStagingGroup(prisma, admin.id, spec);
    groupCounts[result] += 1;
    console.log(`[seed:staging] group ${spec.inviteCode}: ${result}`);
  }

  console.log("[seed:staging] --- summary ---");
  console.log(
    `[seed:staging] users: ${userCounts.created} created, ${userCounts.skipped} skipped, ${userCounts.reactivated} reactivated`,
  );
  console.log(
    `[seed:staging] groups: ${groupCounts.created} created, ${groupCounts.skipped} skipped`,
  );
  console.log(`[seed:staging] invite codes: ${STAGING_INVITE_DEMO}, ${STAGING_INVITE_PAY}`);
  console.log(
    `[seed:staging] default password (new users): ${DEFAULT_STAGING_PASSWORD}`,
  );
}
