import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { pingRedis } from "../auth/otp/otp-store.factory";
import { createPaymentProvider } from "../payments/providers/placeholder-providers";
import {
  getPlatformFeatureFlags,
  getPublicApiBaseUrl,
  getDeploymentTier,
} from "../common/platform-env";

@Injectable()
export class HealthService {
  constructor(private prisma: PrismaService) {}

  async getHealth() {
    const tier = getDeploymentTier();
    const flags = getPlatformFeatureFlags();
    const checks: Record<string, "ok" | "error" | "skipped"> = {
      database: "ok",
      notifications: "ok",
      redis: "skipped",
    };

    const redisUrl = process.env.REDIS_URL?.trim();
    if (redisUrl) {
      checks.redis = (await pingRedis(redisUrl)) ? "ok" : "error";
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      checks.database = "error";
    }

    try {
      await this.prisma.notification.count();
    } catch {
      checks.notifications = "error";
    }

    const degraded = Object.entries(checks).some(
      ([, v]) => v === "error",
    );

    return {
      status: degraded ? "degraded" : "ok",
      service: "myturn-backend-api",
      environment: tier,
      apiBaseUrl: getPublicApiBaseUrl(),
      timestamp: new Date().toISOString(),
      checks,
      featureFlags: {
        mockPayments: flags.mockPayments,
        mockPayoutFinalize: flags.mockPayoutFinalize,
        stagingRelaxTrust: flags.stagingRelaxTrust,
        debugOtpInResponses: flags.debugOtpInResponses,
        memberPhoneLogin: flags.memberPhoneLogin,
      },
      warnings: this.collectWarnings(tier, flags),
      infrastructure: {
        otpStore: redisUrl ? "redis" : "memory",
        paymentProvider: createPaymentProvider().name,
        smsProvider: process.env.SMS_PROVIDER?.trim() ?? "console",
        idempotency: redisUrl ? "redis" : "memory",
      },
    };
  }

  private collectWarnings(
    tier: string,
    flags: ReturnType<typeof getPlatformFeatureFlags>,
  ): string[] {
    const warnings: string[] = [];
    if (tier !== "production" && flags.allowOpenCors) {
      warnings.push("CORS_ORIGIN unset — any origin allowed (dev/staging only)");
    }
    if (flags.mockPayments) {
      warnings.push("Mock MoMo payment flows are enabled");
    }
    if (flags.stagingRelaxTrust) {
      warnings.push("Trust gates relaxed for staging");
    }
    return warnings;
  }
}
