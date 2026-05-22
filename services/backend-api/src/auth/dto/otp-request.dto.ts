import { IsString, MinLength } from "class-validator";

export class OtpRequestDto {
  @IsString()
  @MinLength(5)
  phone!: string;
}
