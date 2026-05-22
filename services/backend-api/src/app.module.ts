require("crypto");
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { join } from "node:path";
import { ScheduleModule } from "@nestjs/schedule";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { AdminRequestsModule } from "./admin-requests/admin-requests.module";
import { GroupsModule } from "./groups/groups.module";
import { GroupMembersModule } from "./group-members/group-members.module";
import { ContributionsModule } from "./contributions/contributions.module";
import { PaymentsModule } from "./payments/payments.module";
import { PayoutsModule } from "./payouts/payouts.module";
import { WalletsModule } from "./wallets/wallets.module";
import { LedgerModule } from "./ledger/ledger.module";
import { AdminEarningsModule } from "./admin-earnings/admin-earnings.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { SettingsModule } from "./settings/settings.module";
import { AuditLogsModule } from "./audit-logs/audit-logs.module";
import { TransactionsModule } from "./transactions/transactions.module";
import { AdminOverviewModule } from "./admin-overview/admin-overview.module";
import { HqFinancialModule } from "./hq-financial/hq-financial.module";
import { CycleRiskModule } from "./cycle-risk/cycle-risk.module";
import { MemberModule } from "./member/member.module";
import { MemberVerificationModule } from "./member-verification/member-verification.module";
import { PaymentRequestsModule } from "./payment-requests/payment-requests.module";
import { AppController } from "./app.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Always load backend-api/.env regardless of npm/cwd from repo root.
      envFilePath: join(__dirname, "..", ".env"),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    AdminRequestsModule,
    GroupsModule,
    GroupMembersModule,
    ContributionsModule,
    PaymentsModule,
    PayoutsModule,
    WalletsModule,
    LedgerModule,
    AdminEarningsModule,
    NotificationsModule,
    SettingsModule,
    AuditLogsModule,
    TransactionsModule,
    HqFinancialModule,
    AdminOverviewModule,
    CycleRiskModule,
    MemberModule,
    MemberVerificationModule,
    PaymentRequestsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
