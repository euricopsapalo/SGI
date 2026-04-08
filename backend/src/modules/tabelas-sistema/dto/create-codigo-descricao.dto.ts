import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCodigoDescricaoDto {
  @IsString() @IsNotEmpty() codigo: string;
  @IsString() @IsNotEmpty() descricao: string;
}
