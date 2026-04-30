import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { AdminEarningsService } from "./admin-earnings.service";

type ReqUser = { user: { sub: string; role: UserRole } };

@Controller("admin-earnings")
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class AdminEarningsController {
  constructor(private earnings: AdminEarningsService) {}

  @Roles(UserRole.ADMIN)
  @Get("mine")
  mine(@Req() req: ReqUser) {
    return this.earnings.listForAdmin(req.user.sub);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get()
  all(@Req() req: ReqUser) {
    void req;
    return this.earnings.listAll();
  }
}
