import { IsOptional, IsString } from 'class-validator';

/** DTOs das transições da máquina de estados da OT (RF-OT-001). */

export class AgendarOtDto {
  @IsOptional() @IsString() dataProgInicio?: string;
  @IsOptional() @IsString() dataProgFim?: string;
  @IsOptional() @IsString() usuario?: string;
}

export class ConfirmarOtDto {
  @IsOptional() @IsString() usuario?: string;
}

export class AdiarOtDto {
  @IsOptional() @IsString() motivo?: string;
  @IsOptional() @IsString() usuario?: string;
}

export class IniciarOtDto {
  @IsOptional() @IsString() dataInicio?: string;
  @IsOptional() @IsString() usuario?: string;
}

export class FinalizarOtDto {
  @IsOptional() @IsString() dataFim?: string;
  @IsOptional() @IsString() usuario?: string;
}
