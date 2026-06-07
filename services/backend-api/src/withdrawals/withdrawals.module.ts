import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { LedgerAccountsModule } from "../ledger-accounts/ledger-accounts.module";
import { MemberWalletController } from "./member-wallet.controller";
import {
  AdminWalletController,
  HqWithdrawalsController,
} from "./withdrawals.controller";
import { WithdrawalsService } from "./withdrawals.service";

@Module({
  imports: [LedgerAccountsModule, NotificationsModule, AuditLogsModule],
  controllers: [
    MemberWalletController,
    AdminWalletController,
    HqWithdrawalsController,
  ],
  providers: [WithdrawalsService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
