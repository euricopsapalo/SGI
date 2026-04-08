import { PartialType } from '@nestjs/mapped-types';
import { CreateDescricaoSimplesDto } from './create-descricao-simples.dto';

export class UpdateDescricaoSimplesDto extends PartialType(CreateDescricaoSimplesDto) {}
