import api from '../services/api';
import { imprimirPdf, nomePdf, semScripts, tituloHtml } from './imprimirPdf';
import * as errorHandler from './errorHandler';

jest.mock('../services/api', () => ({ __esModule: true, default: { post: jest.fn() } }));

/** #182 — utilitário único de impressão: PDF gerado no servidor, mostrado numa janela nova. */
describe('imprimirPdf', () => {
    const post = api.post as jest.Mock;
    let janela: any;
    let toast: jest.SpyInstance;

    beforeEach(() => {
        const doc = document.implementation.createHTMLDocument('');
        janela = { document: doc, close: jest.fn(), focus: jest.fn(), closed: false, location: { href: '' } };
        jest.spyOn(window, 'open').mockReturnValue(janela);
        (URL as any).createObjectURL = jest.fn(() => 'blob:http://localhost/pdf-1');
        (URL as any).revokeObjectURL = jest.fn();
        toast = jest.spyOn(errorHandler, 'showToast').mockImplementation(() => undefined);
        post.mockReset().mockResolvedValue({ data: new Blob(['%PDF'], { type: 'application/pdf' }) });
    });
    afterEach(() => jest.restoreAllMocks());

    const html = '<!DOCTYPE html><html><head><title>Fatura FT 2026/1</title></head><body>x<script>window.print()</script></body></html>';

    it('envia o HTML com a regra de página e sem scripts; mostra o PDF com Imprimir e Descarregar', async () => {
        expect(await imprimirPdf(html)).toBe(true);
        expect(window.open).toHaveBeenCalledWith('', '_blank');
        const [url, corpo, opts] = post.mock.calls[0];
        expect(url).toBe('/impressao/pdf');
        expect(opts).toEqual({ responseType: 'blob' });
        expect(corpo.nomeFicheiro).toBe('Fatura FT 2026-1.pdf');
        expect(corpo.html).toContain('data-pagina-sgi'); // comPaginacao (#180)
        expect(corpo.html).not.toContain('<script');

        const d: Document = janela.document;
        expect(d.title).toBe('Fatura FT 2026-1.pdf');
        expect(d.querySelector('iframe')!.getAttribute('src')).toBe('blob:http://localhost/pdf-1');
        const a = d.querySelector('a[download]')!;
        expect(a.getAttribute('download')).toBe('Fatura FT 2026-1.pdf');
        expect(d.getElementById('sgi-imprimir')).not.toBeNull();
    });

    it('a janela abre antes de obter o HTML (no clique) e usa o nome indicado', async () => {
        let aberta = false;
        const fonte = jest.fn(async () => { aberta = (window.open as jest.Mock).mock.calls.length === 1; return html; });
        await imprimirPdf(fonte, 'OT-000007');
        expect(aberta).toBe(true);
        expect(post.mock.calls[0][1].nomeFicheiro).toBe('OT-000007.pdf');
    });

    it('pop-up bloqueado → aviso e false, sem pedir o PDF', async () => {
        (window.open as jest.Mock).mockReturnValue(null);
        expect(await imprimirPdf(html)).toBe(false);
        expect(post).not.toHaveBeenCalled();
        expect(toast).toHaveBeenCalledWith(expect.stringMatching(/pop-ups/), 'error');
    });

    it('erro da API → fecha a janela sem segundo aviso (o interceptor já avisou); cancelamento → silêncio', async () => {
        post.mockRejectedValueOnce({ response: { status: 503, data: { message: 'indisponível' } } });
        expect(await imprimirPdf(html)).toBe(false);
        expect(janela.close).toHaveBeenCalled();
        expect(toast).not.toHaveBeenCalled();

        expect(await imprimirPdf(() => Promise.reject(Symbol('cancelado')))).toBe(false);
        expect(toast).not.toHaveBeenCalled();

        expect(await imprimirPdf(() => Promise.reject(new Error('falhou a obter')))).toBe(false);
        expect(toast).toHaveBeenCalledWith('falhou a obter', 'error');
    });

    it('auxiliares: título, nome do ficheiro e remoção de scripts', () => {
        expect(tituloHtml('<title>Relat&oacute; &amp; Co</title>')).toBe('Relat&oacute; & Co');
        expect(tituloHtml('<p>sem título</p>')).toBeNull();
        expect(nomePdf('FT 2026/1')).toBe('FT 2026-1.pdf');
        expect(nomePdf('x.PDF')).toBe('x.pdf');
        expect(nomePdf('  ')).toBe('documento.pdf');
        expect(semScripts('<p>a</p><script type="x">b</script><SCRIPT>c</SCRIPT>')).toBe('<p>a</p>');
    });
});
