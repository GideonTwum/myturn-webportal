import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole, WithdrawalStatus } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { FinancialAllocationService } from "../ledger-accounts/financial-allocation.service";
import { ConfirmWithdrawalDto, CreateWithdrawalDto, FailWithdrawalDto } from "./dto/create-withdrawal.dto";
import { WithdrawalsService } from "./withdrawals.service";

type AuthedReq = { user: { sub: string; role: UserRole } };

@Controller("admin")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminWalletController {
  constructor(
    private withdrawals: WithdrawalsService,
    private allocation: FinancialAllocationService,
  ) {}

  @Get("wallet")
  wallet(@Req() req: AuthedReq) {
    return this.allocation.getAdminWalletSummary(req.user.sub);
  }

  @Get("wallet/activity")
  async activity(@Req() req: AuthedReq) {
    const summary = await this.allocation.getAdminWalletSummary(req.user.sub);
    return this.allocation.listAccountActivity(summary.accountId);
  }

  @Post("withdrawals")
  create(
    @Req() req: AuthedReq,
    @Body() body: CreateWithdrawalDto,
    @Headers("x-idempotency-key") idempotencyKey?: string,
  ) {
    return this.withdrawals.createAdminWithdrawal(
      req.user.sub,
      body.amount,
      body.momoNumber,
      idempotencyKey,
    );
  }

  @Get("withdrawals")
  list(@Req() req: AuthedReq, @Query("status") status?: WithdrawalStatus) {
    return this.withdrawals.listForAdmin(req.user.sub, status);
  }
}

@Controller("hq")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class HqWithdrawalsController {
  constructor(private withdrawals: WithdrawalsService) {}

  @Get("withdrawals")
  list(@Query("status") status?: WithdrawalStatus) {
    return this.withdrawals.listForHq(status);
  }

  /** Exceptional manual override when webhook/poll missed a successful transfer. */
  @Patch("withdrawals/:id/confirm")
  async confirm(
    @Req() req: AuthedReq,
    @Param("id") id: string,
    @Body() body: ConfirmWithdrawalDto,
  ) {
    await this.withdrawals.assertHqManualOverride(req.user.sub, id);
    return this.withdrawals.confirmWithdrawal(
      id,
      req.user.sub,
      body.providerRef,
      body.provider ?? "manual-override",
    );
  }

  @Patch("withdrawals/:id/fail")
  async fail(
    @Req() req: AuthedReq,
    @Param("id") id: string,
    @Body() body: FailWithdrawalDto,
  ) {
    return this.withdrawals.hqFailStuckWithdrawal(
      id,
      req.user.sub,
      body.reason,
    );
  }
}
