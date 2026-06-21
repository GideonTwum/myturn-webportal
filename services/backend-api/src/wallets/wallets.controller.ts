import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { FinancialAllocationService } from "../ledger-accounts/financial-allocation.service";

type ReqUser = { user: { sub: string; role: UserRole } };

/** @deprecated Prefer GET /member-wallet/me — reads canonical ledger, not legacy Wallet row. */
@Controller("wallets")
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class WalletsController {
  constructor(private allocation: FinancialAllocationService) {}

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER)
  @Get("me")
  me(@Req() req: ReqUser) {
    return this.allocation.getMemberWalletSummary(req.user.sub);
  }
}
