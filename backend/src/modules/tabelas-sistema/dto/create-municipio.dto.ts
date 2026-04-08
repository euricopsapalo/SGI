import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateMunicipioDto {
  @IsString() @IsNotEmpty() nome: string;
  @IsNumber() @IsNotEmpty() provinciaId: number;
}
