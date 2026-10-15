import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { TipoArtigo, TIPOS_ARTIGO } from '../artigo.entity';

export class CreateArtigoDto {
  @IsString() @IsNotEmpty() codigo: string;
  @IsString() @IsNotEmpty() descricao: string;
  /** #195 — Produto ou Serviço. */
  @IsOptional() @IsIn(TIPOS_ARTIGO, { message: 'O tipo tem de ser Produto ou Serviço' }) tipo?: TipoArtigo;
  /** #195 — só para Serviços (o serviço recusa num Produto). */
  @IsOptional() @IsBoolean() sujeitoRetencao?: boolean;
  @IsOptional() @IsString() classe?: string;
  @IsOptional() @IsString() familia?: string;
  @IsOptional() @IsString() imagem?: string;
  @IsOptional() @IsNumber() precoUnitario?: number;
  @IsOptional() @IsString() moeda?: string;
  @IsOptional() @IsNumber() existencia?: number;
  @IsOptional() @IsNumber() nivelMaximo?: number;
  @IsOptional() @IsNumber() stockSeguranca?: number;
  @IsOptional() @IsNumber() custoMedio?: number;
  @IsOptional() @IsString() codigoArmazem?: string;
  @IsOptional() @IsNumber() stockReservado?: number;
  @IsOptional() @IsNumber() precoCusto?: number;
  @IsOptional() @IsNumber() stockEncomendado?: number;
  @IsOptional() @IsBoolean() inativo?: boolean;
  @IsOptional() @IsBoolean() critico?: boolean;
  @IsOptional() @IsString() observacao?: string;
  @IsOptional() @IsString() codigoIva?: string;
  @IsOptional() @IsNumber() stockInicial?: number;
  @IsOptional() @IsString() unidadeMedida?: string;
  @IsOptional() @IsString() refFornecedor?: string;
  @IsOptional() @IsString() dataUltimaEntrada?: string;
  @IsOptional() @IsString() dataUltimaSaida?: string;
}
