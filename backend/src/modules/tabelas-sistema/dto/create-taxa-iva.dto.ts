import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTaxaIvaDto {
  @IsString() @IsNotEmpty() codigo: string;
  @IsString() @IsNotEmpty() descricao: string;
  @IsOptional() @IsNumber() taxa?: number;
  /** #178 — motivo de isenção impresso nas faturas (taxas a 0 %). */
  @IsOptional() @IsString() @MaxLength(200) motivoIsencao?: string;
}
