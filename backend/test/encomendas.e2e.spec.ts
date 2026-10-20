import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { EncomendaController } from '../src/modules/encomendas/encomendas.controller';
import { EncomendaService } from '../src/modules/encomendas/encomendas.service';
import { Encomenda } from '../src/modules/encomendas/encomenda.entity';
import { EncomendaLinha } from '../src/modules/encomendas/encomenda-linha.entity';
import { Rececao, RececaoItem } from '../src/modules/encomendas/rececao.entity';
import { Artigo } from '../src/modules/artigos/artigo.entity';

// #204 — o stock passa por stock-armazem.ops; aqui é simulado sobre o mesmo
// artigoStore em memória (pelo artigoRepo.update, para a falha simulada e o rollback).
const mockArtigos: { get?: (id: number) => any; update?: (id: number, patch: any) => Promise<any> } = {};
jest.mock('../src/modules/artigos/stock-armazem.ops', () => ({
    entradaStock: async (_m: any, id: number, qtd: number) => {
        const a = mockArtigos.get!(id);
        await mockArtigos.update!(id, { existencia: Number(a.existencia) + qtd });
    },
    saidaStock: async (_m: any, id: number, qtd: number) => {
        const a = mockArtigos.get!(id);
        const sai = Math.min(qtd, Number(a.existencia));
        await mockArtigos.update!(id, { existencia: Number(a.existencia) - sai });
        return sai;
    },
}));

/**
 * E2E — fluxo de compras/encomendas (issues #39, #37):
 * criar → receção parcial (Parcial) → receção completa (Recebida), com atualização
 * de existência; e rollback atómico quando a receção falha a meio.
 * Repositórios in-memory; DataSource.transaction simula commit/rollback.
 */
describe('Encomendas E2E — receção transacional (criar → parcial → completa, rollback)', () => {
    let app: INestApplication;

    let seqEnc: number, seqLinha: number, seqRec: number;
    let encStore: Record<number, any>;
    let linhaStore: Record<number, any>;
    let artigoStore: Record<number, any>;
    let failOnArtigo: number | null; // força falha no update deste artigo (teste de rollback)

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
            update: async (id: number, patch: any) => {
                if (failOnArtigo === id) throw new Error(`falha simulada no update do artigo ${id}`);
                Object.assign(artigoStore[id], patch);
                return { affected: 1 };
            },
        };

        mockArtigos.get = (id: number) => artigoStore[id];
        mockArtigos.update = (id: number, patch: any) => artigoRepo.update(id, patch);

        // Mapa entidade → repo, partilhado entre injeção directa e manager transacional
        const repoFor = (E: any) => {
            if (E === Encomenda) return encomendaRepo;
            if (E === EncomendaLinha) return linhaRepo;
            if (E === Rececao) return rececaoRepo;
            if (E === RececaoItem) return rececaoItemRepo;
            if (E === Artigo) return artigoRepo;
            throw new Error('repo desconhecido');
        };

        // DataSource.transaction: snapshot dos valores mutáveis; rollback em caso de erro.
        const dataSource = {
            transaction: async (fn: (m: any) => Promise<any>) => {
                const snapLinhas = Object.fromEntries(Object.entries(linhaStore).map(([k, v]: any) => [k, v.qtdRecebida]));
                const snapArtigos = Object.fromEntries(Object.entries(artigoStore).map(([k, v]: any) => [k, { e: v.existencia, s: v.stockEncomendado }]));
                const snapEnc = Object.fromEntries(Object.entries(encStore).map(([k, v]: any) => [k, { estado: v.estado, recLen: v.rececoes.length }]));
                const manager = {
                    getRepository: (E: any) => repoFor(E),
                    findOne: (E: any, opts: any) => (repoFor(E) as any).findOne(opts),
                    update: (E: any, id: any, patch: any) => (repoFor(E) as any).update(id, patch),
                };
                try {
                    return await fn(manager);
                } catch (err) {
                    for (const [k, q] of Object.entries(snapLinhas)) linhaStore[k].qtdRecebida = q;
                    for (const [k, a] of Object.entries(snapArtigos) as any) { artigoStore[k].existencia = a.e; artigoStore[k].stockEncomendado = a.s; }
                    for (const [k, e] of Object.entries(snapEnc) as any) { encStore[k].estado = e.estado; encStore[k].rececoes.length = e.recLen; }
                    throw err;
                }
            },
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
                { provide: DataSource, useValue: dataSource },
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
        failOnArtigo = null;
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
        expect(res.body.estado).toBe('Aberta');
        expect(res.body.linhas).toHaveLength(2);
    });

    it('receção parcial → estado Parcial e existência atualizada', async () => {
        const { body: enc } = await criarEncomenda().expect(201);
        const res = await receber(enc.id, [{ artigoId: '10', qtd: 4 }]).expect(201);
        expect(res.body.estado).toBe('Parcial');
        expect(artigoStore[10].existencia).toBe(9);
        expect(res.body.rececoes).toHaveLength(1);
    });

    it('receção completa (2 receções) → estado Recebida e stock final correto', async () => {
        const { body: enc } = await criarEncomenda().expect(201);
        await receber(enc.id, [{ artigoId: '10', qtd: 4 }]).expect(201);
        const res = await receber(enc.id, [
            { artigoId: '10', qtd: 6 },
            { artigoId: '11', qtd: 4 },
        ]).expect(201);
        expect(res.body.estado).toBe('Recebida');
        expect(artigoStore[10].existencia).toBe(15);
        expect(artigoStore[11].existencia).toBe(6);
        expect(res.body.rececoes).toHaveLength(2);
    });

    it('rollback: falha a meio da receção não deixa estado parcial (issue #37)', async () => {
        const { body: enc } = await criarEncomenda().expect(201);
        // Falha ao atualizar o stock do artigo 11 → a transação inteira faz rollback.
        failOnArtigo = 11;
        await receber(enc.id, [
            { artigoId: '10', qtd: 4 },
            { artigoId: '11', qtd: 4 },
        ]).expect(500);

        // Nada persistiu: stock intacto, linhas por receber, estado Aberta, sem receções.
        expect(artigoStore[10].existencia).toBe(5);
        expect(artigoStore[11].existencia).toBe(2);
        expect(Object.values(linhaStore).every((l: any) => l.qtdRecebida === 0)).toBe(true);
        expect(encStore[enc.id].estado).toBe('Aberta');
        expect(encStore[enc.id].rececoes).toHaveLength(0);
    });

    it('receber numa encomenda inexistente → 404', () => {
        return receber(999, [{ artigoId: '10', qtd: 1 }]).expect(404);
    });
});
