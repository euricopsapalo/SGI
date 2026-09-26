import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** #164 — Série de um documento. Datas derivam do ano (v10 §2.1). */
export class CreateSerieDto {
    @IsInt() documentoConfigId: number;

    @IsString() @IsNotEmpty() @MaxLength(20)
    codigo: string;

    @IsInt() @Min(2000) @Max(2100)
    ano: number;

    @IsOptional() @IsInt() @Min(0)
    limiteInferior?: number;

    @IsOptional() @IsInt() @Min(1)
    limiteSuperior?: number;

    @IsOptional() @IsBoolean() porDefeito?: boolean;
    @IsOptional() @IsBoolean() sugereDataSistema?: boolean;
    @IsOptional() @IsBoolean() ativo?: boolean;
}

/** A série não muda de documento. */
export class UpdateSerieDto extends PartialType(OmitType(CreateSerieDto, ['documentoConfigId'] as const)) {}
