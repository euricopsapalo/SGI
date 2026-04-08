import { PartialType } from '@nestjs/mapped-types';
import { CreateModoPagamentoDto } from './create-modo-pagamento.dto';

export class UpdateModoPagamentoDto extends PartialType(CreateModoPagamentoDto) {}
