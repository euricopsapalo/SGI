import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

/** #221 — filtros e paginação de `GET /movimentos-stock` (aplicados no servidor). */
export class ListarMovimentosDto {
  @IsOptional() @IsInt() @Min(1) pagina?: number;
  @IsOptional() @IsInt() @Min(1) @Max(500) porPagina?: number;
  @IsOptional() @IsEnum(['entrada', 'saida', 'ajuste', 'transferencia', 'devolucao']) tipo?: string;
  @IsOptional() @IsInt() artigoId?: number;
  /** Pesquisa no código ou na descrição do artigo. */
  @IsOptional() @IsString() q?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'de deve ser AAAA-MM-DD' }) de?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'ate deve ser AAAA-MM-DD' }) ate?: string;
}
