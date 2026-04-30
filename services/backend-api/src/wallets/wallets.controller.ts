import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { WalletsService } from "./wallets.service";

type ReqUser = { user: { sub: string; role: UserRole } };

@Controller("wallets")
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class WalletsController {
  constructor(private wallets: WalletsService) {}

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER)
  @Get("me")
  me(@Req() req: ReqUser) {
    return this.wallets.getOrCreate(req.user.sub);
  }
}
