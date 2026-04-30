import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { getFixedGroupFinancePlatformSettings } from "@myturn/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  get(key: string) {
    return this.prisma.setting.findUnique({ where: { key } });
  }

  async upsert(
    key: string,
    value: Prisma.InputJsonValue,
    updatedBy?: string,
  ) {
    return this.prisma.setting.upsert({
      where: { key },
      create: { key, value, updatedBy },
      update: { value, updatedBy },
    });
  }

  list() {
    return this.prisma.setting.findMany({ orderBy: { key: "asc" } });
  }

  /**
   * Read-only for API compatibility: fixed MVP rules from `@myturn/shared`
   * (not loaded from DB; HQ cannot change splits).
   */
  getPlatformFinance() {
    return Promise.resolve(getFixedGroupFinancePlatformSettings());
  }
}
