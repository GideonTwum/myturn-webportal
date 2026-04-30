import { IsString, MaxLength, MinLength } from "class-validator";

export class MemberPhoneLoginDto {
  @IsString()
  @MinLength(5)
  @MaxLength(32)
  phone!: string;
}
