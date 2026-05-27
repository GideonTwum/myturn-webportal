import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  create(
    userId: string,
    title: string,
    body: string,
    type: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.prisma.notification.create({
      data: { userId, title, body, type, metadata },
    });
  }

  listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async markRead(userId: string, id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
    return result.count > 0;
  }

  async deleteForUser(userId: string, id: string) {
    const result = await this.prisma.notification.deleteMany({
      where: { id, userId },
    });
    return result.count > 0;
  }

  clearAllForUser(userId: string) {
    return this.prisma.notification.deleteMany({ where: { userId } });
  }
}
