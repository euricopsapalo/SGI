import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateFornecedorDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsOptional()
  @IsString()
  nif?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  morada?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsNumber()
  provinciaId?: number;

  @IsOptional()
  @IsNumber()
  municipioId?: number;

  @IsOptional()
  @IsNumber()
  condicaoPagamentoId?: number;

  @IsOptional()
  @IsNumber()
  modoPagamentoId?: number;
}
