import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { EncomendaController } from '../src/modules/encomendas/encomendas.controller';
import { EncomendaService } from '../src/modules/encomendas/encomendas.service';
import { Encomenda } from '../src/modules/encomendas/encomenda.entity';
import { EncomendaLinha } from '../src/modules/encomendas/encomenda-linha.entity';
import { Rececao, RececaoItem } from '../src/modules/encomendas/rececao.entity';
import { Artigo } from '../src/modules/artigos/artigo.entity';

/**
 * E2E — fluxo de compras/encomendas (issue #39):
 * criar → receção parcial (estado Parcial) → receção completa (estado Recebida),
 * com atualização de existência de stock. Repositórios in-memory stateful.
 */
describe('Encomendas E2E — criar → receção parcial → completa', () => {
    let app: INestApplication;

    // ── estado partilhado dos mocks ──
    let seqEnc: number, seqLinha: number, seqRec: number;
    let encStore: Record<number, any>;
    let linhaStore: Record<number, any>;
    let artigoStore: Record<number, any>;

    beforeAll(async () => {
        const encomendaRepo = {
            create: (obj: any) => ({ ...obj }),
            save: async (entity: any) => {
                entity.id = ++seqEnc;
                entity.estado = entity.estado ?? 'Aberta';
                entity.rececoes = [];
                entity.linhas = (entity.linhas ?? []).map((l: any) => {
                    const linha = { id: ++seqLinha, qtdRecebida: 0, ...l, qtdEncomendada: Number(l.qtdEncomendada ?? 0) };
                    linhaStore[linha.id] = linha;
                    return linha;
                });
                encStore[entity.id] = entity;
                return entity;
            },
            findOne: async ({ where }: any) => encStore[where.id] ?? null,
            find: async () => Object.values(encStore),
            update: async (id: number, patch: any) => { Object.assign(encStore[id], patch); return { affected: 1 }; },
            delete: async (id: number) => { delete encStore[id]; return { affected: 1 }; },
        };
        const linhaRepo = {
            update: async (id: number, patch: any) => { Object.assign(linhaStore[id], patch); return { affected: 1 }; },
        };
        const rececaoRepo = {
            create: (obj: any) => ({ ...obj }),
            save: async (rec: any) => {
                rec.id = ++seqRec;
                const encId = rec.encomenda?.id;
                if (encStore[encId]) encStore[encId].rececoes.push(rec);
                return rec;
            },
            findOne: async ({ where }: any) => Object.values(encStore).flatMap((e: any) => e.rececoes).find((r: any) => r.id === where.id) ?? null,
            update: async () => ({ affected: 1 }),
        };
        const rececaoItemRepo = { create: (obj: any) => ({ ...obj }) };
        const artigoRepo = {
            findOne: async ({ where }: any) => artigoStore[where.id] ?? null,
            update: async (id: number, patch: any) => { Object.assign(artigoStore[id], patch); return { affected: 1 }; },
        };

        const moduleRef: TestingModule = await Test.createTestingModule({
            controllers: [EncomendaController],
            providers: [
                EncomendaService,
                { provide: getRepositoryToken(Encomenda), useValue: encomendaRepo },
                { provide: getRepositoryToken(EncomendaLinha), useValue: linhaRepo },
                { provide: getRepositoryToken(Rececao), useValue: rececaoRepo },
                { provide: getRepositoryToken(RececaoItem), useValue: rececaoItemRepo },
                { provide: getRepositoryToken(Artigo), useValue: artigoRepo },
            ],
        }).compile();

        app = moduleRef.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        await app.init();
    });

    beforeEach(() => {
        seqEnc = 0; seqLinha = 0; seqRec = 0;
        encStore = {}; linhaStore = {};
        artigoStore = {
            10: { id: 10, existencia: 5, stockEncomendado: 0 },
            11: { id: 11, existencia: 2, stockEncomendado: 0 },
        };
    });

    afterAll(async () => {
        await app.close();
    });

    const criarEncomenda = () =>
        request(app.getHttpServer())
            .post('/compras')
            .send({
                numero: 'ENC-0001',
                data: '2026-07-30',
                fornecedorId: 1,
                linhas: [
                    { artigoId: 10, codigo: 'A10', descricao: 'Artigo 10', qtdEncomendada: 10, unidade: 'UN' },
                    { artigoId: 11, codigo: 'A11', descricao: 'Artigo 11', qtdEncomendada: 4, unidade: 'UN' },
                ],
            });

    const receber = (id: number, recebidas: Array<{ artigoId: string; qtd: number }>) =>
        request(app.getHttpServer())
            .post(`/compras/${id}/receber`)
            .send({ recebidas, guiaRemessa: 'GR-1', operador: 'Tester', armazem: 'AC' });

    it('cria a encomenda com 2 linhas e estado inicial Aberta', async () => {
        const res = await criarEncomenda().expect(201);
        expect(res.body.id).toBeDefined();
        expect(res.body.estado).toBe('Aberta');
        expect(res.body.linhas).toHaveLength(2);
    });

    it('receção parcial → estado Parcial e existência atualizada', async () => {
        const { body: enc } = await criarEncomenda().expect(201);
        // recebe 4 de 10 do artigo 10
        const res = await receber(enc.id, [{ artigoId: '10', qtd: 4 }]).expect(201);
        expect(res.body.estado).toBe('Parcial');
        expect(artigoStore[10].existencia).toBe(9); // 5 + 4
        expect(res.body.rececoes).toHaveLength(1);
    });

    it('receção completa (2 receções) → estado Recebida e stock final correto', async () => {
        const { body: enc } = await criarEncomenda().expect(201);
        await receber(enc.id, [{ artigoId: '10', qtd: 4 }]).expect(201); // parcial
        // completa: restantes 6 do artigo 10 + os 4 do artigo 11
        const res = await receber(enc.id, [
            { artigoId: '10', qtd: 6 },
            { artigoId: '11', qtd: 4 },
        ]).expect(201);
        expect(res.body.estado).toBe('Recebida');
        expect(artigoStore[10].existencia).toBe(15); // 5 + 4 + 6
        expect(artigoStore[11].existencia).toBe(6);  // 2 + 4
        expect(res.body.rececoes).toHaveLength(2);
    });

    it('receber numa encomenda inexistente → 404', () => {
        return receber(999, [{ artigoId: '10', qtd: 1 }]).expect(404);
    });
});
