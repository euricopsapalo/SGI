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

/**
 * #199 — Só campos editáveis pelo utilizador. Os campos de sistema (estado,
 * número, registadoPor, assinatura, datas de execução, adiamentos, janela,
 * aprovação, documento de venda) NÃO estão aqui: com `forbidNonWhitelisted`,
 * enviá-los dá 400. O estado só muda pelos endpoints de transição
 * (agendar/confirmar/adiar/iniciar/finalizar), que passam por `assertTransicao`.
 */
export class CreateOrdemTrabalhoDto {
  @IsOptional() @IsEnum(['pontual', 'periodica']) tipo?: string;
  // RF-OT-002 §3.1 — novos campos
  @IsOptional() @IsEnum(['Manutenção','Substituição de filtro','Reparação de avaria','Inspeção','Montagem / Instalação'])
  naturezaIntervencao?: string;
  @IsOptional() @IsEnum(['Normal','Alta','Urgente']) prioridade?: string;
  @IsOptional() @IsString() dataRegisto?: string;
  @IsOptional() @IsNumber() executadoPorId?: number;   // técnico de campo (opcional na marcação)
  @IsOptional() @IsNumber() clienteId?: number;        // derivado do equipInstalado se omitido
  @IsOptional() @IsNumber() equipInstaladoId?: number;
  @IsOptional() @IsNumber() planoId?: number;
  @IsString() @IsNotEmpty() descricao: string;
  @IsOptional() @IsNumber() previsaoTempo?: number;
  @IsOptional() @IsString() periodicidade?: string;
  @IsOptional() @IsString() orgao?: string;
  @IsOptional() @IsString() sintoma?: string;
  @IsOptional() @IsString() causa?: string;
  @IsOptional() @IsString() dataAgendada?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OtMaoObraDto) maosObra?: OtMaoObraDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OtArtigoDto) artigos?: OtArtigoDto[];
}
