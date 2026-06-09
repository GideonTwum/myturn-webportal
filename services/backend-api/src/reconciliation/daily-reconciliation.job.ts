import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";
import { ReconciliationSummaryService } from "./reconciliation-summary.service";

/** Daily ledger reconciliation snapshot for HQ audit trail. */
@Injectable()
export class DailyReconciliationJob {
  private readonly logger = new Logger(DailyReconciliationJob.name);

  constructor(
    private summary: ReconciliationSummaryService,
    private prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDailySnapshot() {
    if (process.env.ENABLE_RECONCILIATION_JOB?.trim() === "false") {
      return;
    }
    this.logger.log("Daily reconciliation snapshot starting");
    try {
      const report = await this.summary.getSummary();
      const snapshot = await this.prisma.reconciliationSnapshot.create({
        data: {
          status: report.status,
          discrepancyCount: report.discrepancies.length,
          summary: report as object,
        },
      });
      if (report.discrepancies.length > 0) {
        this.logger.warn(
          `Daily reconciliation detected ${report.discrepancies.length} discrepancies snapshotId=${snapshot.id}`,
        );
        for (const d of report.discrepancies) {
          this.logger.warn(`  discrepancy: ${d}`);
        }
      } else {
        this.logger.log(`Daily reconciliation OK snapshotId=${snapshot.id}`);
      }
    } catch (e) {
      this.logger.error(
        `Daily reconciliation failed: ${e instanceof Error ? e.message : e}`,
      );
    }
  }
}
