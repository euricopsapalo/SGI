/**
 * Unit test — FaturasFornecedorService.create
 * Regressão fix #14: o service agora lê `body.faturasAssociadas` (array
 * de objectos {faturaAssociadaId}), não o campo antigo `faturasAssociadasIds`.
 */
import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FaturasFornecedorService } from './faturas-fornecedor.service';
import { FaturaFornecedor } from './fatura-fornecedor.entity';
import { LinhaFaturaFornecedor } from './linha-fatura-fornecedor.entity';
import { VncFaturaAssociada } from './vnc-fatura-associada.entity';
import { Artigo } from '../artigos/artigo.entity';
import { MovimentoStock } from '../artigos/movimento-stock.entity';
import { entradaStock, saidaStock } from '../artigos/stock-armazem.ops';

// #204 — o stock entra/sai via stock-armazem.ops (testado à parte).
jest.mock('../artigos/stock-armazem.ops', () => ({
    entradaStock: jest.fn(async () => 0),
    saidaStock: jest.fn(async () => 0),
}));

describe('FaturasFornecedorService (regression #14)', () => {
    let service: FaturasFornecedorService;
    let vncAssociadaRepo: any;
    let faturaRepo: any;
    let manager: any;
    let module: TestingModule;

    beforeEach(async () => {
        // Repositórios fake em memória
        const savedFatura = { id: 42 };
        const createdRecords: any[] = [];
        const savedAssociadas: any[] = [];

        faturaRepo = {
            create: jest.fn((obj) => ({ __type: 'FaturaFornecedor', ...obj })),
            save: jest.fn(async (entity) => ({ ...entity, id: savedFatura.id })),
            findOne: jest.fn(async ({ where }) => ({ id: where.id, tipoDocumento: 'VNC' })),
            find: jest.fn(async () => []),
            delete: jest.fn(async () => ({ affected: 0 })),
            update: jest.fn(async () => ({ affected: 1 })),
        };

        vncAssociadaRepo = {
            create: jest.fn((obj) => {
                createdRecords.push(obj);
                return obj;
            }),
            save: jest.fn(async (obj) => {
                savedAssociadas.push(obj);
                return obj;
            }),
            __createdRecords: createdRecords,
            __savedAssociadas: savedAssociadas,
        };

        const linhaRepo = { save: jest.fn(), create: jest.fn(), delete: jest.fn() };
        jest.clearAllMocks();
        manager = {
            findOne: jest.fn(async (_e: any, { where }: any) => ({ id: where.id, existencia: 10, custoMedio: 100 })),
            update: jest.fn(async () => ({ affected: 1 })),
            create: jest.fn((_e: any, v: any) => v),
            save: jest.fn(async (_e: any, v: any) => v),
            transaction: jest.fn(async (cb: any) => cb(manager)),
        };
        const artigoRepo = { findOne: jest.fn(), update: jest.fn(), manager };
        const movimentoRepo = { save: jest.fn(), create: jest.fn() };

        module = await Test.createTestingModule({
            providers: [
                FaturasFornecedorService,
                { provide: getRepositoryToken(FaturaFornecedor), useValue: faturaRepo },
                { provide: getRepositoryToken(LinhaFaturaFornecedor), useValue: linhaRepo },
                { provide: getRepositoryToken(Artigo), useValue: artigoRepo },
                { provide: getRepositoryToken(VncFaturaAssociada), useValue: vncAssociadaRepo },
                { provide: getRepositoryToken(MovimentoStock), useValue: movimentoRepo },
            ],
        }).compile();

        service = module.get<FaturasFornecedorService>(FaturasFornecedorService);
    });

    afterEach(async () => {
        await module?.close();
    });

    it('#204 — compra direta (VFA) dá entrada no stock_armazem e atualiza o custo médio', async () => {
        await service.create({
            tipoDocumento: 'VFA', fornecedorId: 1,
            linhas: [{ produtoId: 5, quantidade: 10, precoUnitarioNet: 200 }],
        } as any);
        expect(entradaStock).toHaveBeenCalledWith(manager, 5, 10);
        // custo médio: (10×100 + 10×200) / 20 = 150
        expect(manager.update).toHaveBeenCalledWith(Artigo, 5, expect.objectContaining({ custoMedio: 150 }));
        expect(manager.update).not.toHaveBeenCalledWith(Artigo, 5, expect.objectContaining({ existencia: expect.anything() }));
    });

    describe('#215 — validar uma VNC numa só transação', () => {
        const vnc = (extra: any = {}) => ({
            id: 9, tipoDocumento: 'VNC', estadoDocumento: 'AguardaAprovacao', tipoNotaCredito: 'Devolucao',
            numFaturaExterno: 'NC-1', ...extra,
        });
        beforeEach(() => {
            manager.findOne = jest.fn(async (e: any, { where }: any) =>
                e === FaturaFornecedor ? vnc() : { id: where.id, existencia: 10 });
            manager.find = jest.fn(async () => [{ produtoId: 5, quantidade: 3 }, { produtoId: 6, quantidade: 2 }]);
        });

        it('tira o stock do stock_armazem, regista os movimentos e muda o estado, com a fatura bloqueada', async () => {
            await service.updateEstado(9, 'Validado', 'op@x');
            expect(manager.transaction).toHaveBeenCalledTimes(1);
            expect(manager.findOne).toHaveBeenCalledWith(FaturaFornecedor, expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
            expect(saidaStock).toHaveBeenCalledWith(manager, 5, 3);
            expect(saidaStock).toHaveBeenCalledWith(manager, 6, 2);
            expect(manager.save).toHaveBeenCalledWith(MovimentoStock, expect.objectContaining({ quantidade: 3, tipo: 'devolucao', usuario: 'op@x' }));
            expect(manager.update).toHaveBeenCalledWith(FaturaFornecedor, 9, { estadoDocumento: 'Validado' });
            expect(faturaRepo.update).not.toHaveBeenCalled();
        });

        it('falha a meio (sem stock na 2.ª linha) → erro e o estado não muda (rollback)', async () => {
            (saidaStock as jest.Mock).mockResolvedValueOnce(3).mockRejectedValueOnce(new Error('Stock insuficiente'));
            await expect(service.updateEstado(9, 'Validado', 'op@x')).rejects.toThrow('Stock insuficiente');
            expect(manager.update).not.toHaveBeenCalledWith(FaturaFornecedor, 9, expect.anything());
        });

        it('VNC já validada (ex.: segundo pedido em simultâneo) → 400 sem mexer no stock', async () => {
            manager.findOne = jest.fn(async () => vnc({ estadoDocumento: 'Validado' }));
            await expect(service.updateEstado(9, 'Validado')).rejects.toThrow(/Transição inválida/);
            expect(saidaStock).not.toHaveBeenCalled();
        });

        it('acerto de preço → valida sem mexer no stock', async () => {
            manager.findOne = jest.fn(async () => vnc({ tipoNotaCredito: 'AcertoPreco' }));
            await service.updateEstado(9, 'Validado');
            expect(saidaStock).not.toHaveBeenCalled();
            expect(manager.update).toHaveBeenCalledWith(FaturaFornecedor, 9, { estadoDocumento: 'Validado' });
        });
    });

    it('create(VNC) — lê faturasAssociadas e cria uma linha vnc_faturas_associadas por cada {faturaAssociadaId}', async () => {
        await service.create({
            tipoDocumento: 'VNC',
            numFaturaExterno: 'VNC-001',
            dataEmissao: '2026-04-08',
            tipoNotaCredito: 'AcertoPreco',
            fornecedorId: 1,
            linhas: [],
            faturasAssociadas: [
                { faturaAssociadaId: 7 },
                { faturaAssociadaId: 8 },
                { faturaAssociadaId: 9 },
            ],
        });

        expect(vncAssociadaRepo.create).toHaveBeenCalledTimes(3);
        expect(vncAssociadaRepo.save).toHaveBeenCalledTimes(3);

        const savedIds = vncAssociadaRepo.__savedAssociadas.map((a: any) => a.faturaAssociadaId);
        expect(savedIds).toEqual(expect.arrayContaining([7, 8, 9]));

        // Todas as linhas apontam para o VNC recém-criado
        for (const rec of vncAssociadaRepo.__savedAssociadas) {
            expect(rec.vncId).toBe(42);
        }
    });

    it('create(VNC) — ignora lista vazia de faturasAssociadas', async () => {
        await service.create({
            tipoDocumento: 'VNC',
            numFaturaExterno: 'VNC-002',
            dataEmissao: '2026-04-08',
            fornecedorId: 1,
            linhas: [],
            faturasAssociadas: [],
        });
        expect(vncAssociadaRepo.save).not.toHaveBeenCalled();
    });

    it('create(VFA) — não cria nenhuma associada mesmo com faturasAssociadas no body (apenas VNC)', async () => {
        await service.create({
            tipoDocumento: 'VFA',
            numFaturaExterno: 'VFA-001',
            dataEmissao: '2026-04-08',
            fornecedorId: 1,
            linhas: [],
            faturasAssociadas: [{ faturaAssociadaId: 7 }],
        });
        expect(vncAssociadaRepo.save).not.toHaveBeenCalled();
    });

    it('create — o spread para faturaRepo.create NÃO contamina a entity com faturasAssociadas (são strippadas)', async () => {
        await service.create({
            tipoDocumento: 'VNC',
            numFaturaExterno: 'VNC-003',
            dataEmissao: '2026-04-08',
            fornecedorId: 1,
            linhas: [],
            faturasAssociadas: [{ faturaAssociadaId: 1 }],
        });
        // A primeira chamada ao faturaRepo.create recebeu o body sem o campo relacional
        const firstArg = faturaRepo.create.mock.calls[0][0];
        expect(firstArg.faturasAssociadas).toBeUndefined();
        expect(firstArg.fornecedorId).toBeUndefined(); // também excluído (mapeado para .fornecedor)
        expect(firstArg.linhas).toBeDefined();         // mas este é recriado
    });
});
