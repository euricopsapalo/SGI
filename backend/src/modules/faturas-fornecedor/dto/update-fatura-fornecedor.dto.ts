import { PartialType } from '@nestjs/mapped-types';
import { CreateFaturaFornecedorDto } from './create-fatura-fornecedor.dto';

export class UpdateFaturaFornecedorDto extends PartialType(CreateFaturaFornecedorDto) {}
