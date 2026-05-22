import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { GroupMemberStatus, UserRole } from "@prisma/client";
import { GroupsService } from "../groups/groups.service";
import { PrismaService } from "../prisma/prisma.service";
import { DeviceTokensService } from "./device-tokens.service";

@Injectable()
export class MemberService {
  constructor(
    private prisma: PrismaService,
    private groups: GroupsService,
    private deviceTokens: DeviceTokensService,
  ) {}

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        memberAuthorizationLevel: true,
        ghanaCardVerificationStatus: true,
        createdAt: true,
      },
    });
    if (!user || user.role !== UserRole.USER) {
      throw new ForbiddenException("Member access only");
    }
    return user;
  }

  async listGroups(userId: string) {
    await this.assertMember(userId);
    return this.groups.getMemberParticipation(userId);
  }

  async getGroup(userId: string, groupId: string) {
    await this.assertMember(userId);
    const membership = await this.prisma.groupMember.findFirst({
      where: {
        userId,
        groupId,
        status: GroupMemberStatus.ACTIVE,
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            contributionAmount: true,
            daysPerCycle: true,
            payoutMode: true,
            memberSlots: true,
            currentCycle: true,
            groupStartDate: true,
            groupEndDate: true,
          },
        },
      },
    });
    if (!membership) {
      throw new NotFoundException("Group not found");
    }

    const participation = await this.groups.getMemberParticipation(userId);
    const summary = participation.memberships.find(
      (m) => m.groupId === groupId,
    );
    if (!summary) {
      throw new NotFoundException("Group not found");
    }

    const g = membership.group;
    return {
      ...summary,
      description: g.description,
      groupStartDate: g.groupStartDate?.toISOString() ?? null,
      estimatedEndDate: g.groupEndDate?.toISOString() ?? null,
    };
  }

  async listPayouts(userId: string) {
    await this.assertMember(userId);
    const rows = await this.prisma.payout.findMany({
      where: { recipientId: userId },
      include: {
        group: { select: { id: true, name: true, currentCycle: true } },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
    });

    return {
      payouts: rows.map((p) => ({
        id: p.id,
        groupId: p.groupId,
        groupName: p.group.name,
        cycleNumber: p.cycleNumber,
        amount: p.amount.toString(),
        status: p.status,
        paidAt: p.paidAt?.toISOString() ?? null,
        isUpcoming:
          p.status === "PENDING" && p.cycleNumber >= p.group.currentCycle,
      })),
    };
  }

  async listPayments(userId: string) {
    await this.assertMember(userId);
    const rows = await this.prisma.payment.findMany({
      where: { userId },
      include: {
        group: { select: { id: true, name: true } },
        contribution: { select: { cycleNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return {
      payments: rows.map((p) => ({
        id: p.id,
        groupId: p.groupId,
        groupName: p.group?.name ?? null,
        amount: p.amount.toString(),
        type: p.type,
        status: p.status,
        completedAt: p.completedAt?.toISOString() ?? null,
        cycleNumber: p.contribution?.cycleNumber ?? null,
      })),
    };
  }

  async listNotifications(userId: string) {
    await this.assertMember(userId);
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        read: true,
        createdAt: true,
      },
    });
    return {
      notifications: rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  }

  registerDevice(
    userId: string,
    token: string,
    platform: "ios" | "android" | "web",
  ) {
    return this.deviceTokens.register(userId, token, platform);
  }

  private async assertMember(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true },
    });
    if (!user?.isActive || user.role !== UserRole.USER) {
      throw new ForbiddenException("Member access only");
    }
  }
}
