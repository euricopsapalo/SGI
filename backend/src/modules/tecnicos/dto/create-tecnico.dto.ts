import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

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

  // Issue #68 — auto-criação do User associado quando userId é omitido.
  // Se userId vier, password/passwordConfirm são ignorados (relink de user existente).
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password tem de ter pelo menos 6 caracteres.' })
  password?: string;

  @IsOptional()
  @IsString()
  passwordConfirm?: string;
}
