import { PartialType } from '@nestjs/mapped-types';
import { CreateMoedaDto } from './create-moeda.dto';

export class UpdateMoedaDto extends PartialType(CreateMoedaDto) {}
