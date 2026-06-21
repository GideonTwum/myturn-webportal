import { describe, expect, it } from "vitest";
import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { ROLES_KEY } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { HqLedgerController } from "./hq-ledger.controller";

describe("HqLedgerController access", () => {
  it("is restricted to SUPER_ADMIN", () => {
    const roles = Reflect.getMetadata(ROLES_KEY, HqLedgerController) as
      | UserRole[]
      | undefined;
    expect(roles).toEqual([UserRole.SUPER_ADMIN]);
  });

  it("allows SUPER_ADMIN through RolesGuard", () => {
    const guard = new RolesGuard(new Reflector());
    const ctx = {
      getHandler: () => HqLedgerController.prototype.listAccounts,
      getClass: () => HqLedgerController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { sub: "hq-1", role: UserRole.SUPER_ADMIN } }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("denies non-HQ roles through RolesGuard", () => {
    const guard = new RolesGuard(new Reflector());
    const ctx = {
      getHandler: () => HqLedgerController.prototype.listAccounts,
      getClass: () => HqLedgerController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { sub: "admin-1", role: UserRole.ADMIN } }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(ctx)).toBe(false);
  });
});
