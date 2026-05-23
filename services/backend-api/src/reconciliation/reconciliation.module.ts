import { Module } from "@nestjs/common";
import { ReconciliationService } from "./reconciliation.service";
import { ReconciliationJob } from "./reconciliation.job";

@Module({
  providers: [ReconciliationService, ReconciliationJob],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
