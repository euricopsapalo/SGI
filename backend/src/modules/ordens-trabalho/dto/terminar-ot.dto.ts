import { IsOptional, IsString } from 'class-validator';

export class TerminarOtDto {
  @IsOptional() @IsString() dataFim?: string;
}
