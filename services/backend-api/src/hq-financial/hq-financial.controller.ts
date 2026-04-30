import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import {
  HqEarningsBreakdownQueryDto,
  HqPayoutHistoryQueryDto,
} from "./dto/hq-financial-query.dto";
import { HqFinancialService } from "./hq-financial.service";

type ReqUser = { user: { sub: string; role: UserRole } };

/**
 * MyTurn HQ only — platform-wide earnings, margins, and member payout history.
 * Paths are under global prefix /api (e.g. GET /api/hq/financial-overview).
 */
@Controller("hq")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class HqFinancialController {
  constructor(private readonly hqFinancial: HqFinancialService) {}

  @Get("overview")
  overview(@Req() _req: ReqUser) {
    void _req;
    return this.hqFinancial.getHqOverview();
  }

  @Get("financial-overview")
  financialOverview(@Req() _req: ReqUser) {
    void _req;
    return this.hqFinancial.getFinancialOverview();
  }

  @Get("earnings")
  earningsBreakdown(@Query() query: HqEarningsBreakdownQueryDto) {
    return this.hqFinancial.getEarningsBreakdown(query);
  }

  @Get("payouts")
  payoutHistory(@Query() query: HqPayoutHistoryQueryDto) {
    return this.hqFinancial.getPayoutHistory(query);
  }
}
