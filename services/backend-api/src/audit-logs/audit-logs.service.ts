import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  append(params: {
    actorId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Prisma.InputJsonValue;
    ipAddress?: string;
  }) {
    return this.prisma.auditLog.create({ data: params });
  }

  recent(take = 100) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take,
    });
  }
}
