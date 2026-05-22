import { IsIn, IsString, MinLength } from "class-validator";

export class RegisterDeviceDto {
  @IsString()
  @MinLength(8)
  token!: string;

  @IsIn(["ios", "android", "web"])
  platform!: "ios" | "android" | "web";
}
