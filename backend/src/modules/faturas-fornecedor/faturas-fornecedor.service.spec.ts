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

describe('FaturasFornecedorService (regression #14)', () => {
    let service: FaturasFornecedorService;
    let vncAssociadaRepo: any;
    let faturaRepo: any;
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
        const artigoRepo = { findOne: jest.fn(), update: jest.fn() };
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
