import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { getDeploymentTier } from "../common/platform-env";
import { ReconciliationService } from "./reconciliation.service";

/** Scheduled reconciliation skeleton — extend with queue workers later. */
@Injectable()
export class ReconciliationJob {
  private readonly logger = new Logger(ReconciliationJob.name);

  constructor(private reconciliation: ReconciliationService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleCron() {
    if (getDeploymentTier() === "production" && !process.env.ENABLE_RECONCILIATION_JOB) {
      return;
    }
    this.logger.log("Reconciliation job starting");
    await this.reconciliation.runPendingReconciliation(30);
  }
}
