import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AdminRequestStatus, UserRole } from "@prisma/client";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminRequestsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditLogsService,
    private notifications: NotificationsService,
  ) {}

  async create(applicantId: string, message?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: applicantId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    if (user.role !== UserRole.USER) {
      throw new BadRequestException("Only members may request admin access");
    }
    return this.prisma.adminRequest.create({
      data: { applicantId, message },
    });
  }

  list(status?: AdminRequestStatus) {
    return this.prisma.adminRequest.findMany({
      where: status ? { status } : undefined,
      include: {
        applicant: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async review(
    id: string,
    reviewerId: string,
    decision: "APPROVED" | "REJECTED",
  ) {
    const req = await this.prisma.adminRequest.findUnique({ where: { id } });
    if (!req) {
      throw new NotFoundException("Request not found");
    }
    if (req.status !== AdminRequestStatus.PENDING) {
      throw new BadRequestException("Request already processed");
    }

    const status =
      decision === "APPROVED"
        ? AdminRequestStatus.APPROVED
        : AdminRequestStatus.REJECTED;

    const updated = await this.prisma.$transaction(async (tx) => {
      const ar = await tx.adminRequest.update({
        where: { id },
        data: {
          status,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
      });
      if (status === AdminRequestStatus.APPROVED) {
        await tx.user.update({
          where: { id: req.applicantId },
          data: { role: UserRole.ADMIN },
        });
      }
      return ar;
    });

    await this.audit.append({
      actorId: reviewerId,
      action: `ADMIN_REQUEST_${decision}`,
      entityType: "AdminRequest",
      entityId: id,
    });

    await this.notifications.create(
      req.applicantId,
      status === AdminRequestStatus.APPROVED
        ? "Admin approved"
        : "Admin request declined",
      status === AdminRequestStatus.APPROVED
        ? "You are now an Admin and can create savings groups."
        : "Your request for Admin access was not approved.",
      "ADMIN_REQUEST",
      { requestId: id },
    );

    return updated;
  }
}
