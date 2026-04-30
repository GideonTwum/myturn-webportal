import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module";
import { WalletsModule } from "../wallets/wallets.module";
import { CycleDepositsService } from "./cycle-deposits.service";

@Module({
  imports: [WalletsModule, LedgerModule],
  providers: [CycleDepositsService],
  exports: [CycleDepositsService],
})
export class CycleDepositsModule {}
