import { Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { getDeploymentTier, getPublicApiBaseUrl } from "./platform-env";

const REQUIRED_INVITES = ["STAGING-DEMO", "STAGING-PAY"];

/**
 * Startup check — warns when local/staging DB is missing deterministic seed data.
 */
export async function validateStagingEcosystem(prisma: PrismaService): Promise<void> {
  const tier = getDeploymentTier();
  if (tier === "production") return;

  const logger = new Logger("StagingValidation");
  const apiBase = getPublicApiBaseUrl();

  const groups = await prisma.group.findMany({
    where: { inviteCode: { in: REQUIRED_INVITES } },
    select: { inviteCode: true },
  });
  const missing = REQUIRED_INVITES.filter(
    (c) => !groups.some((g) => g.inviteCode === c),
  );

  if (missing.length > 0) {
    logger.warn(
      `Staging seed incomplete (missing: ${missing.join(", ")}). ` +
        `Run: npm run db:seed:local && npm run seed:staging:local`,
    );
  }

  if (tier === "local" && apiBase.includes("localhost") && missing.length === 0) {
    logger.log(`Staging ecosystem OK @ ${apiBase}`);
  }

  const webUrl = process.env.STAGING_WEB_URL?.trim();
  const mobileUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (webUrl && mobileUrl && webUrl !== mobileUrl && !mobileUrl.includes("localhost")) {
    logger.warn(
      "Possible API URL drift: STAGING_WEB_URL and EXPO_PUBLIC_API_URL differ",
    );
  }
}
