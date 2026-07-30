import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  /** Código TOTP (2FA), quando a conta o exige (issue #100). */
  @IsOptional()
  @IsString()
  code?: string;
}
