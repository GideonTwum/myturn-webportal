import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { JwtPayload } from "./jwt.strategy";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.isActive) {
      return null;
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return null;
    }
    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return this.issueAccessTokenForUser(user);
  }

  /**
   * Temporary member web: issue JWT after join. Same shape as `login`.
   */
  async issueAccessTokenForUserId(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isActive) {
      throw new UnauthorizedException();
    }
    return this.issueAccessTokenForUser(user);
  }

  private async issueAccessTokenForUser(user: {
    id: string;
    email: string;
    role: UserRole;
    firstName: string | null;
    lastName: string | null;
  }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const token = await this.jwt.signAsync(payload);
    this.logger.log(
      `Login success userId=${user.id} role=${user.role} email=${user.email}`,
    );
    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  /**
   * Optional Bearer JWT for `POST /groups/join` — same USER may add a second group
   * without re-entering a password. Temporary until mobile app.
   */
  tryResolveUserIdFromBearer(
    authorization?: string,
  ): string | undefined {
    if (!authorization?.toLowerCase().startsWith("bearer ")) {
      return undefined;
    }
    const token = authorization.slice(7).trim();
    if (!token) return undefined;
    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      if (payload.role !== UserRole.USER) {
        return undefined;
      }
      return payload.sub;
    } catch {
      return undefined;
    }
  }

  /**
   * Temporary staging web: sign in members by phone only (weak auth — replace with MoMo/Otp).
   */
  async loginMemberByPhone(phone: string) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 5) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const synthetic = `join.${digits}@invite.myturn.local`;
    let user = await this.prisma.user.findUnique({
      where: { email: synthetic },
    });

    if (!user?.isActive || user.role !== UserRole.USER) {
      const candidates = await this.prisma.user.findMany({
        where: {
          role: UserRole.USER,
          isActive: true,
          phone: { not: null },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      user =
        candidates.find((u) => u.phone?.replace(/\D/g, "") === digits) ?? null;
    }

    if (!user?.isActive || user.role !== UserRole.USER) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return this.issueAccessTokenForUser(user);
  }

  async me(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
      },
    });
  }

  roleLabel(role: UserRole): string {
    const map: Record<UserRole, string> = {
      SUPER_ADMIN: "MyTurn HQ",
      ADMIN: "Admin",
      USER: "Member",
    };
    return map[role];
  }
}
