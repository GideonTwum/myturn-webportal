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

const ADMIN_WALLET_DEPRECATED =
  "Admin earnings wallets are deprecated. Compensation is managed separately by MyTurn.";

type AuthedReq = { user: { sub: string; role: UserRole } };

@Controller("admin")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminWalletController {
  constructor(
    private withdrawals: WithdrawalsService,
    private allocation: FinancialAllocationService,
  ) {}

  /** @deprecated Admin earnings wallet removed. */
  @Get("wallet")
  wallet(@Req() req: AuthedReq) {
    return this.allocation.getAdminWalletSummary(req.user.sub);
  }

  /** @deprecated Admin earnings wallet removed. */
  @Get("wallet/activity")
  async activity(@Req() req: AuthedReq) {
    return {
      deprecated: true,
      message: ADMIN_WALLET_DEPRECATED,
      activity: [],
    };
  }

  /** @deprecated Admin earnings withdrawals removed. */
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

  /**
   * @deprecated Use GET /admin/member-withdrawals for member monitoring.
   * Returns deprecation notice; no new admin earnings withdrawals.
   */
  @Get("withdrawals")
  list(@Req() req: AuthedReq, @Query("status") status?: WithdrawalStatus) {
    return {
      deprecated: true,
      message: ADMIN_WALLET_DEPRECATED,
      withdrawals: [],
      memberWithdrawalsUrl: "/admin/member-withdrawals",
      ...(status ? {} : {}),
    };
  }

  /** Monitor automatic member withdrawals in admin's groups. */
  @Get("member-withdrawals")
  listMemberWithdrawals(
    @Req() req: AuthedReq,
    @Query("status") status?: WithdrawalStatus,
  ) {
    return this.withdrawals.listMemberWithdrawalsForAdmin(req.user.sub, status);
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
