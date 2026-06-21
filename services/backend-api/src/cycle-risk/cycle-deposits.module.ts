import { Module } from "@nestjs/common";
import { CycleDepositsService } from "./cycle-deposits.service";

@Module({
  providers: [CycleDepositsService],
  exports: [CycleDepositsService],
})
export class CycleDepositsModule {}
