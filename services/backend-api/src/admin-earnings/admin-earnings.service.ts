import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminEarningsService {
  constructor(private prisma: PrismaService) {}

  listForAdmin(adminId: string) {
    return this.prisma.adminEarning.findMany({
      where: { adminId },
      orderBy: { createdAt: "desc" },
      include: {
        group: { select: { id: true, name: true } },
      },
    });
  }

  listAll() {
    return this.prisma.adminEarning.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        admin: { select: { id: true, email: true } },
        group: { select: { id: true, name: true } },
      },
    });
  }
}
