import { Injectable, Logger } from "@nestjs/common";
import {
  ContributionStatus,
  GroupStatus,
  MemberCycleStanding,
  PayoutMode,
  Prisma,
} from "@prisma/client";
import { addDaysToIsoDate } from "@myturn/shared";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { CycleDepositsService } from "./cycle-deposits.service";

function utcDayStart(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function calendarDaysBetweenUtc(start: Date, end: Date): number {
  const a = utcDayStart(start).getTime();
  const b = utcDayStart(end).getTime();
  return Math.floor((b - a) / 86_400_000);
}

@Injectable()
export class CycleComplianceService {
  private readonly logger = new Logger(CycleComplianceService.name);

  constructor(
    private prisma: PrismaService,
    private deposits: CycleDepositsService,
    private notifications: NotificationsService,
  ) {}

  /** Evaluate LATE / DEFAULTED for one active CYCLE group (idempotent transitions). */
  async syncGroupCompliance(groupId: string): Promise<void> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          where: { status: "ACTIVE" },
          include: { user: true },
        },
      },
    });
    if (!group || group.status !== GroupStatus.ACTIVE) return;
    if (group.payoutMode !== PayoutMode.CYCLE) {
      await this.prisma.groupMember.updateMany({
        where: { groupId, status: "ACTIVE" },
        data: { cycleStanding: MemberCycleStanding.ACTIVE },
      });
      return;
    }
    if (!group.groupStartDate) return;

    const currentCycle = group.currentCycle;
    const startIso = group.groupStartDate.toISOString().slice(0, 10);
    const cycleStartIso = addDaysToIsoDate(
      startIso,
      (currentCycle - 1) * group.daysPerCycle,
    );
    const cycleStart = new Date(`${cycleStartIso}T12:00:00.000Z`);
    const now = new Date();

    const contributions = await this.prisma.contribution.findMany({
      where: { groupId, cycleNumber: currentCycle },
    });
    const byUser = new Map(contributions.map((c) => [c.userId, c]));

    for (const m of group.members) {
      const c = byUser.get(m.userId);
      if (!c) continue;

      if (c.status === ContributionStatus.PAID) {
        if (m.cycleStanding !== MemberCycleStanding.DEFAULTED) {
          await this.prisma.groupMember.update({
            where: { id: m.id },
            data: { cycleStanding: MemberCycleStanding.ACTIVE },
          });
        }
        continue;
      }

      const expected = c.expectedDayCount;
      const paid = c.paidDayCount;
      const daysSince = calendarDaysBetweenUtc(cycleStart, now);
      const requiredPaid = Math.min(
        expected,
        Math.max(0, daysSince),
      );

      const defaultDeadlineIso = addDaysToIsoDate(
        cycleStartIso,
        expected + group.defaultGraceDays,
      );
      const defaultDeadline = new Date(`${defaultDeadlineIso}T23:59:59.999Z`);

      let nextStanding: MemberCycleStanding = MemberCycleStanding.ACTIVE;
      if (now > defaultDeadline) {
        nextStanding = MemberCycleStanding.DEFAULTED;
      } else if (paid < requiredPaid) {
        nextStanding = MemberCycleStanding.LATE;
      }

      if (
        nextStanding === MemberCycleStanding.DEFAULTED &&
        m.cycleStanding !== MemberCycleStanding.DEFAULTED
      ) {
        await this.prisma.$transaction(async (tx) => {
          await tx.groupMember.update({
            where: { id: m.id },
            data: { cycleStanding: MemberCycleStanding.DEFAULTED },
          });
          await this.deposits.forfeitDepositForDefaulted(tx, {
            memberId: m.id,
            userId: m.userId,
            groupId,
            groupName: group.name,
          });
        });

        await this.notifications.create(
          m.userId,
          "Marked as defaulted",
          `You were marked DEFAULTED on cycle ${currentCycle} of ${group.name} for missing contributions past the grace period. Your security deposit was forfeited and you cannot receive payouts for this group.`,
          "CYCLE_DEFAULTED",
          { groupId, cycle: currentCycle },
        );
        await this.notifications.create(
          group.adminId,
          "Member defaulted",
          `${m.user.email} was marked DEFAULTED on ${group.name} (cycle ${currentCycle}). Review compliance and consider replacement.`,
          "ADMIN_CYCLE_DEFAULTED",
          { groupId, userId: m.userId, cycle: currentCycle },
        );
        continue;
      }

      if (
        nextStanding === MemberCycleStanding.LATE &&
        m.cycleStanding !== MemberCycleStanding.DEFAULTED
      ) {
        await this.prisma.groupMember.update({
          where: { id: m.id },
          data: { cycleStanding: MemberCycleStanding.LATE },
        });
      } else if (
        nextStanding === MemberCycleStanding.ACTIVE &&
        m.cycleStanding !== MemberCycleStanding.DEFAULTED
      ) {
        await this.prisma.groupMember.update({
          where: { id: m.id },
          data: { cycleStanding: MemberCycleStanding.ACTIVE },
        });
      }
    }
  }

  async syncAllActiveCycleGroups(): Promise<void> {
    const groups = await this.prisma.group.findMany({
      where: {
        status: GroupStatus.ACTIVE,
        payoutMode: PayoutMode.CYCLE,
      },
      select: { id: true },
    });
    for (const g of groups) {
      try {
        await this.syncGroupCompliance(g.id);
      } catch (e) {
        this.logger.warn(
          `syncGroupCompliance failed groupId=${g.id} ${e instanceof Error ? e.message : e}`,
        );
      }
    }
  }

  /**
   * Daily reminders: unpaid CYCLE members + admin summary (best-effort).
   */
  async sendDailyReminders(): Promise<void> {
    const groups = await this.prisma.group.findMany({
      where: {
        status: GroupStatus.ACTIVE,
        payoutMode: PayoutMode.CYCLE,
      },
      include: {
        members: { where: { status: "ACTIVE" }, include: { user: true } },
      },
    });

    for (const group of groups) {
      const contribs = await this.prisma.contribution.findMany({
        where: { groupId: group.id, cycleNumber: group.currentCycle },
      });
      const unpaidUsers: string[] = [];
      for (const c of contribs) {
        if (c.status === ContributionStatus.PAID) continue;
        const mem = group.members.find((m) => m.userId === c.userId);
        if (!mem) continue;
        unpaidUsers.push(mem.user.email);
        await this.notifications.create(
          c.userId,
          "Contribution reminder",
          `Reminder: complete your daily payments for ${group.name} (cycle ${group.currentCycle}). ${c.paidDayCount}/${c.expectedDayCount} recorded.`,
          "CYCLE_PAYMENT_REMINDER",
          { groupId: group.id, contributionId: c.id },
        );
      }
      if (unpaidUsers.length > 0) {
        await this.notifications.create(
          group.adminId,
          "Unpaid members",
          `${unpaidUsers.length} member(s) still owe for ${group.name} cycle ${group.currentCycle}: ${unpaidUsers.join(", ")}`,
          "ADMIN_UNPAID_REMINDER",
          { groupId: group.id, emails: unpaidUsers },
        );
      }
    }
  }

  hasBlockingDefaults(
    members: { userId: string; cycleStanding: MemberCycleStanding }[],
    allowOverride: boolean,
  ): boolean {
    if (allowOverride) return false;
    return members.some((m) => m.cycleStanding === MemberCycleStanding.DEFAULTED);
  }

  recipientBlocked(
    recipientUserId: string,
    members: { userId: string; cycleStanding: MemberCycleStanding }[],
    allowOverride: boolean,
  ): boolean {
    if (allowOverride) return false;
    const m = members.find((x) => x.userId === recipientUserId);
    return m?.cycleStanding === MemberCycleStanding.DEFAULTED;
  }
}
