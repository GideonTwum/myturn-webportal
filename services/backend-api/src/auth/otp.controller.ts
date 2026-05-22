import { Body, Controller, Post } from "@nestjs/common";
import { ApiWrapped } from "../common/decorators/api-wrapped.decorator";
import { OtpRequestDto } from "./dto/otp-request.dto";
import { OtpVerifyDto } from "./dto/otp-verify.dto";
import { OtpService } from "./otp.service";

@ApiWrapped()
@Controller("auth/otp")
export class OtpController {
  constructor(private otp: OtpService) {}

  @Post("request")
  request(@Body() body: OtpRequestDto) {
    return this.otp.requestOtp(body.phone);
  }

  @Post("verify")
  verify(@Body() body: OtpVerifyDto) {
    return this.otp.verifyOtp(body.phone, body.code);
  }
}
