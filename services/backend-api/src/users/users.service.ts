import { ConflictException, Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /**
   * Match a member by normalized phone digits (temporary web member login / join).
   * Prefer synthetic invite email, then any USER with the same digits in `phone`.
   */
  async findMemberUserByPhoneDigits(rawPhone: string) {
    const digits = rawPhone.replace(/\D/g, "");
    if (digits.length < 5) {
      return null;
    }
    const synthetic = `join.${digits}@invite.myturn.local`;
    const bySynth = await this.prisma.user.findUnique({
      where: { email: synthetic },
    });
    if (bySynth?.role === UserRole.USER && bySynth.isActive) {
      return bySynth;
    }

    const candidates = await this.prisma.user.findMany({
      where: {
        role: UserRole.USER,
        isActive: true,
        phone: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return (
      candidates.find((u) => u.phone?.replace(/\D/g, "") === digits) ?? null
    );
  }

  async verifyPasswordForUser(userId: string, password: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) return false;
    return bcrypt.compare(password, u.passwordHash);
  }

  async createUser(data: {
    email: string;
    password: string;
    role: UserRole;
    firstName?: string;
    lastName?: string;
    phone?: string;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new ConflictException("Email already in use");
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        role: data.role,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
      },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });
  }
}
