import { contentDisposition, decidirPedido, nomeFicheiroPdf, URL_DOCUMENTO } from './pdf.rules';

/** #182 — regras puras da geração de PDF. */
describe('pdf.rules', () => {
    it('decidirPedido: documento só na navegação; data: passa; rede, rede interna e file:// bloqueados', () => {
        expect(decidirPedido(URL_DOCUMENTO, true)).toBe('documento');
        expect(decidirPedido(URL_DOCUMENTO, false)).toBe('bloquear');
        expect(decidirPedido('data:image/png;base64,AAAA', false)).toBe('permitir');
        for (const url of ['https://exemplo.com/logo.png', 'http://localhost:3001/api/users', 'http://169.254.169.254/', 'file:///etc/passwd', 'about:blank']) {
            expect(decidirPedido(url, true)).toBe('bloquear');
        }
    });

    it('nomeFicheiroPdf: limpa caracteres inválidos e garante .pdf', () => {
        expect(nomeFicheiroPdf('FT 2026/1')).toBe('FT 2026-1.pdf');
        expect(nomeFicheiroPdf('Relatório: "Técnicos"')).toBe('Relatório- -Técnicos-.pdf');
        expect(nomeFicheiroPdf('OT-000007.PDF')).toBe('OT-000007.pdf');
        expect(nomeFicheiroPdf('  ')).toBe('documento.pdf');
        expect(nomeFicheiroPdf(undefined)).toBe('documento.pdf');
        expect(nomeFicheiroPdf('a\r\nb')).toBe('a--b.pdf'); // sem quebras de linha no cabeçalho HTTP
        expect(nomeFicheiroPdf('x'.repeat(300))).toHaveLength(124);
    });

    it('contentDisposition: nome ASCII de recurso e nome UTF-8 codificado', () => {
        expect(contentDisposition('Relatório Técnicos.pdf')).toBe(
            `inline; filename="Relatorio Tecnicos.pdf"; filename*=UTF-8''Relat%C3%B3rio%20T%C3%A9cnicos.pdf`,
        );
        expect(contentDisposition('Ação №1.pdf', 'attachment')).toMatch(/^attachment; filename="Acao _1.pdf"; filename\*=UTF-8''/);
    });
});
