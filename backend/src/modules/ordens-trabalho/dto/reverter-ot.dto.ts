import { IsOptional, IsString } from 'class-validator';

export class ReverterOtDto {
  @IsOptional() @IsString() usuario?: string;
}
