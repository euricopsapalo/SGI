import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Indique a password atual.' })
  currentPassword: string;

  // O mínimo efetivo vem da política em Configurações (#100), validado no service.
  @IsString()
  @MinLength(6, { message: 'A password tem de ter pelo menos 6 caracteres.' })
  newPassword: string;
}
