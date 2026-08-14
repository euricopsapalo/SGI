import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class TransferenciaStockDto {
  @IsNumber() @IsNotEmpty() armazemOrigemId: number;
  @IsNumber() @IsNotEmpty() armazemDestinoId: number;
  @IsNumber() @IsPositive() quantidade: number;
  @IsOptional() @IsString() usuario?: string;
  @IsOptional() @IsString() observacao?: string;
}
