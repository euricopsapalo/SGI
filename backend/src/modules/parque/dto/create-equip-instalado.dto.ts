import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateEquipInstaladoDto {
  @IsNumber() @IsNotEmpty() clienteId: number;
  @IsNumber() @IsNotEmpty() modeloId: number;
  @IsString() @IsNotEmpty() nrSerie: string;
  @IsString() @IsNotEmpty() dataInstalacao: string;
  @IsOptional() @IsEnum(['ativo', 'com_problema', 'inativo']) estado?: string;
  @IsOptional() @IsString() dataUltimaManutencao?: string;
  @IsOptional() @IsString() dataProximaManutencao?: string;
  @IsOptional() @IsString() localizacao?: string;
}
