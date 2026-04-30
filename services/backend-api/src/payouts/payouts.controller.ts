import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { PayoutsService } from "./payouts.service";

type ReqUser = { user: { sub: string; role: UserRole } };

/**
 * Payouts API. Cycle finalization is **mock / staging** (ledger + DB only), not MoMo disbursement.
 *
 * Staging-only: `POST .../mock/finalize-cycle`
 */
@Controller("payouts")
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class PayoutsController {
  constructor(private payouts: PayoutsService) {}

  /**
   * Mock / manual cycle completion: records payout + margin split when all contributions are paid.
   * Not a real MoMo disbursement yet; use for staging until payout provider is integrated.
   */
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post("mock/finalize-cycle")
  mockFinalizeCycle(
    @Req() req: ReqUser,
    @Body() body: { groupId: string; cycleNumber: number },
  ) {
    return this.payouts.finalizeCycle(
      body.groupId,
      body.cycleNumber,
      req.user.sub,
      req.user.role,
    );
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Get("group/:groupId")
  listForGroup(@Req() req: ReqUser, @Param("groupId") groupId: string) {
    return this.payouts.listForGroup(groupId, {
      id: req.user.sub,
      role: req.user.role,
    });
  }
}
