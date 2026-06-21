"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STAGING_GROUP_SPECS = exports.DEFAULT_STAGING_PASSWORD = exports.STAGING_INVITE_PAY = exports.STAGING_INVITE_DEMO = void 0;
exports.ensureSeedUser = ensureSeedUser;
exports.ensureStagingGroup = ensureStagingGroup;
exports.runStagingSeed = runStagingSeed;
const client_1 = require("@prisma/client");
const bcrypt = require("bcrypt");
const shared_1 = require("@myturn/shared");
exports.STAGING_INVITE_DEMO = "STAGING-DEMO";
exports.STAGING_INVITE_PAY = "STAGING-PAY";
exports.DEFAULT_STAGING_PASSWORD = "ChangeMe123!";
const STORE_SCHEDULE_FREQUENCY_VALUE = 1;
const STORE_SCHEDULE_FREQUENCY_UNIT = client_1.GroupScheduleUnit.DAY;
const STORE_LEGACY_CONTRIBUTION_FREQUENCY = client_1.ContributionFrequency.MONTHLY;
const SEED_USERS = [
    {
        email: "hq@myturn.local",
        role: client_1.UserRole.SUPER_ADMIN,
        firstName: "MyTurn",
        lastName: "HQ",
    },
    {
        email: "admin@myturn.local",
        role: client_1.UserRole.ADMIN,
        firstName: "Group",
        lastName: "Admin",
    },
];
exports.STAGING_GROUP_SPECS = [
    {
        inviteCode: exports.STAGING_INVITE_DEMO,
        name: "Staging Demo (Join)",
        description: "Joinable onboarding circle for staging UAT.",
        contributionAmount: 50,
        groupSize: 5,
        daysPerCycle: 7,
        startDate: new Date().toISOString().slice(0, 10),
    },
    {
        inviteCode: exports.STAGING_INVITE_PAY,
        name: "Staging Pay Lab",
        description: "Mock contribution and payout lab — join, fill slots, activate.",
        contributionAmount: 25,
        groupSize: 5,
        daysPerCycle: 3,
        startDate: new Date().toISOString().slice(0, 10),
    },
];
async function ensureSeedUser(prisma, passwordHash, spec) {
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
async function ensureStagingGroup(prisma, adminId, spec) {
    const inviteCode = spec.inviteCode.trim().toUpperCase();
    const existing = await prisma.group.findUnique({
        where: { inviteCode },
        select: { id: true, adminId: true },
    });
    if (existing) {
        if (existing.adminId !== adminId) {
            console.warn(`[seed:staging] ${inviteCode} exists under another admin — leaving unchanged`);
        }
        return "skipped";
    }
    const platform = (0, shared_1.getFixedGroupFinancePlatformSettings)();
    const previewResult = (0, shared_1.computeGroupFinancePreview)({
        contributionAmount: spec.contributionAmount,
        groupSize: spec.groupSize,
        payoutMode: client_1.PayoutMode.CYCLE,
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
            contributionAmount: new client_1.Prisma.Decimal(spec.contributionAmount),
            daysPerCycle: spec.daysPerCycle,
            payoutMode: client_1.PayoutMode.CYCLE,
            frequency: STORE_LEGACY_CONTRIBUTION_FREQUENCY,
            memberSlots: spec.groupSize,
            serviceMarginBps: preview.serviceMarginBps,
            scheduleFrequencyValue: STORE_SCHEDULE_FREQUENCY_VALUE,
            scheduleFrequencyUnit: STORE_SCHEDULE_FREQUENCY_UNIT,
            groupStartDate: groupStart,
            groupEndDate: groupEnd,
            status: client_1.GroupStatus.DRAFT,
        },
    });
    return "created";
}
async function runStagingSeed(prisma) {
    const passwordHash = await bcrypt.hash(exports.DEFAULT_STAGING_PASSWORD, 10);
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
    for (const spec of exports.STAGING_GROUP_SPECS) {
        const result = await ensureStagingGroup(prisma, admin.id, spec);
        groupCounts[result] += 1;
        console.log(`[seed:staging] group ${spec.inviteCode}: ${result}`);
    }
    console.log("[seed:staging] --- summary ---");
    console.log(`[seed:staging] users: ${userCounts.created} created, ${userCounts.skipped} skipped, ${userCounts.reactivated} reactivated`);
    console.log(`[seed:staging] groups: ${groupCounts.created} created, ${groupCounts.skipped} skipped`);
    console.log(`[seed:staging] invite codes: ${exports.STAGING_INVITE_DEMO}, ${exports.STAGING_INVITE_PAY}`);
    console.log(`[seed:staging] default password (new users): ${exports.DEFAULT_STAGING_PASSWORD}`);
}
//# sourceMappingURL=seed-staging.lib.js.map