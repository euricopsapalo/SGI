import { PartialType } from '@nestjs/mapped-types';
import { CreateFuncaoTecnicoDto } from './create-funcao-tecnico.dto';

export class UpdateFuncaoTecnicoDto extends PartialType(CreateFuncaoTecnicoDto) {}
