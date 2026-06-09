import { Injectable } from "@nestjs/common";
import { WithdrawalStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { pingRedis } from "../common/redis-connection.util";
import { pingArkesel } from "../auth/otp/arkesel-sms.provider";
import { getOtpMetrics } from "../auth/otp/otp-telemetry";
import {
  createPaymentProvider,
  pingPaymentProvider,
} from "../payments/providers/placeholder-providers";
import { createDisbursementProvider } from "../withdrawals/providers/create-disbursement-provider";
import { pingDisbursementProvider } from "../withdrawals/providers/ping-disbursement-provider";
import {
  getArkeselReadiness,
  getMtnCollectionReadiness,
  getMtnDisbursementReadiness,
  hasWebhookSecret,
} from "../common/provider-readiness";
import {
  getPlatformFeatureFlags,
  getPublicApiBaseUrl,
  getDeploymentTier,
} from "../common/platform-env";
import { getStaleWithdrawalThresholdMs } from "../withdrawals/withdrawal-limits";

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

    const collectionReadiness = getMtnCollectionReadiness();
    const disbursementReadiness = getMtnDisbursementReadiness();
    const arkeselReadiness = getArkeselReadiness();
    const smsProvider = process.env.SMS_PROVIDER?.trim().toLowerCase() ?? "console";
    const smsHealth =
      smsProvider === "arkesel" ? await pingArkesel() : arkeselReadiness.health;
    const paymentHealth = await pingPaymentProvider();
    const disbursementHealth = await pingDisbursementProvider();
    const paymentProviderName = createPaymentProvider().name;
    const disbursementProviderName = createDisbursementProvider().name;
    const reconciliationEnabled =
      process.env.ENABLE_RECONCILIATION_JOB?.trim() !== "false";

    const staleThresholdMs = getStaleWithdrawalThresholdMs();
    const staleCutoff = new Date(Date.now() - staleThresholdMs);
    const staleProcessingCount = await this.prisma.withdrawalRequest.count({
      where: {
        status: WithdrawalStatus.PROCESSING,
        requestedAt: { lt: staleCutoff },
      },
    });

    let latestReconciliation: {
      status: string;
      discrepancyCount: number;
      createdAt: string;
    } | null = null;
    try {
      const snap = await this.prisma.reconciliationSnapshot.findFirst({
        orderBy: { createdAt: "desc" },
        select: { status: true, discrepancyCount: true, createdAt: true },
      });
      if (snap) {
        latestReconciliation = {
          status: snap.status,
          discrepancyCount: snap.discrepancyCount,
          createdAt: snap.createdAt.toISOString(),
        };
      }
    } catch {
      latestReconciliation = null;
    }

    const stagingSeed = await this.checkStagingSeed();

    const providerDegraded =
      (collectionReadiness.provider !== "mock" &&
        collectionReadiness.health !== "ok") ||
      (disbursementReadiness.provider !== "mock-disbursement" &&
        disbursementReadiness.health !== "ok") ||
      (smsProvider === "arkesel" && smsHealth !== "ok");

    const degraded =
      Object.entries(checks).some(([, v]) => v === "error") ||
      providerDegraded ||
      staleProcessingCount > 0 ||
      latestReconciliation?.status === "discrepancies_detected";

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
          configured: arkeselReadiness.configured,
          ...(arkeselReadiness.missing ? { missing: arkeselReadiness.missing } : {}),
        },
        payment: {
          provider: paymentProviderName,
          health: paymentHealth,
          collection: collectionReadiness,
        },
        disbursement: {
          provider: disbursementProviderName,
          health: disbursementHealth,
          readiness: disbursementReadiness,
        },
        webhooks: {
          signatureVerification: true,
          replayProtection: "idempotency",
          secretConfigured: hasWebhookSecret(),
          health: hasWebhookSecret() || tier !== "production" ? "ok" : "unconfigured",
        },
        withdrawals: {
          staleProcessingCount,
          staleThresholdMinutes: Math.round(staleThresholdMs / 60_000),
          monitorSchedule: "*/5 * * * *",
        },
        reconciliation: {
          enabled: reconciliationEnabled,
          paymentPollSchedule: "*/30 * * * *",
          dailySnapshotSchedule: "0 2 * * *",
          health:
            latestReconciliation?.status === "discrepancies_detected"
              ? "discrepancies_detected"
              : reconciliationEnabled
                ? "ok"
                : "disabled",
          latest: latestReconciliation,
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
