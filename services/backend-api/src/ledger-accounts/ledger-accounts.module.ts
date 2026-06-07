import { Global, Module } from "@nestjs/common";
import { WalletsModule } from "../wallets/wallets.module";
import { FinancialAllocationService } from "./financial-allocation.service";
import { HqWalletsSummaryService } from "./hq-wallets-summary.service";
import { HqWalletsController } from "./hq-wallets.controller";
import { LedgerAccountService } from "./ledger-account.service";
import { LedgerPostingService } from "./ledger-posting.service";

@Global()
@Module({
  imports: [WalletsModule],
  controllers: [HqWalletsController],
  providers: [
    LedgerAccountService,
    LedgerPostingService,
    FinancialAllocationService,
    HqWalletsSummaryService,
  ],
  exports: [
    LedgerAccountService,
    LedgerPostingService,
    FinancialAllocationService,
    HqWalletsSummaryService,
  ],
})
export class LedgerAccountsModule {}
