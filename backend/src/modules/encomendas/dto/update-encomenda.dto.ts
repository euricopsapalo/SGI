import { PartialType } from '@nestjs/mapped-types';
import { CreateEncomendaDto } from './create-encomenda.dto';

export class UpdateEncomendaDto extends PartialType(CreateEncomendaDto) {}
