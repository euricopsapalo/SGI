import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { FaturasController } from '../src/modules/faturas/faturas.controller';
import { FaturasService } from '../src/modules/faturas/faturas.service';
import { Fatura } from '../src/modules/faturas/fatura.entity';

/**
 * E2E — faturação a partir de uma OT (issue #39).
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

    it('cria uma fatura a partir de uma OT (otId + linhas) → 201 com id', async () => {
        const res = await request(app.getHttpServer())
            .post('/faturas')
            .send({
                otId: 42,
                clienteId: 7,
                dataEmissao: '2026-07-30',
                taxaIva: 14,
                valorSubtotal: 10000,
                valorIva: 1400,
                valorTotal: 11400,
                estado: 'Emitido',
                linhas: [
                    { descricao: 'Mão de obra', quantidade: 2, precoUnit: 3000 },
                    { descricao: 'Filtro', quantidade: 1, precoUnit: 4000 },
                ],
            })
            .expect(201);

        expect(res.body.id).toBeDefined();
        expect(res.body.otId).toBe(42);
        expect(res.body.valorTotal).toBe(11400);
        expect(res.body.linhas).toHaveLength(2);
        // vínculo ao cliente resolvido para relação
        expect(res.body.cliente).toEqual({ id: 7 });
    });

    it('a fatura criada fica persistida e é devolvida no GET :id', async () => {
        const { body: created } = await request(app.getHttpServer())
            .post('/faturas')
            .send({ otId: 99, clienteId: 3, dataEmissao: '2026-07-30', valorTotal: 5000 })
            .expect(201);

        const res = await request(app.getHttpServer())
            .get(`/faturas/${created.id}`)
            .expect(200);
        expect(res.body.id).toBe(created.id);
        expect(res.body.otId).toBe(99);
    });

    it('body sem dataEmissao (obrigatória) → 400', () => {
        return request(app.getHttpServer())
            .post('/faturas')
            .send({ otId: 1, valorTotal: 100 })
            .expect(400);
    });
});
