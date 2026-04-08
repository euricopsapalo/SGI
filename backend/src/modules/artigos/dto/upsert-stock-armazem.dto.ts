import { IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class UpsertStockArmazemDto {
  @IsNumber() @IsNotEmpty() armazemId: number;
  @IsOptional() @IsNumber() quantidade?: number;
  @IsOptional() @IsNumber() stockMinimo?: number;
}
