import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { PrismaModule } from "../prisma/prisma.module";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { OtpController } from "./otp.controller";
import { OtpRateLimiter } from "./otp/otp-rate-limiter";
import { OtpService } from "./otp.service";
import { resolveJwtSecret } from "./jwt-secret";
import { JwtStrategy } from "./jwt.strategy";

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: resolveJwtSecret(config),
        signOptions: { expiresIn: "7d" },
      }),
    }),
  ],
  controllers: [AuthController, OtpController],
  providers: [AuthService, OtpService, OtpRateLimiter, JwtStrategy],
  exports: [AuthService, OtpService],
})
export class AuthModule {}
