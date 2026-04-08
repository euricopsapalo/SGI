import { IsOptional, IsString } from 'class-validator';

export class EncerrarOtDto {
  @IsOptional() @IsString() dataEncerramento?: string;
}
