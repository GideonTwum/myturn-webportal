import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Prisma, UserRole } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { SettingsService } from "./settings.service";

@Controller("settings")
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class SettingsController {
  constructor(private settings: SettingsService) {}

  /**
   * Fixed MVP revenue rules (code). Same values used for preview + settlement.
   * Admins/HQ may read for display; values are not editable via API.
   */
  @Roles(UserRole.USER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get("platform-finance")
  getPlatformFinance() {
    return this.settings.getPlatformFinance();
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Get()
  list() {
    return this.settings.list();
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Put()
  put(@Body() body: { key: string; value: Prisma.InputJsonValue }) {
    return this.settings.upsert(body.key, body.value);
  }
}
