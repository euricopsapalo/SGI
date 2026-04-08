import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePaisDto {
  @IsString() @IsNotEmpty() nome: string;
  @IsString() @IsNotEmpty() codigo: string;
}
