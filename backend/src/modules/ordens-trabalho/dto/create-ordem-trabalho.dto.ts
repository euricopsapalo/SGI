import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class OtMaoObraDto {
  @IsString() @IsNotEmpty() funcao: string;
  @IsOptional() @IsNumber() custo?: number;
  @IsOptional() @IsString() hora?: string;
}

export class OtArtigoDto {
  @IsOptional() @IsNumber() artigoId?: number;
  @IsString() @IsNotEmpty() descricao: string;
  @IsOptional() @IsNumber() quantidade?: number;
  @IsOptional() @IsNumber() preco?: number;
  @IsOptional() @IsString() codigoIva?: string;
  @IsOptional() @IsNumber() taxaIva?: number;
}

export class CreateOrdemTrabalhoDto {
  @IsOptional() @IsEnum(['programada', 'pontual']) tipo?: string;
  @IsOptional() @IsNumber() clienteId?: number;
  @IsOptional() @IsNumber() equipInstaladoId?: number;
  @IsOptional() @IsNumber() planoId?: number;
  @IsOptional() @IsString() tipoTrabalho?: string;
  @IsOptional() @IsString() tipoOT?: string;
  @IsString() @IsNotEmpty() descricao: string;
  @IsOptional() @IsNumber() previsaoTempo?: number;
  @IsOptional() @IsString() periodicidade?: string;
  @IsOptional() @IsString() responsavel?: string;
  @IsOptional() @IsString() orgao?: string;
  @IsOptional() @IsString() sintoma?: string;
  @IsOptional() @IsString() causa?: string;
  @IsOptional() @IsString() dataProgInicio?: string;
  @IsOptional() @IsString() dataProgFim?: string;
  @IsOptional() @IsString() dataEmissao?: string;
  @IsOptional() @IsString() dataInicio?: string;
  @IsOptional() @IsString() dataFim?: string;
  @IsOptional() @IsString() dataEncerramento?: string;
  @IsOptional() @IsEnum(['Programado', 'Em curso', 'Terminado', 'Encerrado']) estado?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OtMaoObraDto) maosObra?: OtMaoObraDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OtArtigoDto) artigos?: OtArtigoDto[];
}
