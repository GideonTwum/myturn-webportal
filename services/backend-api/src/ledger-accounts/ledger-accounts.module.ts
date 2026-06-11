import { Global, Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { WalletsModule } from "../wallets/wallets.module";
import { ContributionGuaranteeReserveService } from "./contribution-guarantee-reserve.service";
import { FinancialAllocationService } from "./financial-allocation.service";
import { HqReservesController } from "./hq-reserves.controller";
import { HqWalletsSummaryService } from "./hq-wallets-summary.service";
import { HqWalletsController } from "./hq-wallets.controller";
import { LedgerAccountService } from "./ledger-account.service";
import { LedgerPostingService } from "./ledger-posting.service";

@Global()
@Module({
  imports: [WalletsModule, NotificationsModule],
  controllers: [HqWalletsController, HqReservesController],
  providers: [
    LedgerAccountService,
    LedgerPostingService,
    ContributionGuaranteeReserveService,
    FinancialAllocationService,
    HqWalletsSummaryService,
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
