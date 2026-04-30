import { Global, Module } from "@nestjs/common";
import { WalletsModule } from "../wallets/wallets.module";
import { LedgerController } from "./ledger.controller";
import { LedgerService } from "./ledger.service";

@Global()
@Module({
  imports: [WalletsModule],
  controllers: [LedgerController],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
