import { Module } from "@nestjs/common";
import { LedgerAccountsModule } from "../ledger-accounts/ledger-accounts.module";
import { ReconciliationService } from "./reconciliation.service";
import { ReconciliationJob } from "./reconciliation.job";
import { DailyReconciliationJob } from "./daily-reconciliation.job";
import { ReconciliationSummaryService } from "./reconciliation-summary.service";
import { ReconciliationSummaryController } from "./reconciliation-summary.controller";

@Module({
  imports: [LedgerAccountsModule],
  controllers: [ReconciliationSummaryController],
  providers: [
    ReconciliationService,
    ReconciliationJob,
    DailyReconciliationJob,
    ReconciliationSummaryService,
  ],
  exports: [ReconciliationService, ReconciliationSummaryService],
})
export class ReconciliationModule {}
