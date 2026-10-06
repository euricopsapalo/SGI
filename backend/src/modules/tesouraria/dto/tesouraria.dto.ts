import { Type } from 'class-transformer';
import {
    ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength,
    ValidateNested,
} from 'class-validator';

/** #166 — Linha da liquidação: quanto se paga (e desconta) de um pendente. */
export class LinhaLiquidacaoDto {
    @IsInt() movimentoCcId: number;

    @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
    valorPago: number;

    @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
    desconto?: number;
}

/** #166 — `POST /api/liquidacoes` (v10 §6.2–6.3). Sem série → por defeito; sem data-hora → agora. */
export class CreateLiquidacaoDto {
    @IsInt() documentoConfigId: number;
    @IsInt() clienteId: number;
    @IsInt() contaBancariaId: number;

    @IsOptional() @IsInt() serieId?: number;
    @IsOptional() @IsDateString() dataHora?: string;

    @IsOptional() @IsString() @MaxLength(5000)
    observacoes?: string;

    /** #178 — referência do meio de pagamento (n.º de cheque/transferência). */
    @IsOptional() @IsString() @MaxLength(50)
    referenciaPagamento?: string;

    @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => LinhaLiquidacaoDto)
    linhas: LinhaLiquidacaoDto[];
}

/**
 * #167 — Campos comuns às operações de caixa. Sem documento → o activo do tipo
 * associado à caixa; sem série → a por defeito; sem data-hora → agora.
 */
class OperacaoCaixaDto {
    @IsOptional() @IsInt() documentoConfigId?: number;
    @IsOptional() @IsInt() serieId?: number;
    @IsOptional() @IsDateString() dataHora?: string;
}

/** #167 — `POST /api/caixa/:contaId/abrir`. */
export class AbrirCaixaDto extends OperacaoCaixaDto {
    @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
    valorDeclarado: number;

    @IsOptional() @IsString() @MaxLength(5000)
    observacoes?: string;
}

/** #167 — `POST /api/caixa/:contaId/saida`. */
export class SaidaCaixaDto extends OperacaoCaixaDto {
    @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01)
    valor: number;

    @IsString() @MinLength(3) @MaxLength(300)
    motivo: string;
}

/** #167 — `POST /api/caixa/:contaId/fechar`. */
export class FecharCaixaDto extends OperacaoCaixaDto {
    @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
    valorContado: number;

    @IsOptional() @IsString() @MaxLength(5000)
    observacoes?: string;
}

/** #174 — filtros de `GET /api/cc/pendentes`. */
export class PendentesQueryDto {
    /** N.º de documento: `FT 2026/1`, `2026/1` ou só o número. */
    @IsOptional() @IsString() @MaxLength(50) documento?: string;
    /** N.º de OT (parcial): `OT-000007`, `7`. */
    @IsOptional() @IsString() @MaxLength(50) ot?: string;
    @IsOptional() @Type(() => Number) @IsInt() clienteId?: number;
    /** Pesquisa de cliente por nome ou NIF. */
    @IsOptional() @IsString() @MaxLength(200) cliente?: string;
    /** Sobre que data se aplica o intervalo `de`/`ate`. */
    @IsOptional() @IsIn(['documento', 'vencimento']) dataTipo?: 'documento' | 'vencimento';
    @IsOptional() @IsDateString() de?: string;
    @IsOptional() @IsDateString() ate?: string;
    /** Só vencidos até esta data (inclusive). */
    @IsOptional() @IsDateString() vencidosAte?: string;
    /** Universo do documento de liquidação (opera sobre CC + estado). */
    @IsOptional() @Type(() => Number) @IsInt() ccTipoId?: number;
    @IsOptional() @Type(() => Number) @IsInt() ccEstadoId?: number;
    @IsOptional() @IsIn(['dataDocumento', 'dataVencimento', 'cliente', 'valorPendente']) ordem?: string;
    @IsOptional() @IsIn(['asc', 'desc']) direcao?: 'asc' | 'desc';
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina?: number;
    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) porPagina?: number;
}

/** #166 — `GET /api/cc/extrato` (v10 §6.5). */
export class ExtratoQueryDto {
    @Type(() => Number) @IsInt() clienteId: number;
    @IsOptional() @IsDateString() de?: string;
    @IsOptional() @IsDateString() ate?: string;
}
