import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { FaturasController } from '../src/modules/faturas/faturas.controller';
import { FaturasService } from '../src/modules/faturas/faturas.service';
import { Fatura } from '../src/modules/faturas/fatura.entity';

/**
 * E2E — módulo de faturas antigo (issue #39). Desde o #165 (D8) já não cria
 * faturas — fatura-se a OT em Vendas; mantém consulta/edição (v11 §9).
 * FaturasController + FaturasService pela camada HTTP; repositório in-memory.
 */
describe('Faturas E2E — criar a partir de OT', () => {
    let app: INestApplication;
    let store: Record<number, any>;
    let seq: number;

    beforeAll(async () => {
        const repo = {
            create: (obj: any) => ({ ...obj }),
            save: async (entity: any) => { entity.id = ++seq; store[entity.id] = entity; return entity; },
            findOne: async ({ where }: any) => store[where.id] ?? null,
            find: async () => Object.values(store),
            update: async (id: number, patch: any) => { Object.assign(store[id], patch); return { affected: 1 }; },
            delete: async (id: number) => { delete store[id]; return { affected: 1 }; },
        };

        const moduleRef: TestingModule = await Test.createTestingModule({
            controllers: [FaturasController],
            providers: [
                FaturasService,
                { provide: getRepositoryToken(Fatura), useValue: repo },
            ],
        }).compile();

        app = moduleRef.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        await app.init();
    });

    beforeEach(() => { store = {}; seq = 0; });

    afterAll(async () => {
        await app.close();
    });

    // #165 / D8 — a criação no módulo antigo está encerrada: fatura-se a OT em Vendas.
    it('criar fatura no módulo antigo → 410 Gone a apontar para Vendas', async () => {
        const res = await request(app.getHttpServer())
            .post('/faturas')
            .send({ otId: 42, clienteId: 7, dataEmissao: '2026-07-30', valorTotal: 11400 })
            .expect(410);
        expect(res.body.message).toMatch(/\/api\/vendas\/documentos/);
        expect(Object.keys(store)).toHaveLength(0);
    });

    it('as faturas antigas continuam consultáveis e editáveis (observações)', async () => {
        store[1] = { id: 1, otId: 99, valorTotal: 5000, estado: 'Pendente' };
        const res = await request(app.getHttpServer()).get('/faturas/1').expect(200);
        expect(res.body.otId).toBe(99);
        await request(app.getHttpServer()).put('/faturas/1').send({ observacoes: 'nota' }).expect(200);
        expect(store[1].observacoes).toBe('nota');
    });

    // #218 — marcar como paga/anulada só em Vendas/Tesouraria: o PUT recusa o estado e o pagamento.
    it.each([
        [{ estado: 'Paga' }],
        [{ estado: 'Anulada', motivoAnulacao: 'x' }],
        [{ dataPagamento: '2026-10-21' }],
    ])('PUT com %o → 400 e a fatura não muda', async (corpo) => {
        store[1] = { id: 1, otId: 99, valorTotal: 5000, estado: 'Pendente' };
        await request(app.getHttpServer()).put('/faturas/1').send(corpo).expect(400);
        expect(store[1].estado).toBe('Pendente');
    });
});
