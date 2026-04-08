import { IsOptional, IsString } from 'class-validator';

export class EmitirOtDto {
  @IsOptional() @IsString() dataEmissao?: string;
  @IsOptional() @IsString() dataInicio?: string;
  @IsOptional() @IsString() usuario?: string;
}
