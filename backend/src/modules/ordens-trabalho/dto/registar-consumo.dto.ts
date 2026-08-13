import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

/** RF-OT-005 §3.2 — uma linha de consumo real registada durante a execução. */
export class ConsumoLinhaDto {
  @IsOptional() @IsInt() artigoId?: number;
  @IsNumber() @Min(0) quantidade: number;
  @IsOptional() @IsString() descricao?: string;
}

/** RF-OT-005 §3.2 — payload de `PUT /api/ordens/:id/consumo`. */
export class RegistarConsumoDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConsumoLinhaDto)
  linhas: ConsumoLinhaDto[];

  @IsOptional() @IsString() usuario?: string;
}
