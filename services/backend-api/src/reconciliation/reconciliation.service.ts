import { Injectable, Logger } from "@nestjs/common";
import { ContributionStatus, PaymentRequestStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { createPaymentProvider } from "../payments/providers/placeholder-providers";

export type ReconciliationFinding = {
  paymentRequestId: string;
  pspStatus: string;
  contributionStatus: string;
  matched: boolean;
  note?: string;
};

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);
  private readonly provider = createPaymentProvider();

  constructor(private prisma: PrismaService) {}

  /** Queue-ready skeleton: compare PSP vs DB for pending payment requests. */
  async runPendingReconciliation(limit = 50): Promise<ReconciliationFinding[]> {
    const pending = await this.prisma.paymentRequest.findMany({
      where: { status: PaymentRequestStatus.PENDING },
      take: limit,
      include: { contribution: { select: { status: true } } },
    });

    const findings: ReconciliationFinding[] = [];

    for (const req of pending) {
      let pspStatus = "UNKNOWN";
      try {
        if (req.providerRef) {
          const v = await this.provider.verifyTransaction({
            providerRef: req.providerRef,
            externalRef: req.externalRef,
          });
          pspStatus = v.status;
        }
      } catch (e) {
        pspStatus = `ERROR:${e instanceof Error ? e.message : e}`;
      }

      const contributionStatus = req.contribution.status;
      const matched =
        (pspStatus === "APPROVED" &&
          contributionStatus === ContributionStatus.PAID) ||
        (pspStatus === "PENDING" &&
          contributionStatus === ContributionStatus.PENDING);

      const finding: ReconciliationFinding = {
        paymentRequestId: req.id,
        pspStatus,
        contributionStatus,
        matched,
        note: matched ? undefined : "discrepancy",
      };
      findings.push(finding);

      if (!matched) {
        this.logger.warn(
          JSON.stringify({
            domain: "reconciliation",
            event: "discrepancy",
            ...finding,
          }),
        );
      }
    }

    this.logger.log(
      JSON.stringify({
        domain: "reconciliation",
        event: "run.complete",
        scanned: pending.length,
        discrepancies: findings.filter((f) => !f.matched).length,
      }),
    );

    return findings;
  }
}
