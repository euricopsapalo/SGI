import { PartialType } from '@nestjs/mapped-types';
import { CreateOrdemTrabalhoDto } from './create-ordem-trabalho.dto';

export class UpdateOrdemTrabalhoDto extends PartialType(CreateOrdemTrabalhoDto) {}
