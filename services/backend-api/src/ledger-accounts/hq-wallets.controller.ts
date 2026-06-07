import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { HqWalletsSummaryService } from "./hq-wallets-summary.service";

@Controller("hq/wallets")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class HqWalletsController {
  constructor(private summary: HqWalletsSummaryService) {}

  @Get("summary")
  getSummary() {
    return this.summary.getSummary();
  }
}
