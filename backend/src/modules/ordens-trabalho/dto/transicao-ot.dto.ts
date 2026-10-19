import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * DTOs das transições da máquina de estados da OT (RF-OT-001 + RF-OT-003).
 * #209 — `usuario` é ignorado pelo controller (o autor vem do token JWT);
 * continua aceite só para clientes antigos não receberem 400.
 */

export class AgendarOtDto {
  /** RF-OT-003 — data agendada da OT (antiga `dataProgInicio`, removida em #74). */
  @IsOptional() @IsString() dataAgendada?: string;
  @IsOptional() @IsString() usuario?: string;
}

/**
 * RF-OT-003 §3.2 — confirmar passa a aceitar `dataExecucao` e `executadoPorId`.
 * Os campos antigos continuam aceites para compatibilidade.
 */
export class ConfirmarOtDto {
  @IsOptional() @IsString() dataExecucao?: string;
  @IsOptional() @IsInt()    executadoPorId?: number;
  @IsOptional() @IsString() usuario?: string;
}

/**
 * RF-OT-003 §3.3 — adiar exige `motivo` (≥5 chars) e `novaData`.
 * `aprovadoPor` + `aprovacaoMotivo` são exigidos a partir do limite (§3.3.1).
 */
export class AdiarOtDto {
  @IsOptional() @IsString() novaData?: string;
  @IsOptional() @IsString() @MinLength(5, { message: 'Motivo tem de ter pelo menos 5 caracteres.' })
  motivo?: string;
  @IsOptional() @IsInt()    aprovadoPor?: number;
  @IsOptional() @IsString() aprovacaoMotivo?: string;
  @IsOptional() @IsString() usuario?: string;
}

export class IniciarOtDto {
  @IsOptional() @IsString() dataInicio?: string;
  @IsOptional() @IsString() usuario?: string;
}

export class FinalizarOtDto {
  @IsOptional() @IsString() dataFim?: string;
  /** RF-OT-006 §3.1 — assinatura do cliente é obrigatória para finalizar. */
  @IsOptional() @IsBoolean() assinadaCliente?: boolean;
  @IsOptional() @IsString() assinaturaRef?: string;
  @IsOptional() @IsString() usuario?: string;
}
