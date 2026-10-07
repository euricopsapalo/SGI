import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import * as request from 'supertest';
import { configurarCorpoPdf } from '../src/config/body-parser';

@Controller('eco')
class EcoController {
    @Post()
    eco(@Body() body: unknown) { return body; }
}

@Controller('impressao')
class PdfStubController {
    @Post('pdf')
    pdf(@Body() body: { html?: string }) { return { tamanho: body.html?.length ?? 0 }; }
}

/**
 * #182 — Regressão: o corpo maior da rota de PDF não pode desligar o parser JSON
 * global do Nest (que é saltado se já existir um middleware chamado `jsonParser`).
 * Aconteceu: toda a API, login incluído, passou a receber o corpo vazio.
 */
describe('Body parser — rota de PDF vs resto da API (#182)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({ controllers: [EcoController, PdfStubController] }).compile();
        app = moduleRef.createNestApplication();
        app.setGlobalPrefix('api');
        configurarCorpoPdf(app);
        await app.init();
    });
    afterAll(async () => { await app?.close(); });

    it('o resto da API continua a receber o corpo JSON (limite por omissão)', async () => {
        const r = await request(app.getHttpServer()).post('/api/eco').send({ email: 'a@b.ao', password: 'x' }).expect(201);
        expect(r.body).toEqual({ email: 'a@b.ao', password: 'x' });
        await request(app.getHttpServer()).post('/api/eco').send({ x: 'y'.repeat(200 * 1024) }).expect(413);
    });

    it('a rota de PDF aceita corpos grandes, mas só com Authorization', async () => {
        const html = 'y'.repeat(2 * 1024 * 1024);
        const r = await request(app.getHttpServer()).post('/api/impressao/pdf').set('Authorization', 'Bearer t').send({ html }).expect(201);
        expect(r.body).toEqual({ tamanho: html.length });
        await request(app.getHttpServer()).post('/api/impressao/pdf').send({ html: '<p/>' }).expect(401);
    });
});
