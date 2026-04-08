import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateMovimentoStockDto {
  @IsNumber() @IsNotEmpty() artigoId: number;
  @IsEnum(['entrada', 'saida', 'ajuste', 'transferencia', 'devolucao']) tipo: string;
  @IsNumber() @IsNotEmpty() quantidade: number;
  @IsOptional() @IsString() armazemId?: string;
  @IsOptional() @IsString() armazemDestinoId?: string;
  @IsOptional() @IsString() referencia?: string;
  @IsOptional() @IsString() usuario?: string;
  @IsOptional() @IsString() observacao?: string;
}
