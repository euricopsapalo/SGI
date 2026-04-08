import { IsNotEmpty, IsNumber } from 'class-validator';

export class AjusteExistenciaDto {
  @IsNumber() @IsNotEmpty() delta: number;
}
