import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class FaturaLinhaDto {
  @IsString() @IsNotEmpty() descricao: string;
  @IsOptional() @IsNumber() quantidade?: number;
  @IsOptional() @IsNumber() precoUnit?: number;
}

export class CreateFaturaDto {
  @IsOptional() @IsString() tipoDocumento?: string;
  @IsOptional() @IsNumber() otId?: number;
  @IsOptional() @IsNumber() clienteId?: number;
  @IsString() @IsNotEmpty() dataEmissao: string;
  @IsOptional() @IsNumber() precoServico?: number;
  @IsOptional() @IsNumber() taxaIva?: number;
  @IsOptional() @IsNumber() valorSubtotal?: number;
  @IsOptional() @IsNumber() valorIva?: number;
  @IsOptional() @IsNumber() valorTotal?: number;
  @IsOptional() @IsString() moeda?: string;
  @IsOptional() @IsEnum(['Pendente', 'Paga', 'Anulada', 'Emitido']) estado?: string;
  @IsOptional() @IsString() observacoes?: string;
  @IsOptional() @IsString() dataPagamento?: string;
  @IsOptional() @IsString() motivoAnulacao?: string;
  @IsOptional() @IsString() comprovativo?: string;
  @IsOptional() @IsString() nrSerieEquip?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => FaturaLinhaDto) linhas?: FaturaLinhaDto[];
}
