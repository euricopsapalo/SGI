import { IsNotEmpty, IsString } from 'class-validator';

export class CreateMoedaDto {
  @IsString() @IsNotEmpty() codigo: string;
  @IsString() @IsNotEmpty() descricao: string;
  @IsString() @IsNotEmpty() simbolo: string;
}
