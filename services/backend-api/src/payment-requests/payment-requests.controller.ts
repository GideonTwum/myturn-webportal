import { Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { ApiWrapped } from "../common/decorators/api-wrapped.decorator";
import { RequireVerifiedMember } from "../common/decorators/require-verified-member.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { MockFeaturesGuard } from "../common/guards/mock-features.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { VerifiedMemberGuard } from "../common/guards/verified-member.guard";
import { PaymentRequestsService } from "./payment-requests.service";

type AuthedReq = { user: { sub: string; role: UserRole } };

@ApiWrapped()
@Controller("member/payment-requests")
@UseGuards(AuthGuard("jwt"), RolesGuard, VerifiedMemberGuard)
@Roles(UserRole.USER)
export class PaymentRequestsController {
  constructor(private paymentRequests: PaymentRequestsService) {}

  @RequireVerifiedMember()
  @Post("contributions/:contributionId/initiate")
  initiate(
    @Req() req: AuthedReq,
    @Param("contributionId") contributionId: string,
  ) {
    return this.paymentRequests.initiateContributionPayment(
      req.user.sub,
      contributionId,
    );
  }

  @Get(":id")
  get(@Req() req: AuthedReq, @Param("id") id: string) {
    return this.paymentRequests.getRequest(req.user.sub, id);
  }

  @UseGuards(MockFeaturesGuard)
  @RequireVerifiedMember()
  @Post(":id/mock-approve")
  mockApprove(@Req() req: AuthedReq, @Param("id") id: string) {
    return this.paymentRequests.mockApprove(req.user.sub, id);
  }
}
