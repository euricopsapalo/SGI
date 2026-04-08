import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PlanoMaoObraDto {
  @IsOptional() @IsNumber() funcaoId?: number;
  @IsOptional() @IsNumber() custo?: number;
}

export class PlanoArtigoDto {
  @IsOptional() @IsNumber() artigoId?: number;
  @IsOptional() @IsNumber() quantidade?: number;
  @IsOptional() @IsNumber() preco?: number;
}

export class CreatePlanoDto {
  @IsNumber() @IsNotEmpty() equipInstaladoId: number;
  @IsString() @IsNotEmpty() descricao: string;
  @IsOptional() @IsNumber() tipoTrabalhoId?: number;
  @IsString() @IsNotEmpty() periodicidade: string;
  @IsOptional() @IsNumber() previsaoTempo?: number;
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PlanoMaoObraDto) maosObra?: PlanoMaoObraDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PlanoArtigoDto) artigos?: PlanoArtigoDto[];
}
