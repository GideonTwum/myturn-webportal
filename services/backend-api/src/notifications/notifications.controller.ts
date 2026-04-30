import { Controller, Get, Param, Patch, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { NotificationsService } from "./notifications.service";

type ReqUser = { user: { sub: string; role: UserRole } };

@Controller("notifications")
@UseGuards(AuthGuard("jwt"))
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  list(@Req() req: ReqUser) {
    return this.notifications.listForUser(req.user.sub);
  }

  @Patch(":id/read")
  markRead(@Req() req: ReqUser, @Param("id") id: string) {
    return this.notifications.markRead(req.user.sub, id);
  }
}
