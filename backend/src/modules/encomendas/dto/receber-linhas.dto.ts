import { IsArray, IsNotEmpty, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class LinhaRecebidaDto {
  @IsString() @IsNotEmpty() artigoId: string;
  @IsNumber() @IsNotEmpty() qtd: number;
}

export class ReceberLinhasDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => LinhaRecebidaDto) recebidas: LinhaRecebidaDto[];
  @IsString() @IsNotEmpty() guiaRemessa: string;
  @IsString() @IsNotEmpty() operador: string;
  @IsString() @IsNotEmpty() armazem: string;
}
