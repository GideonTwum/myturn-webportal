import { Global, Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { ContributionGuaranteeReserveService } from "./contribution-guarantee-reserve.service";
import { FinancialAllocationService } from "./financial-allocation.service";
import { HqLedgerController } from "./hq-ledger.controller";
import { HqLedgerExplorerService } from "./hq-ledger-explorer.service";
import { HqReservesController } from "./hq-reserves.controller";
import { HqWalletsSummaryService } from "./hq-wallets-summary.service";
import { HqWalletsController } from "./hq-wallets.controller";
import { LedgerAccountService } from "./ledger-account.service";
import { LedgerPostingService } from "./ledger-posting.service";

@Global()
@Module({
  imports: [NotificationsModule],
  controllers: [HqWalletsController, HqReservesController, HqLedgerController],
  providers: [
    LedgerAccountService,
    LedgerPostingService,
    ContributionGuaranteeReserveService,
    FinancialAllocationService,
    HqWalletsSummaryService,
    HqLedgerExplorerService,
  ],
  exports: [
    LedgerAccountService,
    LedgerPostingService,
    ContributionGuaranteeReserveService,
    FinancialAllocationService,
    HqWalletsSummaryService,
  ],
})
export class LedgerAccountsModule {}
