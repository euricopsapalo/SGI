import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReprogramarOtDto {
  @IsString() @IsNotEmpty() novaData: string;
  @IsOptional() @IsString() dataAnterior?: string;
  @IsString() @IsNotEmpty() motivo: string;
  @IsOptional() @IsString() usuario?: string;
}
