import { PartialType } from '@nestjs/mapped-types';
import { CreateCondicaoPagamentoDto } from './create-condicao-pagamento.dto';

export class UpdateCondicaoPagamentoDto extends PartialType(CreateCondicaoPagamentoDto) {}
