import { PartialType } from '@nestjs/mapped-types';
import { CreateArmazemDto } from './create-armazem.dto';

export class UpdateArmazemDto extends PartialType(CreateArmazemDto) {}
