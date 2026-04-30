import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CycleComplianceService } from "./cycle-compliance.service";

@Injectable()
export class CycleComplianceJob {
  private readonly logger = new Logger(CycleComplianceJob.name);

  constructor(private compliance: CycleComplianceService) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async dailyCompliance(): Promise<void> {
    this.logger.log("Cycle compliance: sync + daily reminders");
    await this.compliance.syncAllActiveCycleGroups();
    await this.compliance.sendDailyReminders();
  }
}
