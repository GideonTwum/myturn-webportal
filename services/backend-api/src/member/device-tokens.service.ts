import { Injectable, Logger } from "@nestjs/common";
import { DevicePlatform } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/** Push delivery is not wired yet — persists tokens for future FCM/APNs integration. */
@Injectable()
export class DeviceTokensService {
  private readonly logger = new Logger(DeviceTokensService.name);

  constructor(private prisma: PrismaService) {}

  async register(
    userId: string,
    token: string,
    platform: "ios" | "android" | "web",
  ) {
    const normalized = token.trim();
    if (!normalized) {
      return { registered: false, reason: "empty_token" };
    }

    const platformEnum = this.toPlatform(platform);
    const record = await this.prisma.deviceToken.upsert({
      where: {
        userId_token: { userId, token: normalized },
      },
      create: {
        userId,
        token: normalized,
        platform: platformEnum,
      },
      update: {
        platform: platformEnum,
        lastSeenAt: new Date(),
      },
    });

    this.logger.log(
      `Device token registered userId=${userId} platform=${platformEnum} (push provider not connected)`,
    );

    return {
      registered: true,
      id: record.id,
      platform: record.platform,
    };
  }

  /** Placeholder for future push campaigns. */
  async sendToUser(_userId: string, _title: string, _body: string) {
    this.logger.debug("Push send skipped — provider not configured");
    return { sent: false, reason: "provider_not_configured" };
  }

  private toPlatform(platform: "ios" | "android" | "web"): DevicePlatform {
    const map: Record<typeof platform, DevicePlatform> = {
      ios: DevicePlatform.IOS,
      android: DevicePlatform.ANDROID,
      web: DevicePlatform.WEB,
    };
    return map[platform];
  }
}
