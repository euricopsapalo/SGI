import { PartialType } from '@nestjs/mapped-types';
import { CreateFaturaDto } from './create-fatura.dto';

export class UpdateFaturaDto extends PartialType(CreateFaturaDto) {}
