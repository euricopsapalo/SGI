import {
    GatewayTimeoutException, HttpException, Injectable, InternalServerErrorException, Logger, OnModuleDestroy,
    PayloadTooLargeException, ServiceUnavailableException,
} from '@nestjs/common';
import puppeteer, { Browser, BrowserContext, HTTPRequest, TimeoutError } from 'puppeteer-core';
import { CSP_DOCUMENTO, decidirPedido, LIMITE_HTML, URL_DOCUMENTO } from './pdf.rules';

/** Tempo máximo de um render (carregar + gerar o PDF). */
export const TIMEOUT_RENDER_MS = 20_000;
/** Renders em simultâneo — os restantes esperam a vez. */
export const MAX_RENDERS_SIMULTANEOS = 3;

/**
 * #182 — Converte em PDF, com um Chromium headless, o HTML que cada impressão já
 * gera. O Chromium respeita a regra uniforme de página do #180 (`@page` com
 * "Pág. x/y" no canto superior direito), e um PDF aberto ou impresso em qualquer
 * browser não leva cabeçalho nem rodapé do navegador.
 *
 * Isolamento de cada render:
 * - contexto de browser próprio (sem cookies/cache partilhados), fechado no fim;
 * - JavaScript desligado;
 * - todos os pedidos de rede bloqueados excepto `data:` (o documento é servido da
 *   memória por interceptação) + CSP restritiva;
 * - limite de tamanho e timeout; o conteúdo nunca vai para os logs.
 * Uma única instância do browser, lançada no primeiro pedido e reutilizada.
 */
@Injectable()
export class PdfService implements OnModuleDestroy {
    private readonly logger = new Logger(PdfService.name);
    private browser: Promise<Browser> | null = null;
    private ativos = 0;
    private readonly fila: (() => void)[] = [];

    async gerar(html: string): Promise<Buffer> {
        if (html.length > LIMITE_HTML) {
            throw new PayloadTooLargeException(`O documento excede o tamanho máximo para gerar PDF (${LIMITE_HTML} caracteres)`);
        }
        await this.vaga();
        let contexto: BrowserContext | undefined;
        try {
            const browser = await this.obterBrowser();
            contexto = await browser.createBrowserContext();
            const page = await contexto.newPage();
            page.setDefaultTimeout(TIMEOUT_RENDER_MS);
            await page.setJavaScriptEnabled(false);
            await page.setRequestInterception(true);
            page.on('request', (req: HTTPRequest) => {
                const decisao = decidirPedido(req.url(), req.isNavigationRequest());
                if (decisao === 'documento') {
                    void req.respond({
                        status: 200,
                        contentType: 'text/html; charset=utf-8',
                        headers: { 'Content-Security-Policy': CSP_DOCUMENTO },
                        body: html,
                    });
                } else if (decisao === 'permitir') {
                    void req.continue();
                } else {
                    void req.abort('blockedbyclient');
                }
            });
            await page.goto(URL_DOCUMENTO, { waitUntil: 'load', timeout: TIMEOUT_RENDER_MS });
            const pdf = await page.pdf({
                preferCSSPageSize: true,
                printBackground: true,
                displayHeaderFooter: false,
                timeout: TIMEOUT_RENDER_MS,
            });
            return Buffer.from(pdf);
        } catch (e: any) {
            if (e instanceof HttpException) throw e;
            if (e instanceof TimeoutError) throw new GatewayTimeoutException('O documento demorou demasiado tempo a gerar — tente de novo');
            this.logger.error(`Falha ao gerar PDF: ${e?.message ?? e}`); // nunca o conteúdo
            throw new InternalServerErrorException('Não foi possível gerar o PDF');
        } finally {
            await contexto?.close().catch(() => undefined);
            this.libertar();
        }
    }

    async onModuleDestroy() {
        const b = this.browser;
        this.browser = null;
        if (b) await b.then((x) => x.close()).catch(() => undefined);
    }

    // ── browser ─────────────────────────────────────────────────────────────

    private obterBrowser(): Promise<Browser> {
        if (!this.browser) {
            const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
            if (!executablePath) {
                throw new ServiceUnavailableException('O gerador de PDF não está configurado no servidor (PUPPETEER_EXECUTABLE_PATH)');
            }
            this.browser = puppeteer.launch({
                executablePath,
                headless: true,
                // Em contentor como root o sandbox do Chromium não arranca; o isolamento
                // é garantido pelo JS desligado, rede bloqueada e CSP.
                args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none'],
            }).then((b) => {
                b.on('disconnected', () => { this.browser = null; });
                return b;
            }).catch((e) => {
                this.browser = null;
                this.logger.error(`Não foi possível lançar o Chromium: ${e?.message ?? e}`);
                throw new ServiceUnavailableException('O gerador de PDF não está disponível no servidor');
            });
        }
        return this.browser;
    }

    // ── concorrência ────────────────────────────────────────────────────────

    private vaga(): Promise<void> {
        if (this.ativos < MAX_RENDERS_SIMULTANEOS) {
            this.ativos++;
            return Promise.resolve();
        }
        return new Promise((resolve) => this.fila.push(() => { this.ativos++; resolve(); }));
    }

    private libertar() {
        this.ativos--;
        this.fila.shift()?.();
    }
}
