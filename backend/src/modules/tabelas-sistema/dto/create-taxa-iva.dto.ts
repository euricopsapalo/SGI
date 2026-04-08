import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateTaxaIvaDto {
  @IsString() @IsNotEmpty() codigo: string;
  @IsString() @IsNotEmpty() descricao: string;
  @IsOptional() @IsNumber() taxa?: number;
}
