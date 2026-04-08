import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateEstadoFaturaFornecedorDto {
  @IsString() @IsNotEmpty() estado: string;
  @IsOptional() @IsString() usuario?: string;
}
