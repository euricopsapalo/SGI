import { Type } from 'class-transformer';
import {
    ArrayMinSize, IsArray, IsDateString, IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, MaxLength, Min,
    ValidateNested,
} from 'class-validator';

/** #165 — Cria o rascunho de um documento de venda a partir de uma OT (v11 §4.2). */
export class CreateDocumentoVendaDto {
    @IsInt() otId: number;
    @IsInt() documentoConfigId: number;
}

/**
 * Linha do rascunho. Identifica-se pela linha de consumo da OT (`otArtigoId`),
 * o que impede acrescentar artigos que não vieram da OT; as linhas omitidas
 * são removidas do rascunho. O preço não é editável (é o da OT — D3).
 */
export class LinhaRascunhoDto {
    @IsInt() otArtigoId: number;

    @IsOptional() @IsString() @MaxLength(300)
    descricao?: string;

    @IsOptional() @IsNumber({ maxDecimalPlaces: 3 }) @IsPositive()
    quantidade?: number;

    @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100)
    desconto?: number;
}

/** #165 — Edição do rascunho (só em RASCUNHO — D6). */
export class UpdateDocumentoVendaDto {
    @IsOptional() @IsString() @MaxLength(5000)
    observacoes?: string | null;

    @IsOptional() @IsInt()
    modoPagamentoId?: number | null;

    /** #178 — n.º de requisição/encomenda do cliente. */
    @IsOptional() @IsString() @MaxLength(50)
    requisicao?: string | null;

    @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100)
    descontoGlobal?: number;

    @IsOptional() @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => LinhaRascunhoDto)
    linhas?: LinhaRascunhoDto[];
}

/** #165 — Emissão (v11 §7.2). Sem série → série por defeito; sem data-hora → agora. */
export class EmitirDocumentoVendaDto {
    @IsOptional() @IsInt()
    serieId?: number;

    @IsOptional() @IsDateString()
    dataHora?: string;
}
