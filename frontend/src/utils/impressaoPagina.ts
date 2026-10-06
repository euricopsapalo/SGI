/**
 * #180 — Regra uniforme de página para TODAS as impressões do sistema
 * (faturas, recibos, OTs, encomendas, fichas, listagens, exportações):
 *
 * - Paginação "Pág. x/y" no **canto superior direito**, como no modelo de referência.
 * - Os restantes cantos ficam vazios: definir as caixas de margem da página faz o
 *   navegador (Chrome/Edge) deixar de imprimir o seu cabeçalho (data, título) e o
 *   seu rodapé (URL, n.º de página) ao guardar em PDF ou imprimir.
 * - Margens iguais em todos os documentos. Na impressão, o padding que alguns
 *   templates usavam para simular margens é anulado (senão ficariam duplicadas).
 * - O tamanho/orientação de cada documento mantém-se (lido do seu `@page`).
 */

/** Margens da página, em mm: cima, lados, baixo (cabe a paginação no topo). */
export const MARGENS_PAGINA = { cima: 14, lados: 12, baixo: 14 };

/** Tamanho declarado pelo documento (`@page { size: … }`), ou A4 vertical. */
export function tamanhoPagina(html: string): string {
    const m = /@page\s*\{[^}]*?size:\s*([^;}]+)/.exec(html);
    const tamanho = m?.[1].trim();
    if (!tamanho) return 'A4 portrait';
    return /portrait|landscape/.test(tamanho) ? tamanho : `${tamanho} portrait`;
}

/** CSS da regra uniforme para um tamanho de página. */
export function cssPagina(tamanho = 'A4 portrait'): string {
    const { cima, lados, baixo } = MARGENS_PAGINA;
    return `
@page {
    size: ${tamanho};
    margin: ${cima}mm ${lados}mm ${baixo}mm;
    @top-left { content: ""; }
    @top-center { content: ""; }
    @top-right { content: "Pág. " counter(page) "/" counter(pages); font: 9px Arial, Helvetica, sans-serif; color: #111; vertical-align: bottom; }
    @bottom-left { content: ""; }
    @bottom-center { content: ""; }
    @bottom-right { content: ""; }
}
@media print {
    html, body { margin: 0 !important; padding: 0 !important; max-width: none !important; }
}`;
}

const MARCA = 'data-pagina-sgi';

/**
 * Aplica a regra uniforme a um documento HTML de impressão: acrescenta o CSS no
 * fim do `<head>` (depois dos estilos do template, para prevalecer). Idempotente.
 */
export function comPaginacao(html: string): string {
    if (html.includes(MARCA)) return html;
    const estilo = `<style ${MARCA}>${cssPagina(tamanhoPagina(html))}</style>`;
    if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${estilo}</head>`);
    return `${estilo}${html}`;
}
