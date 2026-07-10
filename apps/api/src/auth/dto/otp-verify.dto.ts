import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, Matches } from "class-validator";

export class OtpVerifyDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "123456", description: "6-digit OTP code." })
  @Matches(/^\d{6}$/, { message: "code must be a 6-digit numeric string" })
  code!: string;
}
