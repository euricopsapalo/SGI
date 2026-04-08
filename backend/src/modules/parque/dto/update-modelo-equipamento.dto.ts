import { PartialType } from '@nestjs/mapped-types';
import { CreateModeloEquipamentoDto } from './create-modelo-equipamento.dto';

export class UpdateModeloEquipamentoDto extends PartialType(CreateModeloEquipamentoDto) {}
