import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { ApiWrapped } from "../common/decorators/api-wrapped.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { ReviewVerificationDto } from "./dto/review-verification.dto";
import { SubmitGhanaCardDto } from "./dto/submit-ghana-card.dto";
import { MemberVerificationService } from "./member-verification.service";

type AuthedReq = { user: { sub: string; role: UserRole } };

@ApiWrapped()
@Controller("member/verification")
export class MemberVerificationController {
  constructor(private verification: MemberVerificationService) {}

  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.USER)
  @Get("status")
  status(@Req() req: AuthedReq) {
    return this.verification.getTrustProfile(req.user.sub);
  }

  @UseGuards(AuthGuard("jwt"), RolesGuard)
  @Roles(UserRole.USER)
  @Post("ghana-card")
  submit(@Req() req: AuthedReq, @Body() body: SubmitGhanaCardDto) {
    return this.verification.submitGhanaCard(req.user.sub, body);
  }
}

@ApiWrapped()
@Controller("admin/member-verifications")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminMemberVerificationController {
  constructor(private verification: MemberVerificationService) {}

  @Get("pending")
  listPending() {
    return this.verification.listPendingForReview();
  }

  @Patch(":userId")
  review(
    @Req() req: AuthedReq,
    @Param("userId") userId: string,
    @Body() body: ReviewVerificationDto,
  ) {
    return this.verification.reviewVerification(
      req.user.sub,
      userId,
      body.approve,
      body.reason,
    );
  }
}
