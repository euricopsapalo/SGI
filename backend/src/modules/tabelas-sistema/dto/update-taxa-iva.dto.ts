import { PartialType } from '@nestjs/mapped-types';
import { CreateTaxaIvaDto } from './create-taxa-iva.dto';

export class UpdateTaxaIvaDto extends PartialType(CreateTaxaIvaDto) {}
