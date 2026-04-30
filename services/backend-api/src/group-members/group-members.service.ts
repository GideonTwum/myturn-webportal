import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DepositStatus,
  GroupStatus,
  UserRole,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { CycleDepositsService } from "../cycle-risk/cycle-deposits.service";

@Injectable()
export class GroupMembersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditLogsService,
    private deposits: CycleDepositsService,
  ) {}

  async addMember(params: {
    groupId: string;
    adminId: string;
    userId: string;
    turnOrder: number;
  }) {
    const group = await this.prisma.group.findUnique({
      where: { id: params.groupId },
      include: { members: true },
    });
    if (!group) {
      throw new NotFoundException("Group not found");
    }
    if (group.status !== GroupStatus.DRAFT) {
      throw new BadRequestException(
        "Members can only be added while the group is in draft",
      );
    }
    if (group.adminId !== params.adminId) {
      throw new ForbiddenException();
    }
    if (group.members.length >= group.memberSlots) {
      throw new BadRequestException("Group is full");
    }
    const exists = group.members.some((m) => m.userId === params.userId);
    if (exists) {
      throw new ConflictException("User already in group");
    }
    const orderTaken = group.members.some((m) => m.turnOrder === params.turnOrder);
    if (orderTaken) {
      throw new ConflictException("Turn order already used");
    }

    const member = await this.prisma.$transaction(async (tx) => {
      const m = await tx.groupMember.create({
        data: {
          groupId: params.groupId,
          userId: params.userId,
          turnOrder: params.turnOrder,
          depositAmount: 0,
          depositStatus: DepositStatus.NOT_REQUIRED,
        },
      });
      const dep = await this.deposits.applyDepositOnJoin(tx, {
        userId: params.userId,
        groupId: params.groupId,
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
      actorId: params.adminId,
      action: "GROUP_MEMBER_ADD",
      entityType: "GroupMember",
      entityId: member.id,
      metadata: { groupId: params.groupId, userId: params.userId },
    });
    return member;
  }

  async assertCanView(groupId: string, viewer: { id: string; role: UserRole }) {
    const group = await this.prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      throw new NotFoundException("Group not found");
    }
    if (viewer.role === UserRole.SUPER_ADMIN) {
      return;
    }
    if (viewer.role === UserRole.ADMIN && group.adminId === viewer.id) {
      return;
    }
    const member = await this.prisma.groupMember.findFirst({
      where: { groupId, userId: viewer.id, status: "ACTIVE" },
    });
    if (!member) {
      throw new ForbiddenException();
    }
  }
}
