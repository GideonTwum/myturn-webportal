import { ForbiddenException, Injectable } from "@nestjs/common";
import {
  GhanaCardVerificationStatus,
  MemberAuthorizationLevel,
  UserRole,
} from "@prisma/client";
import { isStagingRelaxTrust } from "../common/staging-trust";
import { PrismaService } from "../prisma/prisma.service";

export const PARTICIPATION_LOCKED_MESSAGE =
  "Verify your Ghana Card to unlock contributions and payouts.";

@Injectable()
export class MemberParticipationService {
  constructor(private prisma: PrismaService) {}

  async assertCanParticipateFinancially(userId: string) {
    if (isStagingRelaxTrust()) return;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        isActive: true,
        memberAuthorizationLevel: true,
        ghanaCardVerificationStatus: true,
      },
    });
    if (!user?.isActive || user.role !== UserRole.USER) {
      throw new ForbiddenException("Member access only");
    }
    if (
      user.memberAuthorizationLevel !== MemberAuthorizationLevel.VERIFIED_MEMBER ||
      user.ghanaCardVerificationStatus !== GhanaCardVerificationStatus.VERIFIED
    ) {
      throw new ForbiddenException({
        message: PARTICIPATION_LOCKED_MESSAGE,
        code: "GHANA_CARD_REQUIRED",
        statusCode: 403,
      });
    }
  }

  isFinanciallyVerified(user: {
    memberAuthorizationLevel: MemberAuthorizationLevel;
    ghanaCardVerificationStatus: GhanaCardVerificationStatus;
  }) {
    if (isStagingRelaxTrust()) return true;
    return (
      user.memberAuthorizationLevel === MemberAuthorizationLevel.VERIFIED_MEMBER &&
      user.ghanaCardVerificationStatus === GhanaCardVerificationStatus.VERIFIED
    );
  }
}
