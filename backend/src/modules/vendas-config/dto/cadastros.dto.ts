import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
    IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateNested,
} from 'class-validator';

const CODIGO = /^[A-Z0-9]{1,10}$/;
const CODIGO_MSG = 'Código: 1 a 10 letras maiúsculas ou dígitos';

// ── Tipo de conta corrente + estados ─────────────────────────────────────────
export class CcEstadoDto {
    @IsOptional() @IsInt() id?: number;
    @IsString() @Matches(CODIGO, { message: CODIGO_MSG }) codigo: string;
    @IsString() @IsNotEmpty() @MaxLength(150) descricao: string;
}

export class CreateCcTipoDto {
    @IsString() @Matches(CODIGO, { message: CODIGO_MSG }) codigo: string;
    @IsString() @IsNotEmpty() @MaxLength(150) descricao: string;
    @IsIn(['CLIENTE', 'FORNECEDOR']) entidade: 'CLIENTE' | 'FORNECEDOR';

    @IsArray() @ValidateNested({ each: true }) @Type(() => CcEstadoDto)
    estados: CcEstadoDto[];
}
export class UpdateCcTipoDto extends PartialType(CreateCcTipoDto) {}

// ── Conta bancária / caixa ───────────────────────────────────────────────────
export class CreateContaBancariaDto {
    @IsString() @Matches(/^[A-Z0-9]{1,20}$/, { message: 'Código: 1 a 20 letras maiúsculas ou dígitos' })
    codigo: string;
    @IsString() @IsNotEmpty() @MaxLength(150) descricao: string;
    @IsIn(['CAIXA', 'DO']) tipo: 'CAIXA' | 'DO';
    @IsOptional() @IsIn(['AOA']) moeda?: string;
    @IsOptional() @IsString() @MaxLength(100) banco?: string | null;
    @IsOptional() @IsString() @MaxLength(50) numero?: string | null;
    @IsOptional() @IsString() @MaxLength(50) iban?: string | null;
    @IsOptional() @IsString() @MaxLength(100) agencia?: string | null;
    @IsOptional() @IsString() @MaxLength(150) titular?: string | null;
    @IsOptional() @IsString() @MaxLength(150) gestor?: string | null;
    @IsOptional() @IsString() @MaxLength(150) contactos?: string | null;
    @IsOptional() @IsBoolean() ativo?: boolean;
}
export class UpdateContaBancariaDto extends PartialType(CreateContaBancariaDto) {}

// ── Motivo de estorno ────────────────────────────────────────────────────────
export class CreateMotivoEstornoDto {
    @IsString() @Matches(CODIGO, { message: CODIGO_MSG }) codigo: string;
    @IsString() @IsNotEmpty() @MaxLength(150) descricao: string;
    @IsOptional() @IsBoolean() ativo?: boolean;
}
export class UpdateMotivoEstornoDto extends PartialType(CreateMotivoEstornoDto) {}
