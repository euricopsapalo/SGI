import { PartialType } from '@nestjs/mapped-types';
import { CreateTecnicoDto } from './create-tecnico.dto';

export class UpdateTecnicoDto extends PartialType(CreateTecnicoDto) {}
