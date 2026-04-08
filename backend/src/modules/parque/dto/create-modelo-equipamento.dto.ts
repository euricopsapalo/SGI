import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateModeloEquipamentoDto {
  @IsString() @IsNotEmpty() nome: string;
  @IsString() @IsNotEmpty() marca: string;
  @IsOptional() @IsEnum(['maquina', 'filtro']) tipo?: string;
}
