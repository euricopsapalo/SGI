import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateProvinciaDto {
  @IsString() @IsNotEmpty() nome: string;
  @IsNumber() @IsNotEmpty() paisId: number;
}
