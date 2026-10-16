import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { CreateOrdemTrabalhoDto } from './create-ordem-trabalho.dto';

export class UpdateOrdemTrabalhoDto extends PartialType(CreateOrdemTrabalhoDto) {
  // #199 — correção das datas de execução (o modal só as ativa a partir de
  // "Em execução"). Não mudam o estado: esse só muda pelas transições.
  @IsOptional() @IsString() dataInicio?: string;
  @IsOptional() @IsString() dataFim?: string;
}
