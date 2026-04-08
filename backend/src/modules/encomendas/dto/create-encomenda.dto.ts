import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class EncomendaLinhaDto {
  @IsOptional() @IsNumber() artigoId?: number;
  @IsString() @IsNotEmpty() codigo: string;
  @IsString() @IsNotEmpty() descricao: string;
  @IsOptional() @IsNumber() qtdEncomendada?: number;
  @IsOptional() @IsNumber() qtdRecebida?: number;
  @IsOptional() @IsString() unidade?: string;
  @IsOptional() @IsNumber() custoUnit?: number;
  @IsOptional() @IsNumber() desconto?: number;
  @IsOptional() @IsString() codigoIva?: string;
  @IsOptional() @IsNumber() taxaIva?: number;
}

export class CreateEncomendaDto {
  @IsString() @IsNotEmpty() numero: string;
  @IsOptional() @IsNumber() fornecedorId?: number;
  @IsString() @IsNotEmpty() data: string;
  @IsOptional() @IsString() dataEntrega?: string;
  @IsOptional() @IsString() condicoesPagamento?: string;
  @IsOptional() @IsString() responsavel?: string;
  @IsOptional() @IsString() moeda?: string;
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @IsString() observacoes?: string;
  @IsOptional() @IsEnum(['Aberta', 'Aprovada', 'Parcial', 'Recebida', 'Cancelada', 'Faturada']) estado?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => EncomendaLinhaDto) linhas?: EncomendaLinhaDto[];
}
