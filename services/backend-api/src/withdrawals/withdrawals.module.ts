import { Module } from "@nestjs/common";
import { IdempotencyService } from "../common/idempotency/idempotency.service";
import { CycleRiskModule } from "../cycle-risk/cycle-risk.module";
import { MemberModule } from "../member/member.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuditLogsModule } from "../audit-logs/audit-logs.module";
import { LedgerAccountsModule } from "../ledger-accounts/ledger-accounts.module";
import { MemberWalletController } from "./member-wallet.controller";
import {
  AdminWalletController,
  HqWithdrawalsController,
} from "./withdrawals.controller";
import { WithdrawalsService } from "./withdrawals.service";
import { StaleWithdrawalMonitorJob } from "./stale-withdrawal-monitor.job";

@Module({
  imports: [
    LedgerAccountsModule,
    NotificationsModule,
    AuditLogsModule,
    MemberModule,
    CycleRiskModule,
  ],
  controllers: [
    MemberWalletController,
    AdminWalletController,
    HqWithdrawalsController,
  ],
  providers: [WithdrawalsService, StaleWithdrawalMonitorJob, IdempotencyService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
