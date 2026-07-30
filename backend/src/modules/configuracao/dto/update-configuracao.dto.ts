import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateConfiguracaoDto {
  @IsOptional() @IsString() nome?: string;
  @IsOptional() @IsString() nif?: string;
  @IsOptional() @IsString() morada?: string;
  @IsOptional() @IsString() telefone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() rodapeDocumentos?: string;
  @IsOptional() @IsString() iban?: string;
  @IsOptional() @IsString() banco?: string;
  @IsOptional() @IsNumber() mesesManutencaoPreventiva?: number;
  @IsOptional() @IsNumber() diasAlertaManutencao?: number;
  @IsOptional() @IsString() moeda?: string;
  @IsOptional() @IsString() fusoHorario?: string;
  @IsOptional() @IsNumber() taxaIva?: number;
  @IsOptional() @IsNumber() casasDecimais?: number;
  @IsOptional() @IsString() formatoData?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  // Segurança (issue #100)
  @IsOptional() @IsNumber() @Min(4) @Max(64) minPasswordLength?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1440) sessionExpiryMinutes?: number;
  @IsOptional() @IsBoolean() twoFactorEnabled?: boolean;
  @IsOptional() @IsBoolean() accessLogEnabled?: boolean;
}
