import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { AdminOverviewService } from "./admin-overview.service";

type ReqUser = { user: { sub: string; role: UserRole } };

@Controller("admin")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminOverviewController {
  constructor(private readonly overview: AdminOverviewService) {}

  @Get("overview")
  getOverview(@Req() req: ReqUser) {
    return this.overview.getOverview(req.user.sub);
  }
}
