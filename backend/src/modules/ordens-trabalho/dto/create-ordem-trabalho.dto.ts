import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
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
  @IsOptional() @IsEnum(['pontual', 'periodica']) tipo?: string;
  // RF-OT-002 §3.1 — novos campos
  @IsOptional() @IsEnum(['Manutenção','Substituição de filtro','Reparação de avaria','Inspeção','Montagem / Instalação'])
  naturezaIntervencao?: string;
  @IsOptional() @IsEnum(['Normal','Alta','Urgente']) prioridade?: string;
  @IsOptional() @IsString() dataRegisto?: string;
  @IsOptional() @IsNumber() registadoPorId?: number;   // auto-preenchido pelo backend se omitido
  @IsOptional() @IsNumber() executadoPorId?: number;   // técnico de campo (opcional na marcação)
  @IsOptional() @IsNumber() clienteId?: number;        // derivado do equipInstalado se omitido
  @IsOptional() @IsNumber() equipInstaladoId?: number;
  @IsOptional() @IsNumber() planoId?: number;
  @IsString() @IsNotEmpty() descricao: string;
  @IsOptional() @IsNumber() previsaoTempo?: number;
  @IsOptional() @IsString() periodicidade?: string;
  @IsOptional() @IsString() responsavel?: string;
  @IsOptional() @IsString() orgao?: string;
  @IsOptional() @IsString() sintoma?: string;
  @IsOptional() @IsString() causa?: string;
  @IsOptional() @IsString() dataAgendada?: string;
  @IsOptional() @IsString() dataInicio?: string;
  @IsOptional() @IsString() dataFim?: string;
  @IsOptional() @IsEnum(['Registada', 'Programada', 'Adiada', 'Confirmada', 'Em execução', 'Finalizada']) estado?: string;
  @IsOptional() @IsBoolean() assinadaCliente?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OtMaoObraDto) maosObra?: OtMaoObraDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => OtArtigoDto) artigos?: OtArtigoDto[];
}
