import { IsNotEmpty, IsString } from 'class-validator';

export class CreateModoPagamentoDto {
  @IsString() @IsNotEmpty() movimento: string;
  @IsString() @IsNotEmpty() descricao: string;
}
