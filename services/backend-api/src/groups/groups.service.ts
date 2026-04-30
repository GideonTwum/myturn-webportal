import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  ContributionFrequency,
  ContributionStatus,
  DepositStatus,
  GroupMemberStatus,
  GroupScheduleUnit,
  GroupStatus,
  MemberCycleStanding,
  PayoutMode,
  Prisma,
  UserRole,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { randomBytes, randomInt } from "crypto";
import {
  computeGroupFinancePreview,
  getFixedGroupFinancePlatformSettings,
  summarizeCycle,
} from "@myturn/shared";
import { memberCyclePaymentDays } from "../common/member-cycle-payment-days";
import { CycleComplianceService } from "../cycle-risk/cycle-compliance.service";
import { CycleDepositsService } from "../cycle-risk/cycle-deposits.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { UsersService } from "../users/users.service";

/** Legacy DB fields — no longer user-editable; fixed daily semantics (step = 1 day). */
const STORE_SCHEDULE_FREQUENCY_VALUE = 1;
const STORE_SCHEDULE_FREQUENCY_UNIT = GroupScheduleUnit.DAY;
const STORE_LEGACY_CONTRIBUTION_FREQUENCY = ContributionFrequency.MONTHLY;

export type CreateGroupInput = {
  name: string;
  description?: string;
  contributionAmount: number;
  payoutMode: PayoutMode;
  /** Required when `payoutMode` is CYCLE. */
  daysPerCycle?: number;
  groupSize: number;
  startDate: string;
};

export type UpdateGroupDraftInput = {
  name?: string;
  description?: string;
  contributionAmount?: number;
  payoutMode?: PayoutMode;
  daysPerCycle?: number;
  groupSize?: number;
  startDate?: string;
};

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const t = fullName.trim();
  const sp = t.indexOf(" ");
  if (sp === -1) {
    return { firstName: t || "Member", lastName: "" };
  }
  return {
    firstName: t.slice(0, sp).trim() || "Member",
    lastName: t.slice(sp + 1).trim(),
  };
}

function groupStartDateToIso(d: Date | null): string | undefined {
  if (!d) return undefined;
  return d.toISOString().slice(0, 10);
}

export type JoinWithInviteInput = {
  inviteCode: string;
  fullName: string;
  phone: string;
  email?: string;
  /** When omitted for new accounts, a random password is generated server-side. */
  password?: string;
};

@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditLogsService,
    private users: UsersService,
    private deposits: CycleDepositsService,
    private cycleCompliance: CycleComplianceService,
  ) {}

  async create(adminId: string, input: CreateGroupInput) {
    if (input.payoutMode === PayoutMode.CYCLE) {
      const d = input.daysPerCycle;
      if (d == null || !Number.isInteger(d)) {
        throw new BadRequestException(
          "Days per cycle is required for CYCLE payout mode",
        );
      }
      if (d < 1 || d > 366) {
        throw new BadRequestException(
          "Days per cycle must be between 1 and 366",
        );
      }
    }
    const storedDays =
      input.payoutMode === PayoutMode.DAILY ? 1 : input.daysPerCycle!;
    const platform = getFixedGroupFinancePlatformSettings();
    const previewResult = computeGroupFinancePreview({
      contributionAmount: input.contributionAmount,
      groupSize: input.groupSize,
      payoutMode: input.payoutMode,
      daysPerCycle:
        input.payoutMode === PayoutMode.CYCLE ? storedDays : undefined,
      startDate: input.startDate,
      platformSettings: platform,
    });
    if (!previewResult.ok) {
      throw new BadRequestException(previewResult.reason);
    }
    const { preview } = previewResult;

    const groupStart = new Date(`${input.startDate}T12:00:00.000Z`);
    const groupEnd = new Date(`${preview.endDate}T12:00:00.000Z`);

    const inviteCode = await this.ensureUniqueInviteCode();

    const group = await this.prisma.group.create({
      data: {
        name: input.name,
        description: input.description,
        inviteCode,
        adminId,
        contributionAmount: new Prisma.Decimal(input.contributionAmount),
        daysPerCycle: storedDays,
        payoutMode: input.payoutMode,
        frequency: STORE_LEGACY_CONTRIBUTION_FREQUENCY,
        memberSlots: input.groupSize,
        serviceMarginBps: preview.serviceMarginBps,
        scheduleFrequencyValue: STORE_SCHEDULE_FREQUENCY_VALUE,
        scheduleFrequencyUnit: STORE_SCHEDULE_FREQUENCY_UNIT,
        groupStartDate: groupStart,
        groupEndDate: groupEnd,
        status: GroupStatus.DRAFT,
      },
    });
    await this.audit.append({
      actorId: adminId,
      action: "GROUP_CREATE",
      entityType: "Group",
      entityId: group.id,
      metadata: {
        financePreview: preview,
        platformFinance: platform,
      },
    });
    this.logger.log(
      `Group created (DRAFT) groupId=${group.id} name="${group.name}" inviteCode=${inviteCode} groupSize=${input.groupSize} adminId=${adminId}`,
    );
    return group;
  }

  listForAdmin(adminId: string) {
    return this.prisma.group.findMany({
      where: { adminId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { members: true } } },
    });
  }

  listAll() {
    return this.prisma.group.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        admin: { select: { id: true, email: true, firstName: true, lastName: true } },
        _count: { select: { members: true } },
      },
    });
  }

  async get(groupId: string, viewer: { id: string; role: UserRole }) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        },
      },
    });
    if (!group) {
      throw new NotFoundException("Group not found");
    }
    if (viewer.role === UserRole.ADMIN && group.adminId !== viewer.id) {
      throw new ForbiddenException();
    }
    return group;
  }

  /** Preview cycle math for UI — uses @myturn/shared */
  previewCycleMath(groupId: string, cycleNumber: number) {
    return this.prisma.group
      .findUnique({
        where: { id: groupId },
        include: {
          members: { where: { status: "ACTIVE" } },
        },
      })
      .then((group) => {
        if (!group) {
          throw new NotFoundException("Group not found");
        }
        const n = group.members.length;
        const cents = BigInt(
          new Decimal(group.contributionAmount.toString())
            .mul(100)
            .toFixed(0),
        );
        return summarizeCycle(
          cycleNumber,
          cents,
          n,
          group.serviceMarginBps,
          memberCyclePaymentDays(group),
        );
      });
  }

  async activate(adminId: string, groupId: string) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: { where: { status: "ACTIVE" } },
      },
    });
    if (!group) {
      throw new NotFoundException("Group not found");
    }
    if (group.adminId !== adminId) {
      throw new ForbiddenException();
    }
    if (group.members.length !== group.memberSlots) {
      throw new BadRequestException("Fill all member slots before activating");
    }
    if (group.status !== GroupStatus.DRAFT) {
      throw new BadRequestException("Group is not in draft status");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.group.update({
        where: { id: groupId },
        data: { status: GroupStatus.ACTIVE, currentCycle: 1 },
      });
      const days = memberCyclePaymentDays(group);
      const perMemberTotal = new Prisma.Decimal(group.contributionAmount.toString()).mul(
        days,
      );
      for (const m of group.members) {
        await tx.contribution.create({
          data: {
            groupId,
            userId: m.userId,
            cycleNumber: 1,
            amount: perMemberTotal,
            expectedDayCount: days,
            paidDayCount: 0,
            status: ContributionStatus.PENDING,
          },
        });
      }
    });
    await this.audit.append({
      actorId: adminId,
      action: "GROUP_ACTIVATE",
      entityType: "Group",
      entityId: groupId,
    });
    return this.get(groupId, { id: adminId, role: UserRole.ADMIN });
  }

  /** Admin payout UI: current cycle, unpaid members, expected recipient. */
  async getPayoutReadiness(
    groupId: string,
    viewer: { id: string; role: UserRole },
  ) {
    await this.cycleCompliance.syncGroupCompliance(groupId);
    const group = await this.get(groupId, viewer);
    const members = [...group.members]
      .filter((m) => m.status === "ACTIVE")
      .sort((a, b) => a.turnOrder - b.turnOrder);
    const n = members.length;
    const totalCycles = group.memberSlots;
    const currentCycle = group.currentCycle;

    const contributions = await this.prisma.contribution.findMany({
      where: { groupId, cycleNumber: currentCycle },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
    const byUser = new Map(contributions.map((c) => [c.userId, c]));

    const contributionLine = members.map((m) => {
      const c = byUser.get(m.userId);
      const expectedDays =
        c?.expectedDayCount ?? memberCyclePaymentDays(group);
      const paidDays = c?.paidDayCount ?? 0;
      return {
        userId: m.userId,
        email: m.user.email,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        turnOrder: m.turnOrder,
        contributionId: c?.id ?? null,
        status: c?.status ?? "MISSING",
        paidDayCount: paidDays,
        expectedDayCount: expectedDays,
        isPaid: c?.status === "PAID",
        cycleStanding: m.cycleStanding,
        depositStatus: m.depositStatus,
        depositAmount: m.depositAmount.toString(),
      };
    });

    const unpaidMembers = contributionLine.filter((l) => !l.isPaid);
    const allPaid =
      group.status !== GroupStatus.CANCELLED &&
      n > 0 &&
      contributions.length === n &&
      unpaidMembers.length === 0;

    const existingPayout = await this.prisma.payout.findFirst({
      where: { groupId, cycleNumber: currentCycle },
    });

    let expectedPayoutRecipient: {
      userId: string;
      email: string;
      turnOrder: number;
    } | null = null;
    if (n > 0 && group.status === GroupStatus.ACTIVE) {
      const turnIndex = (currentCycle - 1) % n;
      const mem = members[turnIndex];
      if (mem) {
        expectedPayoutRecipient = {
          userId: mem.userId,
          email: mem.user.email,
          turnOrder: mem.turnOrder,
        };
      }
    }

    const memberStandingRows = members.map((m) => ({
      userId: m.userId,
      cycleStanding: m.cycleStanding,
    }));

    const complianceBlocksPayout =
      group.payoutMode === PayoutMode.CYCLE &&
      this.cycleCompliance.hasBlockingDefaults(
        memberStandingRows,
        group.allowPayoutOverride,
      );

    const recipientDefaultBlocked =
      group.payoutMode === PayoutMode.CYCLE &&
      !!expectedPayoutRecipient &&
      this.cycleCompliance.recipientBlocked(
        expectedPayoutRecipient.userId,
        memberStandingRows,
        group.allowPayoutOverride,
      );

    const hasDefaultedMembers = members.some(
      (m) => m.cycleStanding === MemberCycleStanding.DEFAULTED,
    );

    const canFinalize =
      group.status === GroupStatus.ACTIVE &&
      allPaid &&
      !existingPayout &&
      currentCycle <= totalCycles &&
      !complianceBlocksPayout &&
      !recipientDefaultBlocked;

    return {
      groupId: group.id,
      groupName: group.name,
      groupStatus: group.status,
      currentCycle,
      totalCycles,
      contributionAmount: group.contributionAmount.toString(),
      daysPerCycle: group.daysPerCycle,
      payoutMode: group.payoutMode,
      defaultGraceDays: group.defaultGraceDays,
      allowPayoutOverride: group.allowPayoutOverride,
      complianceBlocksPayout,
      recipientDefaultBlocked,
      hasDefaultedMembers,
      members: contributionLine,
      unpaidMembers,
      expectedPayoutRecipient,
      payoutForCurrentCycleExists: !!existingPayout,
      allContributionsPaidForCurrentCycle: allPaid,
      canFinalize,
    };
  }

  private normalizeInviteCode(raw: string): string {
    return raw.trim().toUpperCase().replace(/\s+/g, "");
  }

  private async ensureUniqueInviteCode(): Promise<string> {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    for (let attempt = 0; attempt < 64; attempt++) {
      let suffix = "";
      for (let i = 0; i < 4; i++) {
        suffix += alphabet[randomInt(alphabet.length)];
      }
      const code = `MT-${suffix}`;
      const exists = await this.prisma.group.findUnique({
        where: { inviteCode: code },
        select: { id: true },
      });
      if (!exists) return code;
    }
    throw new BadRequestException("Could not generate invite code");
  }

  async getInvitePreview(rawInviteCode: string) {
    const inviteCode = this.normalizeInviteCode(rawInviteCode);
    const group = await this.prisma.group.findUnique({
      where: { inviteCode },
      include: {
        members: { where: { status: GroupMemberStatus.ACTIVE } },
      },
    });
    if (!group) {
      throw new NotFoundException("Invalid invite code");
    }
    if (group.status !== GroupStatus.DRAFT) {
      throw new BadRequestException(
        "This group is no longer accepting members",
      );
    }
    const currentMembers = group.members.length;
    if (currentMembers >= group.memberSlots) {
      throw new BadRequestException("This group is full");
    }
    return {
      name: group.name,
      contributionAmount: group.contributionAmount.toString(),
      payoutMode: group.payoutMode,
      ...(group.payoutMode === PayoutMode.CYCLE
        ? {
            daysPerCycle: group.daysPerCycle,
            requiredDepositAmount: new Prisma.Decimal(group.contributionAmount.toString())
              .mul(group.daysPerCycle)
              .toFixed(2),
            depositHelp:
              "A security deposit of contribution × days per cycle is held in your wallet (locked) when you join.",
          }
        : {}),
      daysPerCycleHelp:
        group.payoutMode === PayoutMode.CYCLE
          ? "Members contribute daily for this number of days before each payout."
          : "Each member pays once per cycle; payout runs when everyone has paid.",
      groupSize: group.memberSlots,
      currentMembers,
      availableSlots: group.memberSlots - currentMembers,
    };
  }

  async joinWithInvite(
    input: JoinWithInviteInput,
    opts?: { authenticatedUserId?: string },
  ): Promise<{ userId: string }> {
    const inviteCode = this.normalizeInviteCode(input.inviteCode);
    const { firstName, lastName } = splitFullName(input.fullName);

    const group = await this.prisma.group.findUnique({
      where: { inviteCode },
      include: {
        members: { where: { status: GroupMemberStatus.ACTIVE } },
      },
    });
    if (!group) {
      throw new NotFoundException("Invalid invite code");
    }
    if (group.status !== GroupStatus.DRAFT) {
      throw new BadRequestException(
        "This group is no longer accepting members",
      );
    }
    if (group.members.length >= group.memberSlots) {
      throw new BadRequestException("This group is full");
    }

    const digits = input.phone.replace(/\D/g, "");
    const emailExplicit = input.email?.trim().toLowerCase();
    const syntheticEmail = digits ? `join.${digits}@invite.myturn.local` : null;
    if (!emailExplicit && !syntheticEmail) {
      throw new BadRequestException("Enter a valid phone number");
    }

    const emailForCreate = emailExplicit ?? syntheticEmail!;

    let user = emailExplicit
      ? await this.users.findByEmail(emailExplicit)
      : await this.users.findMemberUserByPhoneDigits(input.phone);

    if (!user && syntheticEmail) {
      user = await this.users.findByEmail(syntheticEmail);
    }
    const newUserPassword =
      input.password ?? randomBytes(24).toString("base64url");

    if (!user) {
      try {
        await this.users.createUser({
          email: emailForCreate,
          password: newUserPassword,
          role: UserRole.USER,
          firstName,
          lastName: lastName || undefined,
          phone: input.phone.trim(),
        });
      } catch (e) {
        if (!(e instanceof ConflictException)) throw e;
      }
      user = await this.users.findByEmail(emailForCreate);
    }
    if (!user) {
      throw new BadRequestException("Unable to create or find user");
    }

    const authedMatch =
      opts?.authenticatedUserId != null &&
      opts.authenticatedUserId === user.id;

    let passwordOk = authedMatch;
    if (!passwordOk && input.password != null && input.password.length > 0) {
      passwordOk = await this.users.verifyPasswordForUser(
        user.id,
        input.password,
      );
    }
    if (!passwordOk) {
      throw new BadRequestException(
        "This phone number already has an account. Sign in from the member page, then join this group again.",
      );
    }

    const already = group.members.some((m) => m.userId === user.id);
    if (already) {
      throw new BadRequestException("You are already a member of this group.");
    }

    const nextTurnOrder =
      group.members.reduce((max, m) => Math.max(max, m.turnOrder), 0) + 1;

    const member = await this.prisma.$transaction(async (tx) => {
      const m = await tx.groupMember.create({
        data: {
          groupId: group.id,
          userId: user.id,
          turnOrder: nextTurnOrder,
          depositAmount: 0,
          depositStatus: DepositStatus.NOT_REQUIRED,
        },
      });
      const dep = await this.deposits.applyDepositOnJoin(tx, {
        userId: user.id,
        groupId: group.id,
        memberId: m.id,
        group: {
          contributionAmount: group.contributionAmount,
          daysPerCycle: group.daysPerCycle,
          payoutMode: group.payoutMode,
          name: group.name,
        },
      });
      await tx.groupMember.update({
        where: { id: m.id },
        data: {
          depositAmount: dep.depositAmount,
          depositStatus: dep.depositStatus,
        },
      });
      return m;
    });

    await this.audit.append({
      actorId: user.id,
      action: "GROUP_JOIN_INVITE",
      entityType: "GroupMember",
      entityId: member.id,
      metadata: {
        groupId: group.id,
        inviteCode,
        depositStatus:
          group.payoutMode === PayoutMode.CYCLE ? "HELD" : "NOT_REQUIRED",
      },
    });

    return { userId: user.id };
  }

  /** Logged-in member: active groups, payout turn, and current-cycle contribution progress. */
  async getMemberParticipation(userId: string) {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId, status: GroupMemberStatus.ACTIVE },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            status: true,
            contributionAmount: true,
            daysPerCycle: true,
            payoutMode: true,
            memberSlots: true,
            currentCycle: true,
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    const items: Array<{
      groupId: string;
      groupName: string;
      groupStatus: GroupStatus;
      payoutMode: PayoutMode;
      turnOrder: number;
      memberSlots: number;
      payoutPositionLabel: string;
      contributionAmount: string;
      daysPerCycle: number;
      currentCycle: number;
      totalCycles: number;
      contributionId: string | null;
      paidDayCount: number;
      expectedDayCount: number;
      remainingDays: number;
      contributionStatus: ContributionStatus | null;
      cycleStanding: MemberCycleStanding;
    }> = [];

    for (const m of memberships) {
      const g = m.group;
      const effectiveDays =
        g.payoutMode === PayoutMode.DAILY ? 1 : g.daysPerCycle ?? 1;

      let contribution: {
        id: string;
        paidDayCount: number;
        expectedDayCount: number;
        status: ContributionStatus;
      } | null = null;

      if (g.status === GroupStatus.ACTIVE) {
        contribution = await this.prisma.contribution.findFirst({
          where: {
            groupId: g.id,
            userId,
            cycleNumber: g.currentCycle,
          },
          select: {
            id: true,
            paidDayCount: true,
            expectedDayCount: true,
            status: true,
          },
        });
      }

      const paid = contribution?.paidDayCount ?? 0;
      const expected =
        contribution?.expectedDayCount ?? effectiveDays;
      const remaining = Math.max(0, expected - paid);

      items.push({
        groupId: g.id,
        groupName: g.name,
        groupStatus: g.status,
        payoutMode: g.payoutMode,
        turnOrder: m.turnOrder,
        memberSlots: g.memberSlots,
        payoutPositionLabel: `${m.turnOrder} of ${g.memberSlots}`,
        contributionAmount: g.contributionAmount.toString(),
        daysPerCycle: effectiveDays,
        currentCycle: g.currentCycle,
        totalCycles: g.memberSlots,
        contributionId: contribution?.id ?? null,
        paidDayCount: paid,
        expectedDayCount: expected,
        remainingDays: remaining,
        contributionStatus: contribution?.status ?? null,
        cycleStanding: m.cycleStanding,
      });
    }

    return { memberships: items };
  }

  async updateDraft(adminId: string, groupId: string, input: UpdateGroupDraftInput) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: { where: { status: GroupMemberStatus.ACTIVE } },
      },
    });
    if (!group) {
      throw new NotFoundException("Group not found");
    }
    if (group.adminId !== adminId) {
      throw new ForbiddenException();
    }
    if (
      group.status === GroupStatus.ACTIVE ||
      group.status === GroupStatus.COMPLETED
    ) {
      throw new BadRequestException(
        "This group can no longer be edited after activation",
      );
    }
    if (group.status !== GroupStatus.DRAFT) {
      throw new BadRequestException("Group is not in draft status");
    }

    const memberCount = group.members.length;
    const contributionAmount =
      input.contributionAmount ??
      Number(new Decimal(group.contributionAmount.toString()));
    const memberSlots = input.groupSize ?? group.memberSlots;
    const payoutMode = input.payoutMode ?? group.payoutMode;
    let storedDays: number;
    if (payoutMode === PayoutMode.CYCLE) {
      const d = input.daysPerCycle ?? group.daysPerCycle;
      if (!Number.isInteger(d) || d < 1 || d > 366) {
        throw new BadRequestException(
          "Days per cycle must be a whole number between 1 and 366 for CYCLE payout mode",
        );
      }
      storedDays = d;
    } else {
      storedDays = 1;
    }
    const startDateIso =
      input.startDate ?? groupStartDateToIso(group.groupStartDate);
    if (!startDateIso || !/^\d{4}-\d{2}-\d{2}$/.test(startDateIso)) {
      throw new BadRequestException("Invalid start date");
    }

    if (memberSlots < memberCount) {
      throw new BadRequestException(
        "Group size cannot be less than the current member count",
      );
    }
    const minAllowedSlots = Math.max(5, memberCount);
    if (memberSlots < minAllowedSlots) {
      throw new BadRequestException(
        `Group size must be at least ${minAllowedSlots}`,
      );
    }
    if (contributionAmount <= 0) {
      throw new BadRequestException("Contribution amount must be greater than 0");
    }

    const platform = getFixedGroupFinancePlatformSettings();
    const previewResult = computeGroupFinancePreview({
      contributionAmount,
      groupSize: memberSlots,
      payoutMode,
      daysPerCycle:
        payoutMode === PayoutMode.CYCLE ? storedDays : undefined,
      startDate: startDateIso,
      platformSettings: platform,
    });
    if (!previewResult.ok) {
      throw new BadRequestException(previewResult.reason);
    }
    const { preview } = previewResult;

    const groupStart = new Date(`${startDateIso}T12:00:00.000Z`);
    if (Number.isNaN(groupStart.getTime())) {
      throw new BadRequestException("Invalid start date");
    }
    const groupEnd = new Date(`${preview.endDate}T12:00:00.000Z`);

    await this.prisma.group.update({
      where: { id: groupId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        contributionAmount: new Prisma.Decimal(contributionAmount),
        memberSlots,
        daysPerCycle: storedDays,
        payoutMode,
        serviceMarginBps: preview.serviceMarginBps,
        scheduleFrequencyValue: STORE_SCHEDULE_FREQUENCY_VALUE,
        scheduleFrequencyUnit: STORE_SCHEDULE_FREQUENCY_UNIT,
        frequency: STORE_LEGACY_CONTRIBUTION_FREQUENCY,
        groupStartDate: groupStart,
        groupEndDate: groupEnd,
      },
    });

    await this.audit.append({
      actorId: adminId,
      action: "GROUP_UPDATE_DRAFT",
      entityType: "Group",
      entityId: groupId,
      metadata: { financePreview: preview, patch: input },
    });

    return this.get(groupId, { id: adminId, role: UserRole.ADMIN });
  }

  /** Active / draft: grace days and emergency payout override (CYCLE compliance). */
  async updateCycleRiskSettings(
    adminId: string,
    groupId: string,
    input: { allowPayoutOverride?: boolean; defaultGraceDays?: number },
  ) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException("Group not found");
    }
    if (group.adminId !== adminId) {
      throw new ForbiddenException();
    }
    if (
      group.status !== GroupStatus.ACTIVE &&
      group.status !== GroupStatus.DRAFT
    ) {
      throw new BadRequestException("Cannot update risk settings for this group");
    }
    if (input.defaultGraceDays !== undefined) {
      const g = input.defaultGraceDays;
      if (!Number.isInteger(g) || g < 0 || g > 30) {
        throw new BadRequestException("defaultGraceDays must be an integer from 0 to 30");
      }
    }
    await this.prisma.group.update({
      where: { id: groupId },
      data: {
        ...(input.allowPayoutOverride !== undefined
          ? { allowPayoutOverride: input.allowPayoutOverride }
          : {}),
        ...(input.defaultGraceDays !== undefined
          ? { defaultGraceDays: input.defaultGraceDays }
          : {}),
      },
    });
    await this.audit.append({
      actorId: adminId,
      action: "GROUP_CYCLE_RISK_SETTINGS",
      entityType: "Group",
      entityId: groupId,
      metadata: input,
    });
    return this.get(groupId, { id: adminId, role: UserRole.ADMIN });
  }

  async getCycleComplianceAdmin(
    groupId: string,
    viewer: { id: string; role: UserRole },
  ) {
    await this.cycleCompliance.syncGroupCompliance(groupId);
    const group = await this.get(groupId, viewer);
    const members = [...group.members]
      .filter((m) => m.status === GroupMemberStatus.ACTIVE)
      .sort((a, b) => a.turnOrder - b.turnOrder);
    const currentCycle = group.currentCycle;
    const contributions = await this.prisma.contribution.findMany({
      where: { groupId, cycleNumber: currentCycle },
    });
    const byUser = new Map(contributions.map((c) => [c.userId, c]));
    return {
      groupId: group.id,
      groupName: group.name,
      groupStatus: group.status,
      payoutMode: group.payoutMode,
      currentCycle,
      defaultGraceDays: group.defaultGraceDays,
      allowPayoutOverride: group.allowPayoutOverride,
      members: members.map((m) => {
        const c = byUser.get(m.userId);
        return {
          userId: m.userId,
          email: m.user.email,
          turnOrder: m.turnOrder,
          cycleStanding: m.cycleStanding,
          depositStatus: m.depositStatus,
          depositAmount: m.depositAmount.toString(),
          contribution: c
            ? {
                id: c.id,
                status: c.status,
                paidDayCount: c.paidDayCount,
                expectedDayCount: c.expectedDayCount,
              }
            : null,
        };
      }),
    };
  }

  /**
   * Remove a DEFAULTED member and slot in a replacement (same turn order).
   * New user must already exist and not be in this group.
   */
  async replaceDefaultingMember(
    adminId: string,
    groupId: string,
    oldUserId: string,
    newUserId: string,
  ) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: { where: { status: GroupMemberStatus.ACTIVE } },
      },
    });
    if (!group) {
      throw new NotFoundException("Group not found");
    }
    if (group.adminId !== adminId) {
      throw new ForbiddenException();
    }
    if (group.status !== GroupStatus.ACTIVE) {
      throw new BadRequestException("Replacements are only for active groups");
    }
    const oldM = group.members.find((m) => m.userId === oldUserId);
    if (!oldM) {
      throw new NotFoundException("Member not found");
    }
    if (oldM.cycleStanding !== MemberCycleStanding.DEFAULTED) {
      throw new BadRequestException(
        "Only members marked DEFAULTED can be replaced with this action",
      );
    }
    if (group.members.some((m) => m.userId === newUserId)) {
      throw new BadRequestException("New user is already in this group");
    }
    const newUser = await this.prisma.user.findUnique({
      where: { id: newUserId },
    });
    if (!newUser) {
      throw new NotFoundException("Replacement user not found");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.groupMember.update({
        where: { id: oldM.id },
        data: { status: GroupMemberStatus.LEFT },
      });
      const m = await tx.groupMember.create({
        data: {
          groupId,
          userId: newUserId,
          turnOrder: oldM.turnOrder,
          depositAmount: 0,
          depositStatus: DepositStatus.NOT_REQUIRED,
          cycleStanding: MemberCycleStanding.ACTIVE,
        },
      });
      const dep = await this.deposits.applyDepositOnJoin(tx, {
        userId: newUserId,
        groupId,
        memberId: m.id,
        group: {
          contributionAmount: group.contributionAmount,
          daysPerCycle: group.daysPerCycle,
          payoutMode: group.payoutMode,
          name: group.name,
        },
      });
      await tx.groupMember.update({
        where: { id: m.id },
        data: {
          depositAmount: dep.depositAmount,
          depositStatus: dep.depositStatus,
        },
      });

      const cur = group.currentCycle;
      const contrib = await tx.contribution.findFirst({
        where: { groupId, userId: oldUserId, cycleNumber: cur },
      });
      if (contrib) {
        await tx.contribution.update({
          where: { id: contrib.id },
          data: { userId: newUserId, paidDayCount: 0, status: ContributionStatus.PENDING },
        });
      }
    });

    await this.audit.append({
      actorId: adminId,
      action: "GROUP_REPLACE_DEFAULTED_MEMBER",
      entityType: "Group",
      entityId: groupId,
      metadata: { oldUserId, newUserId },
    });

    return this.get(groupId, { id: adminId, role: UserRole.ADMIN });
  }
}
