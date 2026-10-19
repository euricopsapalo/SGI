import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class LinhaRecebidaDto {
  @IsString() @IsNotEmpty() artigoId: string;
  @IsNumber() @IsNotEmpty() qtd: number;
}

export class ReceberLinhasDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => LinhaRecebidaDto) recebidas: LinhaRecebidaDto[];
  @IsString() @IsNotEmpty() guiaRemessa: string;
  /** #209 — ignorado: o operador é o utilizador do token. Aceite só por compatibilidade. */
  @IsOptional() @IsString() operador?: string;
  @IsString() @IsNotEmpty() armazem: string;
}
