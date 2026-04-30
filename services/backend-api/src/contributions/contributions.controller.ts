import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { GroupMembersService } from "../group-members/group-members.service";
import { PrismaService } from "../prisma/prisma.service";

type ReqUser = { user: { sub: string; role: UserRole } };

@Controller("contributions")
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class ContributionsController {
  constructor(
    private prisma: PrismaService,
    private groupMembers: GroupMembersService,
  ) {}

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER)
  @Get("group/:groupId")
  async listForGroup(@Req() req: ReqUser, @Param("groupId") groupId: string) {
    await this.groupMembers.assertCanView(groupId, {
      id: req.user.sub,
      role: req.user.role,
    });
    return this.prisma.contribution.findMany({
      where: { groupId },
      orderBy: [{ cycleNumber: "asc" }, { createdAt: "asc" }],
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }
}
