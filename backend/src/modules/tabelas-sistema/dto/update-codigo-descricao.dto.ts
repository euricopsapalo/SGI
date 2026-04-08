import { PartialType } from '@nestjs/mapped-types';
import { CreateCodigoDescricaoDto } from './create-codigo-descricao.dto';

export class UpdateCodigoDescricaoDto extends PartialType(CreateCodigoDescricaoDto) {}
