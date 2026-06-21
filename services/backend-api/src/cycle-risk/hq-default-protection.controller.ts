import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { UserRole } from "@prisma/client";
import { ApiWrapped } from "../common/decorators/api-wrapped.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { DefaultProtectionService } from "./default-protection.service";

@ApiWrapped()
@Controller("hq/default-protection")
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class HqDefaultProtectionController {
  constructor(private defaultProtection: DefaultProtectionService) {}

  @Get("summary")
  summary() {
    return this.defaultProtection.getHqDefaultProtectionSummary();
  }
}
