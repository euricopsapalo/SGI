import { PartialType } from '@nestjs/mapped-types';
import {
    IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength,
} from 'class-validator';

/**
 * #164 — Configuração de um documento. A validação estrutural (tipos) é feita
 * aqui; a validação de negócio (o que está disponível e é elegível para cada
 * tipo) é feita pela matriz (`validarConfiguracao`), nunca no DTO.
 */
export class CreateDocumentoConfigDto {
    @IsString() @Matches(/^[A-Z0-9]{1,10}$/, { message: 'Código: 1 a 10 letras maiúsculas ou dígitos' })
    codigo: string;

    @IsString() @IsNotEmpty() @MaxLength(150)
    descricao: string;

    @IsString() @IsNotEmpty()
    tipoCodigo: string;

    @IsOptional() @IsString() natureza?: string | null;
    @IsOptional() @IsString() entidadePermitida?: string | null;
    @IsOptional() @IsString() tipoFiscal?: string | null;

    @IsOptional() @IsBoolean() geraMovCc?: boolean;
    @IsOptional() @IsBoolean() operaSobreCc?: boolean;
    @IsOptional() @IsBoolean() ligacaoTesouraria?: boolean;
    @IsOptional() @IsBoolean() liquidacaoAutomatica?: boolean;
    @IsOptional() @IsBoolean() estorno?: boolean;

    @IsOptional() @IsInt() ccTipoId?: number | null;
    @IsOptional() @IsInt() ccEstadoId?: number | null;
    @IsOptional() @IsInt() ligacaoTesourariaDocId?: number | null;
    @IsOptional() @IsInt() liquidacaoAutoDocId?: number | null;
    @IsOptional() @IsInt() estornoDocId?: number | null;
    @IsOptional() @IsInt() estornoSerieId?: number | null;
    @IsOptional() @IsInt() acertoSobraDocId?: number | null;
    @IsOptional() @IsInt() acertoQuebraDocId?: number | null;

    @IsOptional() @IsArray() @IsInt({ each: true })
    contasBancariaIds?: number[];

    @IsOptional() @IsBoolean() ativo?: boolean;
}

export class UpdateDocumentoConfigDto extends PartialType(CreateDocumentoConfigDto) {}
