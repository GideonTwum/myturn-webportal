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
import { MockFeaturesGuard } from "../common/guards/mock-features.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { PayoutsService } from "./payouts.service";

type ReqUser = { user: { sub: string; role: UserRole } };

/**
 * Payouts API. Cycle finalization credits recipient, admin, and MyTurn revenue wallets.
 *
 * Staging: `POST .../mock/finalize-cycle` (MockFeaturesGuard in non-production)
 */
@Controller("payouts")
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class PayoutsController {
  constructor(private payouts: PayoutsService) {}

  /**
   * Mock / manual cycle completion: records payout + margin split when all contributions are paid.
   * Not a real MoMo disbursement yet; use for staging until payout provider is integrated.
   */
  @UseGuards(MockFeaturesGuard)
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
