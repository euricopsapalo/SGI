import { comPaginacao, cssPagina, tamanhoPagina } from './impressaoPagina';

/** #180 — regra uniforme de página para todas as impressões. */
describe('impressaoPagina', () => {
    it('paginação "Pág. x/y" no canto superior direito e os outros cantos vazios (sem cabeçalho/rodapé do navegador)', () => {
        const css = cssPagina();
        expect(css).toContain('@top-right { content: "Pág. " counter(page) "/" counter(pages)');
        for (const canto of ['@top-left', '@top-center', '@bottom-left', '@bottom-center', '@bottom-right']) {
            expect(css).toContain(`${canto} { content: ""; }`);
        }
        expect(css).toContain('margin: 14mm 12mm 14mm;');
        expect(css).toMatch(/@media print \{\s*html, body \{ margin: 0 !important; padding: 0 !important;/);
    });

    it('mantém o tamanho/orientação declarados pelo documento', () => {
        expect(tamanhoPagina('<style>@page { size: A4 landscape; margin: 0; }</style>')).toBe('A4 landscape');
        expect(tamanhoPagina('<style>@page{size:A4;margin:18mm 15mm}</style>')).toBe('A4 portrait');
        expect(tamanhoPagina('<style>body{}</style>')).toBe('A4 portrait');
    });

    it('comPaginacao acrescenta o CSS no fim do <head>, uma só vez', () => {
        const html = '<html><head><style>@page { size: A4 landscape; margin: 0; }</style></head><body>x</body></html>';
        const r = comPaginacao(html);
        expect(r).toMatch(/<style>@page \{ size: A4 landscape; margin: 0; \}<\/style><style data-pagina-sgi>[\s\S]*size: A4 landscape;[\s\S]*<\/style><\/head>/);
        expect(comPaginacao(r)).toBe(r);
        expect(comPaginacao('<p>sem head</p>')).toMatch(/^<style data-pagina-sgi>[\s\S]*<\/style><p>sem head<\/p>$/);
    });
});
