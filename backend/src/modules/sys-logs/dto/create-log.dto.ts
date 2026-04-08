import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateLogDto {
  @IsOptional() @IsString() usuario?: string;
  @IsString() @IsNotEmpty() modulo: string;
  @IsString() @IsNotEmpty() acao: string;
  @IsOptional() @IsString() detalhes?: string;
  @IsOptional() @IsEnum(['info', 'warning', 'error']) tipo?: string;
}
