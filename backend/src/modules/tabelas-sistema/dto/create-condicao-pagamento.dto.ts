import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCondicaoPagamentoDto {
  @IsString() @IsNotEmpty() descricao: string;
  @IsOptional() @IsNumber() numDias?: number;
  @IsOptional() @IsNumber() desconto?: number;
}
