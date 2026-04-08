import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class LinhaFaturaFornecedorDto {
  @IsOptional() @IsNumber() produtoId?: number;
  @IsOptional() @IsNumber() idLinhaEncomenda?: number;
  @IsOptional() @IsString() descricaoCustomizada?: string;
  @IsOptional() @IsNumber() quantidade?: number;
  @IsOptional() @IsString() unidadeVenda?: string;
  @IsOptional() @IsNumber() precoUnitarioNet?: number;
  @IsOptional() @IsNumber() taxaIva?: number;
  @IsOptional() @IsNumber() valorIva?: number;
  @IsOptional() @IsString() codigoIsencao?: string;
  @IsOptional() @IsNumber() valorTotalLinha?: number;
}

export class VncFaturaAssociadaDto {
  @IsNumber() @IsNotEmpty() faturaAssociadaId: number;
}

export class CreateFaturaFornecedorDto {
  @IsOptional() @IsNumber() fornecedorId?: number;
  @IsOptional() @IsNumber() idEncomenda?: number;
  @IsString() @IsNotEmpty() tipoDocumento: string;
  @IsString() @IsNotEmpty() numFaturaExterno: string;
  @IsString() @IsNotEmpty() dataEmissao: string;
  @IsOptional() @IsString() dataVencimento?: string;
  @IsOptional() @IsNumber() totalLiquido?: number;
  @IsOptional() @IsNumber() totalIva?: number;
  @IsOptional() @IsNumber() totalRetencao?: number;
  @IsOptional() @IsNumber() totalFinal?: number;
  @IsOptional() @IsString() moeda?: string;
  @IsOptional() @IsNumber() taxaCambio?: number;
  @IsOptional() @IsString() estadoPagamento?: string;
  @IsOptional() @IsNumber() condicaoPagamentoId?: number;
  @IsOptional() @IsNumber() modoPagamentoId?: number;
  @IsOptional() @IsString() observacoes?: string;
  @IsOptional() @IsString() descricao?: string;
  @IsOptional() @IsString() tipoNotaCredito?: string;
  @IsOptional() @IsString() estadoDocumento?: string;
  @IsOptional() @IsString() dataPagamento?: string;
  @IsOptional() @IsString() referenciaPagamento?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => LinhaFaturaFornecedorDto) linhas?: LinhaFaturaFornecedorDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => VncFaturaAssociadaDto) faturasAssociadas?: VncFaturaAssociadaDto[];
}
