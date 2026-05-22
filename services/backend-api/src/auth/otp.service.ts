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

type OtpEntry = {
  code: string;
  expiresAt: number;
  attempts: number;
};

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

/**
 * Staging OTP store — replace `deliverOtp` with SMS provider (Twilio, Africa's Talking, etc.).
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly store = new Map<string, OtpEntry>();

  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
    private users: UsersService,
  ) {}

  normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 5) {
      throw new BadRequestException("Invalid phone number");
    }
    return digits;
  }

  async requestOtp(phone: string) {
    const digits = this.normalizePhone(phone);
    const code = this.generateCode();
    this.store.set(digits, {
      code,
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
    });

    await this.deliverOtp(digits, code);

    const isProd = process.env.NODE_ENV === "production";
    return {
      message: "If this number is registered, a verification code was sent.",
      ...(isProd ? {} : { debugCode: code }),
    };
  }

  /** Lookup keys for in-memory OTP (request + verify must share a key). */
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
    let entry: OtpEntry | undefined;
    let matchedKey: string | undefined;
    for (const key of keys) {
      const candidate = this.store.get(key);
      if (candidate) {
        entry = candidate;
        matchedKey = key;
        break;
      }
    }
    if (!entry || !matchedKey) {
      throw new UnauthorizedException("Invalid or expired code");
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(matchedKey);
      throw new UnauthorizedException("Invalid or expired code");
    }
    if (entry.attempts >= MAX_ATTEMPTS) {
      this.store.delete(matchedKey);
      throw new UnauthorizedException("Too many attempts");
    }
    entry.attempts += 1;
    if (entry.code !== trimmedCode) {
      throw new UnauthorizedException("Invalid or expired code");
    }
    this.store.delete(matchedKey);

    const digits = this.normalizePhone(phone);
    const user = await this.resolveOrCreateMemberByPhone(digits, phone.trim());
    return this.auth.issueAccessTokenForUserId(user.id);
  }

  /** Hook for future SMS/WhatsApp provider. */
  private async deliverOtp(phone: string, code: string) {
    this.logger.log(
      `[OTP mock] phone=${phone} code=${code} (configure SMS provider in production)`,
    );
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
