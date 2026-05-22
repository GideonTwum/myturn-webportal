import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  GhanaCardVerificationStatus,
  MemberAuthorizationLevel,
  UserRole,
} from "@prisma/client";
import { isStagingRelaxTrust } from "../common/staging-trust";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
  hashGhanaCardNumber,
  maskGhanaCardLast4,
  normalizeGhanaCardNumber,
  sanitizeAssetKey,
} from "./ghana-card.util";

@Injectable()
export class MemberVerificationService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async getTrustProfile(userId: string) {
    const user = await this.getMemberUser(userId);
    return this.toTrustProfile(user);
  }

  async submitGhanaCard(
    userId: string,
    input: {
      ghanaCardNumber: string;
      selfieAssetKey?: string;
      cardImageAssetKey?: string;
    },
  ) {
    const user = await this.getMemberUser(userId);
    if (
      user.ghanaCardVerificationStatus === GhanaCardVerificationStatus.VERIFIED
    ) {
      throw new BadRequestException("You are already verified");
    }
    if (user.ghanaCardVerificationStatus === GhanaCardVerificationStatus.PENDING) {
      throw new BadRequestException("Verification is already under review");
    }

    const normalized = normalizeGhanaCardNumber(input.ghanaCardNumber);
    const hash = hashGhanaCardNumber(normalized);
    const last4 = maskGhanaCardLast4(normalized);

    if (!isStagingRelaxTrust()) {
      const duplicate = await this.prisma.user.findFirst({
        where: {
          ghanaCardNumberHash: hash,
          id: { not: userId },
          ghanaCardVerificationStatus: GhanaCardVerificationStatus.VERIFIED,
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictException(
          "This Ghana Card is already linked to another verified member",
        );
      }
    }

    const autoApprove = isStagingRelaxTrust();
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ghanaCardNumberHash: hash,
        ghanaCardLast4: last4,
        ghanaCardVerificationStatus: autoApprove
          ? GhanaCardVerificationStatus.VERIFIED
          : GhanaCardVerificationStatus.PENDING,
        memberAuthorizationLevel: autoApprove
          ? MemberAuthorizationLevel.VERIFIED_MEMBER
          : user.memberAuthorizationLevel,
        verificationSubmittedAt: new Date(),
        verificationApprovedAt: autoApprove ? new Date() : null,
        verificationRejectedAt: null,
        verificationRejectionReason: null,
        selfieAssetKey: sanitizeAssetKey(input.selfieAssetKey),
        cardImageAssetKey: sanitizeAssetKey(input.cardImageAssetKey),
      },
    });

    await this.notifications.create(
      userId,
      autoApprove ? "Identity verified (staging)" : "Verification submitted",
      autoApprove
        ? "Ghana Card auto-approved for testing. You can join and contribute."
        : "Your Ghana Card is being reviewed. We'll notify you when approved.",
      autoApprove ? "VERIFICATION_APPROVED" : "VERIFICATION_PENDING",
    );

    return this.toTrustProfile(updated);
  }

  async listPendingForReview() {
    const rows = await this.prisma.user.findMany({
      where: {
        role: UserRole.USER,
        ghanaCardVerificationStatus: GhanaCardVerificationStatus.PENDING,
      },
      orderBy: { verificationSubmittedAt: "asc" },
      take: 100,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        ghanaCardLast4: true,
        verificationSubmittedAt: true,
        selfieAssetKey: true,
        cardImageAssetKey: true,
      },
    });
    return { pending: rows };
  }

  async reviewVerification(
    reviewerId: string,
    userId: string,
    approve: boolean,
    reason?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== UserRole.USER) {
      throw new NotFoundException("Member not found");
    }
    if (user.ghanaCardVerificationStatus !== GhanaCardVerificationStatus.PENDING) {
      throw new BadRequestException("Member is not pending verification");
    }

    if (approve) {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ghanaCardVerificationStatus: GhanaCardVerificationStatus.VERIFIED,
          memberAuthorizationLevel: MemberAuthorizationLevel.VERIFIED_MEMBER,
          verificationApprovedAt: new Date(),
          verificationRejectedAt: null,
          verificationRejectionReason: null,
        },
      });
      await this.notifications.create(
        userId,
        "Identity verified",
        "Your Ghana Card was approved. You can now contribute and receive payouts.",
        "VERIFICATION_APPROVED",
      );
      return this.toTrustProfile(updated);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ghanaCardVerificationStatus: GhanaCardVerificationStatus.REJECTED,
        verificationRejectedAt: new Date(),
        verificationRejectionReason: reason?.trim() || "Verification rejected",
        ghanaCardNumberHash: null,
        ghanaCardLast4: null,
      },
    });
    await this.notifications.create(
      userId,
      "Verification needs attention",
      updated.verificationRejectionReason ?? "Please resubmit your Ghana Card.",
      "VERIFICATION_REJECTED",
    );
    return this.toTrustProfile(updated);
  }

  private async getMemberUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isActive || user.role !== UserRole.USER) {
      throw new NotFoundException("Member not found");
    }
    return user;
  }

  private toTrustProfile(user: {
    memberAuthorizationLevel: MemberAuthorizationLevel;
    ghanaCardVerificationStatus: GhanaCardVerificationStatus;
    ghanaCardLast4: string | null;
    verificationSubmittedAt: Date | null;
    verificationApprovedAt: Date | null;
    verificationRejectedAt: Date | null;
    verificationRejectionReason: string | null;
    completedGroupsCount: number;
    missedContributionCount: number;
    contributionStreak: number;
    trustScore: number;
  }) {
    const relax = isStagingRelaxTrust();
    const phoneVerified = true;
    const ghanaCardVerified =
      relax ||
      user.ghanaCardVerificationStatus === GhanaCardVerificationStatus.VERIFIED;
    const canContribute =
      relax ||
      (user.memberAuthorizationLevel === MemberAuthorizationLevel.VERIFIED_MEMBER &&
        user.ghanaCardVerificationStatus === GhanaCardVerificationStatus.VERIFIED);

    return {
      memberAuthorizationLevel: user.memberAuthorizationLevel,
      ghanaCardVerificationStatus: user.ghanaCardVerificationStatus,
      ghanaCardMasked: user.ghanaCardLast4
        ? `GHA-*******-${user.ghanaCardLast4}`
        : null,
      verificationSubmittedAt:
        user.verificationSubmittedAt?.toISOString() ?? null,
      verificationApprovedAt:
        user.verificationApprovedAt?.toISOString() ?? null,
      verificationRejectedAt:
        user.verificationRejectedAt?.toISOString() ?? null,
      verificationRejectionReason: user.verificationRejectionReason,
      trust: {
        completedGroupsCount: user.completedGroupsCount,
        missedContributionCount: user.missedContributionCount,
        contributionStreak: user.contributionStreak,
        trustScore: user.trustScore,
      },
      unlocks: {
        phoneVerified,
        ghanaCardVerified,
        canViewGroups: phoneVerified,
        canContribute,
        canReceivePayouts: canContribute,
      },
      onboardingSteps: [
        { id: "phone", label: "Phone verification", complete: phoneVerified },
        { id: "otp", label: "OTP confirmed", complete: phoneVerified },
        {
          id: "groups",
          label: "View groups",
          complete: phoneVerified,
        },
        {
          id: "ghana_card",
          label: "Ghana Card verification",
          complete: ghanaCardVerified,
        },
        {
          id: "participation",
          label: "Join & contribute",
          complete: canContribute,
        },
      ],
      stagingRelaxTrust: isStagingRelaxTrust(),
    };
  }
}
