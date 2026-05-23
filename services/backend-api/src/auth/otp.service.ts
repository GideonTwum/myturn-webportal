import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { MemberAuthorizationLevel, UserRole } from "@prisma/client";
import { randomBytes } from "crypto";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { getPlatformFeatureFlags } from "../common/platform-env";
import { OtpRateLimiter } from "./otp/otp-rate-limiter";
import type { OtpRecord, OtpStoreAdapter } from "./otp/otp-store.adapter";
import { createOtpStore, type OtpStoreKind } from "./otp/otp-store.factory";
import { createSmsProvider, type SmsProvider } from "./otp/sms-provider.interface";
import {
  logOtpEvent,
  recordOtpDelivery,
  recordOtpRequest,
  recordOtpVerification,
} from "./otp/otp-telemetry";

const OTP_TTL_MS = Number(process.env.OTP_TTL_MS ?? 5 * 60 * 1000);
const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly store: OtpStoreAdapter;
  readonly storeKind: OtpStoreKind;
  private readonly sms: SmsProvider;

  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
    private users: UsersService,
    private rateLimiter: OtpRateLimiter,
  ) {
    const { store, kind } = createOtpStore();
    this.store = store;
    this.storeKind = kind;
    this.sms = createSmsProvider((msg) => this.logger.log(msg));
  }

  normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 5) {
      throw new BadRequestException("Invalid phone number");
    }
    return digits;
  }

  async requestOtp(phone: string) {
    const digits = this.normalizePhone(phone);
    try {
      await this.rateLimiter.assertCanRequestOtp(digits);
    } catch (e) {
      logOtpEvent(this.logger, "otp.request.denied", {
        phone: digits,
        reason: e instanceof Error ? e.message : "rate_limited",
      });
      throw e;
    }

    const code = this.generateCode();
    const record: OtpRecord = {
      code,
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
    };
    await this.store.set(digits, record);
    recordOtpRequest();
    let smsResult;
    try {
      smsResult = await this.sms.sendOtp(digits, code);
      recordOtpDelivery(true);
    } catch (e) {
      await this.store.delete(digits);
      recordOtpDelivery(false);
      logOtpEvent(this.logger, "otp.request.failure", {
        phone: digits,
        reason: e instanceof Error ? e.message : "sms_failed",
      });
      throw new BadRequestException(
        "Unable to send verification code. Please try again shortly.",
      );
    }

    logOtpEvent(this.logger, "otp.request", {
      phone: digits,
      store: this.storeKind,
      smsProvider: smsResult.provider,
    });

    const flags = getPlatformFeatureFlags();
    return {
      message: "If this number is registered, a verification code was sent.",
      ...(flags.debugOtpInResponses ? { debugCode: code } : {}),
    };
  }

  private otpLookupKeys(phone: string): string[] {
    const digits = this.normalizePhone(phone);
    const keys = new Set<string>([digits]);
    if (digits.startsWith("233") && digits.length > 9) {
      keys.add(digits.slice(3));
      keys.add(`0${digits.slice(3)}`);
    }
    if (digits.startsWith("0")) {
      keys.add(digits.slice(1));
    } else if (digits.length === 9) {
      keys.add(`0${digits}`);
      keys.add(`233${digits}`);
    }
    return [...keys];
  }

  async verifyOtp(phone: string, code: string) {
    const trimmedCode = code.replace(/\s/g, "").trim();
    const keys = this.otpLookupKeys(phone);
    const primaryKey = this.normalizePhone(phone);

    await this.rateLimiter.assertCanVerify(primaryKey);

    let entry: OtpRecord | null = null;
    let matchedKey: string | undefined;
    for (const key of keys) {
      const candidate = await this.store.get(key);
      if (candidate) {
        entry = candidate;
        matchedKey = key;
        break;
      }
    }

    logOtpEvent(this.logger, "otp.verify.attempt", {
      phone: primaryKey,
      store: this.storeKind,
      found: Boolean(entry),
    });

    if (!entry || !matchedKey) {
      logOtpEvent(this.logger, "otp.verify.failure", {
        phone: primaryKey,
        reason: "not_found",
      });
      throw new UnauthorizedException("Invalid or expired code");
    }
    if (Date.now() > entry.expiresAt) {
      await this.store.delete(matchedKey);
      logOtpEvent(this.logger, "otp.verify.failure", {
        phone: primaryKey,
        reason: "expired",
      });
      throw new UnauthorizedException("Invalid or expired code");
    }
    if (entry.attempts >= MAX_ATTEMPTS) {
      await this.store.delete(matchedKey);
      logOtpEvent(this.logger, "otp.verify.locked", { phone: primaryKey });
      throw new UnauthorizedException("Too many attempts");
    }

    entry.attempts += 1;
    await this.store.set(matchedKey, entry);

    if (entry.code !== trimmedCode) {
      logOtpEvent(this.logger, "otp.verify.failure", {
        phone: primaryKey,
        reason: "mismatch",
        attempts: entry.attempts,
      });
      throw new UnauthorizedException("Invalid or expired code");
    }

    await this.store.delete(matchedKey);
    recordOtpVerification();
    const digits = this.normalizePhone(phone);
    const user = await this.resolveOrCreateMemberByPhone(digits, phone.trim());
    logOtpEvent(this.logger, "otp.verify.success", {
      phone: primaryKey,
      userId: user.id,
    });
    return this.auth.issueAccessTokenForUserId(user.id);
  }

  private generateCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  private async resolveOrCreateMemberByPhone(digits: string, rawPhone: string) {
    const synthetic = `join.${digits}@invite.myturn.local`;
    let user =
      (await this.prisma.user.findUnique({ where: { email: synthetic } })) ??
      (await this.users.findMemberUserByPhoneDigits(rawPhone));

    if (!user) {
      await this.users.createUser({
        email: synthetic,
        password: randomBytes(24).toString("base64url"),
        role: UserRole.USER,
        firstName: "Member",
        phone: rawPhone,
      });
      user = await this.prisma.user.findUnique({ where: { email: synthetic } });
    }

    if (!user?.isActive || user.role !== UserRole.USER) {
      throw new UnauthorizedException("Unable to create member session");
    }

    if (user.memberAuthorizationLevel !== MemberAuthorizationLevel.PHONE_VERIFIED) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          phone: rawPhone,
          memberAuthorizationLevel: MemberAuthorizationLevel.PHONE_VERIFIED,
        },
      });
    }

    return user;
  }
}
