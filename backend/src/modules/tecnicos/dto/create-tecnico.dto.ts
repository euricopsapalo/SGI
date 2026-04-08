import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateTecnicoDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsNumber()
  funcaoId?: number;

  @IsOptional()
  @IsNumber()
  custoHora?: number;

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
  comissaoPorServico?: number;

  @IsOptional()
  @IsNumber()
  userId?: number;
}
