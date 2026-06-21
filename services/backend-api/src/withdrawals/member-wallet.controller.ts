import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { ApiWrapped } from "../common/decorators/api-wrapped.decorator";
import { RequireVerifiedMember } from "../common/decorators/require-verified-member.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { VerifiedMemberGuard } from "../common/guards/verified-member.guard";
import { DefaultProtectionService } from "../cycle-risk/default-protection.service";
import { FinancialAllocationService } from "../ledger-accounts/financial-allocation.service";
import { CreateWithdrawalDto } from "./dto/create-withdrawal.dto";
import { WithdrawalsService } from "./withdrawals.service";

type AuthedReq = { user: { sub: string; role: UserRole } };

@ApiWrapped()
@Controller("member")
@UseGuards(AuthGuard("jwt"), RolesGuard, VerifiedMemberGuard)
@Roles(UserRole.USER)
export class MemberWalletController {
  constructor(
    private allocation: FinancialAllocationService,
    private withdrawals: WithdrawalsService,
    private defaultProtection: DefaultProtectionService,
  ) {}

  @Get("wallet")
  async wallet(@Req() req: AuthedReq) {
    const [summary, reserveDefaultCoverPrompt] = await Promise.all([
      this.allocation.getMemberWalletSummary(req.user.sub),
      this.defaultProtection.getRecentReserveDefaultCoverPrompt(req.user.sub),
    ]);
    return { ...summary, reserveDefaultCoverPrompt };
  }

  @Get("wallet/activity")
  async activity(@Req() req: AuthedReq) {
    const summary = await this.allocation.getMemberWalletSummary(req.user.sub);
    return this.allocation.listAccountActivity(summary.accountId);
  }

  @RequireVerifiedMember()
  @Post("withdrawals")
  create(
    @Req() req: AuthedReq,
    @Body() body: CreateWithdrawalDto,
    @Headers("x-idempotency-key") idempotencyKey?: string,
  ) {
    return this.withdrawals.createMemberWithdrawal(
      req.user.sub,
      body.amount,
      body.momoNumber,
      idempotencyKey,
    );
  }

  @Get("withdrawals")
  list(@Req() req: AuthedReq) {
    return this.withdrawals.listForActor(req.user.sub);
  }
}
