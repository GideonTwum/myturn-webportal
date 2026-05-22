import { Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { getDeploymentTier, getPublicApiBaseUrl } from "./platform-env";

const logger = new Logger("StagingValidation");

/** Warn on startup when local/staging DB is missing deterministic demo data. */
export async function validateStagingEcosystem(): Promise<void> {
  const tier = getDeploymentTier();
  if (tier === "production") return;

  const apiUrl = getPublicApiBaseUrl();
  if (tier === "local" && apiUrl.includes("railway")) {
    logger.warn("API URL may point at Railway while tier=local — check env alignment");
  }

  if (process.env.SKIP_STAGING_SEED_CHECK === "true") return;

  const prisma = new PrismaClient();
  try {
    const demo = await prisma.group.findUnique({
      where: { inviteCode: "STAGING-DEMO" },
      select: { id: true },
    });
    const pay = await prisma.group.findUnique({
      where: { inviteCode: "STAGING-PAY" },
      select: { id: true, status: true },
    });
    if (!demo || !pay) {
      logger.warn(
        "Staging seed incomplete — run: npm run db:seed:local && npm run seed:staging:local",
      );
    } else if (pay.status !== "ACTIVE") {
      logger.warn("STAGING-PAY exists but is not ACTIVE — contribution demos may fail");
    }
  } catch (e) {
    logger.warn(`Staging seed check skipped: ${e instanceof Error ? e.message : e}`);
  } finally {
    await prisma.$disconnect();
  }
}
