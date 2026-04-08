import { IsNotEmpty, IsString } from 'class-validator';

export class CreateDescricaoSimplesDto {
  @IsString() @IsNotEmpty() descricao: string;
}
