import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { ContributionGuaranteeReserveService } from "../ledger-accounts/contribution-guarantee-reserve.service";
import { AdminOverviewService } from "./admin-overview.service";

type ReqUser = { user: { sub: string; role: UserRole } };

@Controller("admin")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminOverviewController {
  constructor(
    private readonly overview: AdminOverviewService,
    private readonly reserves: ContributionGuaranteeReserveService,
  ) {}

  @Get("overview")
  getOverview(@Req() req: ReqUser) {
    return this.overview.getOverview(req.user.sub);
  }

  @Get("payments")
  listPayments(@Req() req: ReqUser) {
    return this.overview.listPayments(req.user.sub);
  }

  @Get("groups/:groupId/member-reserves")
  listMemberReserves(@Req() req: ReqUser, @Param("groupId") groupId: string) {
    return this.reserves.listForGroup(groupId, req.user.sub);
  }
}
