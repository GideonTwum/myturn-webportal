import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { WithdrawalStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { getStaleWithdrawalThresholdMs } from "./withdrawal-limits";
import { WithdrawalsService } from "./withdrawals.service";

/** Polls stale PROCESSING withdrawals and logs alerts for HQ. */
@Injectable()
export class StaleWithdrawalMonitorJob {
  private readonly logger = new Logger(StaleWithdrawalMonitorJob.name);
  private lastStaleCount = 0;

  constructor(
    private prisma: PrismaService,
    private withdrawals: WithdrawalsService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async monitorStaleWithdrawals() {
    const thresholdMs = getStaleWithdrawalThresholdMs();
    const cutoff = new Date(Date.now() - thresholdMs);

    const stale = await this.prisma.withdrawalRequest.findMany({
      where: {
        status: WithdrawalStatus.PROCESSING,
        requestedAt: { lt: cutoff },
      },
      orderBy: { requestedAt: "asc" },
      take: 50,
    });

    for (const row of stale) {
      if (row.providerRef) {
        await this.withdrawals
          .pollProcessingWithdrawal(row.id)
          .catch((e) =>
            this.logger.warn(
              `Stale poll failed withdrawalId=${row.id}: ${e instanceof Error ? e.message : e}`,
            ),
          );
      }
    }

    const stillStale = await this.prisma.withdrawalRequest.count({
      where: {
        status: WithdrawalStatus.PROCESSING,
        requestedAt: { lt: cutoff },
      },
    });

    if (stillStale > 0 && stillStale !== this.lastStaleCount) {
      this.logger.warn(
        `${stillStale} withdrawal(s) stuck in PROCESSING (>${Math.round(thresholdMs / 60000)}m) — HQ attention required`,
      );
    }
    this.lastStaleCount = stillStale;
  }

  getLastStaleCount(): number {
    return this.lastStaleCount;
  }
}
