import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { ReconciliationSummaryService } from "./reconciliation-summary.service";

type ReqUser = { user: { sub: string; role: UserRole } };

@Controller("hq/reconciliation")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class ReconciliationSummaryController {
  constructor(private summary: ReconciliationSummaryService) {}

  @Get("summary")
  getSummary(@Req() _req: ReqUser) {
    void _req;
    return this.summary.getSummary();
  }

  @Get("latest")
  async getLatest(@Req() _req: ReqUser) {
    void _req;
    const latest = await this.summary.getLatestSnapshot();
    if (!latest) {
      return { status: "no_snapshots", message: "No daily snapshots yet" };
    }
    return latest;
  }
}
