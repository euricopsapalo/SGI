import {
    GatewayTimeoutException, InternalServerErrorException, PayloadTooLargeException, ServiceUnavailableException,
} from '@nestjs/common';

const mockLaunch = jest.fn();
jest.mock('puppeteer-core', () => {
    class TimeoutError extends Error {}
    return { __esModule: true, default: { launch: (...a: any[]) => mockLaunch(...a) }, TimeoutError };
});

import { TimeoutError } from 'puppeteer-core';
import { MAX_RENDERS_SIMULTANEOS, PdfService } from './pdf.service';
import { CSP_DOCUMENTO, LIMITE_HTML, URL_DOCUMENTO } from './pdf.rules';

/**
 * #182 — PdfService com o puppeteer simulado: isolamento do render (contexto
 * próprio, JS desligado, pedidos interceptados), erros e concorrência. O e2e
 * `test/impressao-pdf.e2e.spec.ts` gera PDFs reais com o Chromium.
 */
describe('PdfService', () => {
    let svc: PdfService;
    let page: any; let contexto: any; let browser: any;
    let handler: (req: any) => void;
    const env = process.env.PUPPETEER_EXECUTABLE_PATH;

    const pedido = (url: string, nav = false) => ({
        url: () => url, isNavigationRequest: () => nav,
        respond: jest.fn(), continue: jest.fn(), abort: jest.fn(),
    });

    beforeEach(() => {
        process.env.PUPPETEER_EXECUTABLE_PATH = '/usr/bin/chromium-browser';
        page = {
            setDefaultTimeout: jest.fn(),
            setJavaScriptEnabled: jest.fn(),
            setRequestInterception: jest.fn(),
            on: jest.fn((ev: string, h: any) => { if (ev === 'request') handler = h; }),
            goto: jest.fn(async () => {
                // o Chromium navega para o documento e pede um recurso externo e uma imagem embutida
                handler(pedido(URL_DOCUMENTO, true));
                handler(pedido('http://169.254.169.254/latest/meta-data'));
                handler(pedido('data:image/png;base64,AAAA'));
            }),
            pdf: jest.fn(async () => new Uint8Array([37, 80, 68, 70])),
        };
        contexto = { newPage: jest.fn(async () => page), close: jest.fn(async () => undefined) };
        browser = { createBrowserContext: jest.fn(async () => contexto), on: jest.fn(), close: jest.fn() };
        mockLaunch.mockReset().mockResolvedValue(browser);
        svc = new PdfService();
    });
    afterAll(() => { process.env.PUPPETEER_EXECUTABLE_PATH = env; });

    it('gera o PDF num contexto próprio, com JS desligado, sem cabeçalho/rodapé e com o tamanho do @page', async () => {
        const pdf = await svc.gerar('<html><body>Fatura</body></html>');
        expect(pdf.toString()).toBe('%PDF');
        expect(mockLaunch).toHaveBeenCalledWith(expect.objectContaining({ executablePath: '/usr/bin/chromium-browser', headless: true }));
        expect(page.setJavaScriptEnabled).toHaveBeenCalledWith(false);
        expect(page.setRequestInterception).toHaveBeenCalledWith(true);
        expect(page.goto).toHaveBeenCalledWith(URL_DOCUMENTO, expect.objectContaining({ waitUntil: 'load' }));
        expect(page.pdf).toHaveBeenCalledWith(expect.objectContaining({ preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false }));
        expect(contexto.close).toHaveBeenCalled();
    });

    it('serve o documento da memória com CSP; deixa passar data:; bloqueia o resto', async () => {
        const reqs: any[] = [];
        page.goto.mockImplementation(async () => {
            for (const r of [pedido(URL_DOCUMENTO, true), pedido('https://exemplo.com/x.png'), pedido('file:///etc/passwd'), pedido('data:image/png;base64,AA'), pedido(URL_DOCUMENTO, false)]) {
                reqs.push(r); handler(r);
            }
        });
        await svc.gerar('<p>olá</p>');
        const [doc, externo, ficheiro, dados, docSemNavegacao] = reqs;
        expect(doc.respond).toHaveBeenCalledWith(expect.objectContaining({
            status: 200, contentType: 'text/html; charset=utf-8', body: '<p>olá</p>',
            headers: { 'Content-Security-Policy': CSP_DOCUMENTO },
        }));
        expect(externo.abort).toHaveBeenCalledWith('blockedbyclient');
        expect(ficheiro.abort).toHaveBeenCalled();
        expect(dados.continue).toHaveBeenCalled();
        expect(docSemNavegacao.abort).toHaveBeenCalled();
    });

    it('reutiliza o browser entre pedidos e relança-o depois de se desligar', async () => {
        await svc.gerar('<p>1</p>');
        await svc.gerar('<p>2</p>');
        expect(mockLaunch).toHaveBeenCalledTimes(1);
        const desligado = browser.on.mock.calls.find((c: any[]) => c[0] === 'disconnected')[1];
        desligado();
        await svc.gerar('<p>3</p>');
        expect(mockLaunch).toHaveBeenCalledTimes(2);
        await svc.onModuleDestroy();
        expect(browser.close).toHaveBeenCalled();
    });

    it('HTML acima do limite → 413, sem lançar o browser', async () => {
        await expect(svc.gerar('x'.repeat(LIMITE_HTML + 1))).rejects.toBeInstanceOf(PayloadTooLargeException);
        expect(mockLaunch).not.toHaveBeenCalled();
    });

    it('sem Chromium configurado ou que não arranca → 503 (e volta a tentar no pedido seguinte)', async () => {
        delete process.env.PUPPETEER_EXECUTABLE_PATH;
        await expect(svc.gerar('<p/>')).rejects.toBeInstanceOf(ServiceUnavailableException);
        process.env.PUPPETEER_EXECUTABLE_PATH = '/x';
        mockLaunch.mockRejectedValueOnce(new Error('spawn ENOENT'));
        await expect(svc.gerar('<p/>')).rejects.toBeInstanceOf(ServiceUnavailableException);
        await expect(svc.gerar('<p/>')).resolves.toBeInstanceOf(Buffer);
    });

    it('timeout → 504; outro erro → 500 sem o conteúdo no log; o contexto fecha sempre', async () => {
        page.pdf.mockRejectedValueOnce(new (TimeoutError as any)('Timed out'));
        await expect(svc.gerar('<p/>')).rejects.toBeInstanceOf(GatewayTimeoutException);
        const log = jest.spyOn((svc as any).logger, 'error').mockImplementation(() => undefined);
        page.goto.mockRejectedValueOnce(new Error('net::ERR_FAILED'));
        await expect(svc.gerar('<p>SEGREDO</p>')).rejects.toBeInstanceOf(InternalServerErrorException);
        expect(log.mock.calls.flat().join(' ')).not.toContain('SEGREDO');
        expect(contexto.close).toHaveBeenCalledTimes(2);
    });

    it(`no máximo ${MAX_RENDERS_SIMULTANEOS} renders em simultâneo; os outros esperam a vez`, async () => {
        let emCurso = 0; let maximo = 0;
        const libertar: (() => void)[] = [];
        page.pdf.mockImplementation(() => new Promise((resolve) => {
            emCurso++; maximo = Math.max(maximo, emCurso);
            libertar.push(() => { emCurso--; resolve(new Uint8Array([1])); });
        }));
        const todos = Array.from({ length: 5 }, (_, i) => svc.gerar(`<p>${i}</p>`));
        await new Promise((r) => setTimeout(r, 10));
        expect(emCurso).toBe(MAX_RENDERS_SIMULTANEOS);
        while (libertar.length || emCurso) {
            libertar.shift()?.();
            await new Promise((r) => setTimeout(r, 5));
        }
        await Promise.all(todos);
        expect(maximo).toBe(MAX_RENDERS_SIMULTANEOS);
    });
});
