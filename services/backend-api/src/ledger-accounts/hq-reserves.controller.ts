import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { ApiWrapped } from "../common/decorators/api-wrapped.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { ContributionGuaranteeReserveService } from "./contribution-guarantee-reserve.service";

@ApiWrapped()
@Controller("hq/reserves")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class HqReservesController {
  constructor(private reserves: ContributionGuaranteeReserveService) {}

  @Get("summary")
  summary() {
    return this.reserves.getHqSummary();
  }
}
