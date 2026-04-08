import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateFuncaoTecnicoDto {
  @IsString() @IsNotEmpty() codigo: string;
  @IsString() @IsNotEmpty() descricao: string;
  @IsOptional() @IsNumber() custo?: number;
}
