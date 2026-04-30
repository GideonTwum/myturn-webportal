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
import { PaymentsService } from "./payments.service";

type ReqUser = { user: { sub: string; role: UserRole } };

/**
 * Payments API. All write paths for contributions are **mock / staging** until MoMo is integrated.
 * Real-time PSP: not implemented.
 *
 * Staging-only: `POST .../mock/contribution-payment`
 */
@Controller("payments")
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  /**
   * Mock / manual contribution payment for staging.
   * Mobile Money (MoMo) integration is not wired yet.
   */
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER)
  @Post("mock/contribution-payment")
  mockContributionPayment(
    @Req() req: ReqUser,
    @Body() body: { contributionId: string },
  ) {
    return this.payments.mockRecordContributionPayment(
      body.contributionId,
      req.user.sub,
      req.user.role,
    );
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Get("group/:groupId")
  listForGroup(@Req() req: ReqUser, @Param("groupId") groupId: string) {
    return this.payments.listForGroup(groupId, {
      id: req.user.sub,
      role: req.user.role,
    });
  }
}
