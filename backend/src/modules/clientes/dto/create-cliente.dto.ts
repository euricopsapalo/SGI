import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateClienteEnderecoDto {
  @IsOptional()
  @IsString()
  descricao?: string;

  @IsString()
  @IsNotEmpty()
  morada: string;

  @IsString()
  @IsNotEmpty()
  cidade: string;

  /** #178 — impresso no bloco do cliente das faturas e recibos. */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  codigoPostal?: string;

  @IsOptional()
  @IsBoolean()
  principal?: boolean;

  @IsOptional()
  @IsNumber()
  provinciaId?: number;

  @IsOptional()
  @IsNumber()
  municipioId?: number;
}

export class CreateClienteDto {
  @IsEnum(['empresa', 'particular'])
  @IsOptional()
  tipo?: string;

  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsOptional()
  @IsString()
  nif?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsNumber()
  condicaoPagamentoId?: number;

  @IsOptional()
  @IsNumber()
  modoPagamentoId?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateClienteEnderecoDto)
  enderecos?: CreateClienteEnderecoDto[];

  /** #179 — retenção na fonte (Lei 19/14). */
  @IsOptional()
  @IsBoolean()
  retencaoAtiva?: boolean;

  @IsOptional()
  @IsNumber({}, { message: 'A percentagem de retenção tem de ser um número' })
  @Min(0, { message: 'A percentagem de retenção não pode ser negativa' })
  @Max(100, { message: 'A percentagem de retenção não pode exceder 100' })
  retencaoPercentagem?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  retencaoDescricao?: string;
}
