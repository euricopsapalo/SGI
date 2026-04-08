import { PartialType } from '@nestjs/mapped-types';
import { CreateEquipInstaladoDto } from './create-equip-instalado.dto';

export class UpdateEquipInstaladoDto extends PartialType(CreateEquipInstaladoDto) {}
