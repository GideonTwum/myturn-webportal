import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerService } from "./ledger.service";

type ReqUser = { user: { sub: string; role: UserRole } };

@Controller("ledger")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class LedgerController {
  constructor(
    private ledger: LedgerService,
    private prisma: PrismaService,
  ) {}

  @Get("group/:groupId")
  async groupEntries(@Req() req: ReqUser, @Param("groupId") groupId: string) {
    await this.assertCanViewGroupLedger(groupId, {
      id: req.user.sub,
      role: req.user.role,
    });
    return this.ledger.listForGroup(groupId);
  }

  private async assertCanViewGroupLedger(
    groupId: string,
    viewer: { id: string; role: UserRole },
  ) {
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
