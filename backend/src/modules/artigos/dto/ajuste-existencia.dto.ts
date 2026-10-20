import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class AjusteExistenciaDto {
  @IsNumber() @IsNotEmpty() delta: number;
  // #204 — código do armazém (ex.: ARM-01); por omissão, o armazém do artigo.
  @IsOptional() @IsString() armazem?: string;
}
