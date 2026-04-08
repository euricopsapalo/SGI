import { PartialType } from '@nestjs/mapped-types';
import { CreatePlanoDto } from './create-plano.dto';

export class UpdatePlanoDto extends PartialType(CreatePlanoDto) {}
