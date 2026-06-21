import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import {
  HqLedgerExplorerService,
  type LedgerAccountsQuery,
  type LedgerTransactionsQuery,
} from "./hq-ledger-explorer.service";

/** Read-only HQ ledger explorer. CSV export: TODO (follow-up sprint). */
@Controller("hq/ledger")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class HqLedgerController {
  constructor(private explorer: HqLedgerExplorerService) {}

  @Get("accounts")
  listAccounts(@Query() query: LedgerAccountsQuery) {
    return this.explorer.listAccounts(query);
  }

  @Get("transactions")
  listTransactions(@Query() query: LedgerTransactionsQuery) {
    return this.explorer.listTransactions(query);
  }

  @Get("transactions/:id")
  getTransaction(@Param("id") id: string) {
    return this.explorer.getTransactionDetail(id);
  }
}
