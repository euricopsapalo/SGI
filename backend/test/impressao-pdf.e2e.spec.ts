import 'reflect-metadata';
import * as http from 'http';
import { AddressInfo } from 'net';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import * as request from 'supertest';
// pdf-parse/lib evita o modo de depuração do index (que lê um ficheiro de teste).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse: (b: Buffer) => Promise<{ numpages: number; text: string }> = require('pdf-parse/lib/pdf-parse.js');
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';
import { JwtStrategy } from '../src/modules/auth/jwt.strategy';
import { ImpressaoModule } from '../src/modules/impressao/impressao.module';
import { buildValidationPipe } from '../src/config/validation-pipe';
import { configurarCorpoPdf } from '../src/config/body-parser';

/**
 * #182 — PDFs reais gerados pelo Chromium headless, com a regra uniforme de página
 * do #180 (`comPaginacao`, reproduzida aqui como no frontend). Corre só com
 * `PUPPETEER_EXECUTABLE_PATH` definido (contentor do backend e CI).
 */
const describeChromium = process.env.PUPPETEER_EXECUTABLE_PATH ? describe : describe.skip;
const SECRET = 'test_secret_for_impressao_pdf_e2e_only';

/** Mesmo CSS que `frontend/src/utils/impressaoPagina.ts` aplica a todas as impressões. */
const comPaginacao = (html: string, tamanho = 'A4 portrait') => html.replace('</head>', `<style data-pagina-sgi>
@page { size: ${tamanho}; margin: 14mm 12mm 14mm;
  @top-left { content: ""; } @top-center { content: ""; }
  @top-right { content: "Pág. " counter(page) "/" counter(pages); font: 9px Arial, sans-serif; }
  @bottom-left { content: ""; } @bottom-center { content: ""; } @bottom-right { content: ""; } }
@media print { html, body { margin: 0 !important; padding: 0 !important; } }</style></head>`);

const documento = (corpo: string, titulo = 'Fatura FT 2026/1') =>
    comPaginacao(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titulo}</title></head><body>${corpo}</body></html>`);

/** Dimensões (pt) da 1.ª página, lidas do MediaBox. */
function mediaBox(pdf: Buffer): [number, number] {
    const m = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(pdf.toString('latin1'));
    if (!m) throw new Error('PDF sem MediaBox');
    return [Number(m[1]), Number(m[2])];
}

describeChromium('Impressão — PDF gerado no servidor (#182) E2E, Chromium real', () => {
    let app: INestApplication;
    let auth: string;
    let espiao: http.Server;
    let pedidosEspiao = 0;

    const pdf = (html: string, nomeFicheiro?: string) => request(app.getHttpServer())
        .post('/api/impressao/pdf').set('Authorization', auth)
        .send({ html, nomeFicheiro })
        .buffer(true).parse((res, cb) => {
            const partes: Buffer[] = [];
            res.on('data', (c: Buffer) => partes.push(c));
            res.on('end', () => cb(null, Buffer.concat(partes)));
        });

    beforeAll(async () => {
        process.env.JWT_SECRET = SECRET;
        const moduleRef = await Test.createTestingModule({
            imports: [PassportModule, JwtModule.register({ secret: SECRET }), ImpressaoModule],
            providers: [JwtStrategy, { provide: APP_GUARD, useClass: JwtAuthGuard }],
        }).compile();
        app = moduleRef.createNestApplication();
        app.setGlobalPrefix('api');
        configurarCorpoPdf(app);
        app.useGlobalPipes(buildValidationPipe());
        await app.init();
        auth = `Bearer ${app.get(JwtService).sign({ sub: 1, email: 'admin@aquatex.ao', role: 'admin' })}`;

        // Servidor local que regista qualquer pedido — o render nunca o pode contactar.
        espiao = http.createServer((_req, res) => { pedidosEspiao++; res.end('x'); });
        await new Promise<void>((r) => espiao.listen(0, '127.0.0.1', () => r()));
    }, 60_000);

    afterAll(async () => {
        await app?.close();
        await new Promise((r) => espiao?.close(r));
    });

    it('gera um PDF A4 com "Pág. 1/1" no topo e sem cabeçalho/rodapé do navegador', async () => {
        const res = await pdf(documento('<h1>Fatura FT 2026/1</h1><p>Filtro Neo-Sense — Benguela, ação, côr</p>'), 'FT 2026/1').expect(200);
        expect(res.headers['content-type']).toBe('application/pdf');
        expect(res.headers['content-disposition']).toBe(`inline; filename="FT 2026-1.pdf"; filename*=UTF-8''FT%202026-1.pdf`);
        const buf: Buffer = res.body;
        expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
        const [w, h] = mediaBox(buf);
        expect(Math.round(w)).toBe(595); // A4 = 595 × 842 pt
        expect(Math.round(h)).toBe(842);

        const { numpages, text } = await pdfParse(buf);
        expect(numpages).toBe(1);
        expect(text).toContain('Pág. 1/1');
        expect(text).toContain('Filtro Neo-Sense — Benguela, ação, côr'); // acentos com as fontes da imagem
        // nada do navegador: título, URL, data
        expect(text).not.toMatch(/impressao\.sgi\.invalid|about:blank|localhost/);
        expect(text.split('Fatura FT 2026/1')).toHaveLength(2); // o título do <title> não aparece como cabeçalho
        expect(text).not.toMatch(/\d{1,2}\/\d{1,2}\/\d{2,4},? \d{1,2}:\d{2}/);
    }, 60_000);

    it('documento longo: várias páginas com "Pág. x/y"; orientação horizontal respeitada', async () => {
        const linhas = Array.from({ length: 120 }, (_, i) => `<tr><td>Linha ${i + 1}</td><td>Artigo</td></tr>`).join('');
        const longo = documento(`<table><thead><tr><th>N.º</th><th>Descrição</th></tr></thead><tbody>${linhas}</tbody></table>`);
        const { numpages, text } = await pdfParse((await pdf(longo).expect(200)).body);
        expect(numpages).toBeGreaterThan(1);
        for (let p = 1; p <= numpages; p++) expect(text).toContain(`Pág. ${p}/${numpages}`);

        const horizontal = comPaginacao('<!DOCTYPE html><html><head><title>Agenda</title></head><body>Agenda</body></html>', 'A4 landscape');
        const [w, h] = mediaBox((await pdf(horizontal).expect(200)).body);
        expect(Math.round(w)).toBe(842);
        expect(Math.round(h)).toBe(595);
    }, 60_000);

    it('não carrega recursos externos nem executa JavaScript; imagens data: são embutidas', async () => {
        const { port } = espiao.address() as AddressInfo;
        const base = `http://127.0.0.1:${port}`;
        const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
        const html = documento(`
            <link rel="stylesheet" href="${base}/estilo.css">
            <img src="${base}/logo.png"><img src="${png}" style="width:40px">
            <iframe src="${base}/frame"></iframe>
            <div style="background:url(${base}/fundo.png)">fundo</div>
            <p id="p">texto original</p>
            <script>document.getElementById('p').textContent = 'JS EXECUTADO'; fetch('${base}/js');</script>`);
        const res = await pdf(html).expect(200);
        const { text } = await pdfParse(res.body);
        expect(text).toContain('texto original');
        expect(text).not.toContain('JS EXECUTADO');
        expect(res.body.toString('latin1')).toMatch(/\/Subtype\s*\/Image/); // a imagem data: foi desenhada
        expect(pedidosEspiao).toBe(0);
    }, 60_000);

    it('sem autenticação → 401 (antes de ler o corpo); token inválido → 401', async () => {
        await request(app.getHttpServer()).post('/api/impressao/pdf').send({ html: '<p/>' }).expect(401);
        await request(app.getHttpServer()).post('/api/impressao/pdf').set('Authorization', 'Bearer x.y.z').send({ html: '<p/>' }).expect(401);
    });

    it('validação: sem html → 400; HTML acima do limite → 400/413', async () => {
        await pdf(undefined as any).expect(400);
        const grande = 'x'.repeat(8 * 1024 * 1024 + 10);
        const r = await request(app.getHttpServer()).post('/api/impressao/pdf').set('Authorization', auth).send({ html: grande });
        expect([400, 413]).toContain(r.status);
    }, 60_000);
});
