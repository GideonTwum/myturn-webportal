import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { pingRedis } from "../auth/otp/otp-store.factory";
import { pingArkesel } from "../auth/otp/arkesel-sms.provider";
import { getOtpMetrics } from "../auth/otp/otp-telemetry";
import {
  createPaymentProvider,
  pingPaymentProvider,
} from "../payments/providers/placeholder-providers";
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
    let redisPingError: string | undefined;
    if (redisUrl) {
      const ping = await pingRedis(redisUrl);
      checks.redis = ping.ok ? "ok" : "error";
      redisPingError = ping.error;
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

    const smsProvider = process.env.SMS_PROVIDER?.trim().toLowerCase() ?? "console";
    const smsHealth =
      smsProvider === "arkesel" ? await pingArkesel() : "ok";
    const paymentHealth = await pingPaymentProvider();
    const paymentProviderName = createPaymentProvider().name;
    const reconciliationEnabled =
      process.env.ENABLE_RECONCILIATION_JOB?.trim() !== "false";

    const stagingSeed = await this.checkStagingSeed();

    const degraded =
      Object.entries(checks).some(([, v]) => v === "error") ||
      smsHealth === "error" ||
      paymentHealth === "error";

    return {
      status: degraded ? "degraded" : "ok",
      service: "myturn-backend-api",
      environment: tier,
      deploymentTier: tier,
      uptimeSeconds: Math.floor(process.uptime()),
      apiBaseUrl: getPublicApiBaseUrl(),
      timestamp: new Date().toISOString(),
      checks,
      stagingSeed,
      featureFlags: {
        mockPayments: flags.mockPayments,
        mockPayoutFinalize: flags.mockPayoutFinalize,
        stagingRelaxTrust: flags.stagingRelaxTrust,
        debugOtpInResponses: flags.debugOtpInResponses,
        memberPhoneLogin: flags.memberPhoneLogin,
      },
      warnings: this.collectWarnings(tier, flags, stagingSeed, checks.redis),
      infrastructure: {
        otpStore: redisUrl ? "redis" : "memory",
        otpMetrics: getOtpMetrics(),
        sms: {
          provider: smsProvider,
          health: smsHealth,
        },
        payment: {
          provider: paymentProviderName,
          health: paymentHealth,
        },
        webhooks: {
          signatureVerification: true,
          replayProtection: "idempotency",
          health: "ok",
        },
        reconciliation: {
          enabled: reconciliationEnabled,
          schedule: "*/30 * * * *",
          health: reconciliationEnabled ? "ok" : "disabled",
        },
        idempotency: redisUrl ? "redis" : "memory",
        redis: {
          configured: Boolean(redisUrl),
          check: checks.redis,
          otpStore: redisUrl ? "redis" : "memory",
          idempotency: redisUrl ? "redis" : "memory",
          rolloutReady: Boolean(redisUrl && checks.redis === "ok"),
          ...(redisPingError ? { lastPingError: redisPingError } : {}),
        },
      },
    };
  }

  private collectWarnings(
    tier: string,
    flags: ReturnType<typeof getPlatformFeatureFlags>,
    stagingSeed: Awaited<ReturnType<HealthService["checkStagingSeed"]>>,
    redisCheck: "ok" | "error" | "skipped",
  ): string[] {
    const warnings: string[] = [];
    const redisUrl = process.env.REDIS_URL?.trim();
    if (tier !== "production" && flags.allowOpenCors) {
      warnings.push("CORS_ORIGIN unset — any origin allowed (dev/staging only)");
    }
    if (redisUrl && redisCheck === "error") {
      warnings.push(
        "REDIS_URL is set but Redis ping failed — use private redis://…railway.internal URL with ?family=0 (see docs/RAILWAY_REDIS.md)",
      );
    }
    if (tier === "staging" && !redisUrl) {
      warnings.push(
        "REDIS_URL unset — OTP uses memory store (lost on redeploy). See docs/RAILWAY_REDIS.md",
      );
    }
    if (flags.mockPayments) {
      warnings.push("Mock MoMo payment flows are enabled");
    }
    if (flags.stagingRelaxTrust) {
      warnings.push("Trust gates relaxed for staging");
    }
    if (flags.debugOtpInResponses) {
      warnings.push("Debug OTP codes may appear in API responses");
    }
    if (stagingSeed.status === "missing" && tier !== "production") {
      warnings.push(
        `Staging seed incomplete — run npm run db:seed && npm run seed:staging:railway (missing: ${(stagingSeed.missing ?? []).join(", ")})`,
      );
    }
    return warnings;
  }

  private async checkStagingSeed(): Promise<{
    status: "ok" | "missing" | "skipped";
    inviteCodes?: string[];
    missing?: string[];
  }> {
    const tier = getDeploymentTier();
    if (tier === "production") {
      return { status: "skipped" };
    }
    const required = ["STAGING-DEMO", "STAGING-PAY"];
    try {
      const groups = await this.prisma.group.findMany({
        where: { inviteCode: { in: required } },
        select: { inviteCode: true },
      });
      const found = groups.map((g) => g.inviteCode);
      const missing = required.filter((c) => !found.includes(c));
      if (missing.length > 0) {
        return { status: "missing", inviteCodes: found, missing };
      }
      return { status: "ok", inviteCodes: found };
    } catch {
      return { status: "missing", missing: required };
    }
  }
}
