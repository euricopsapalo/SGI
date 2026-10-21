import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

/** #210 — filtros e paginação de `GET /logs` (aplicados no servidor). */
export class ListarLogsDto {
  @IsOptional() @IsInt() @Min(1) pagina?: number;
  @IsOptional() @IsInt() @Min(1) @Max(200) porPagina?: number;
  /** Utilizador exato (e-mail gravado no registo — #209). */
  @IsOptional() @IsString() usuario?: string;
  @IsOptional() @IsString() modulo?: string;
  @IsOptional() @IsEnum(['info', 'warning', 'error']) tipo?: string;
  /** Pesquisa livre na ação, nos detalhes e no utilizador. */
  @IsOptional() @IsString() q?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'de deve ser AAAA-MM-DD' }) de?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'ate deve ser AAAA-MM-DD' }) ate?: string;
}
