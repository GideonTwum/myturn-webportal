import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { ApiWrapped } from "../common/decorators/api-wrapped.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { FinancialAllocationService } from "../ledger-accounts/financial-allocation.service";
import { CreateWithdrawalDto } from "./dto/create-withdrawal.dto";
import { WithdrawalsService } from "./withdrawals.service";

type AuthedReq = { user: { sub: string; role: UserRole } };

@ApiWrapped()
@Controller("member")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles(UserRole.USER)
export class MemberWalletController {
  constructor(
    private allocation: FinancialAllocationService,
    private withdrawals: WithdrawalsService,
  ) {}

  @Get("wallet")
  wallet(@Req() req: AuthedReq) {
    return this.allocation.getMemberWalletSummary(req.user.sub);
  }

  @Get("wallet/activity")
  async activity(@Req() req: AuthedReq) {
    const summary = await this.allocation.getMemberWalletSummary(req.user.sub);
    return this.allocation.listAccountActivity(summary.accountId);
  }

  @Post("withdrawals")
  create(@Req() req: AuthedReq, @Body() body: CreateWithdrawalDto) {
    return this.withdrawals.createMemberWithdrawal(
      req.user.sub,
      body.amount,
      body.momoNumber,
    );
  }

  @Get("withdrawals")
  list(@Req() req: AuthedReq) {
    return this.withdrawals.listForActor(req.user.sub);
  }
}
