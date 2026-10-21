import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { EncomendaService } from './encomendas.service';
import { Encomenda, EstadoEncomenda } from './encomenda.entity';
import { EncomendaLinha } from './encomenda-linha.entity';
import { Rececao, RececaoItem } from './rececao.entity';
import { Artigo } from '../artigos/artigo.entity';
import { entradaStock, saidaStock } from '../artigos/stock-armazem.ops';
import { MovimentoStock } from '../artigos/movimento-stock.entity';

// #204 — o stock entra/sai via stock-armazem.ops (testado à parte).
jest.mock('../artigos/stock-armazem.ops', () => ({
    entradaStock: jest.fn(async () => 0),
    saidaStock: jest.fn(async () => 0),
}));

/** Unit — EncomendaService (issue #38, cobertura ≥80%). */
describe('EncomendaService', () => {
    let service: EncomendaService;
    let encomendaRepo: any;
    let linhaRepo: any;
    let rececaoRepo: any;
    let artigoRepo: any;
    let artigos: Record<number, any>;
    // #213 — movimentos gravados dentro da transação da receção/anulação.
    let movimentos: any[];

    // Manager em memória para dataSource.transaction (receberLinhas).
    const makeManager = (repos: any) => {
        const repo = (entity: any) => {
            if (entity === Encomenda) return repos.enc;
            if (entity === EncomendaLinha) return repos.linha;
            if (entity === Rececao) return repos.rececao;
            if (entity === RececaoItem) return repos.rececaoItem;
            if (entity === Artigo) return repos.artigo;
            if (entity === MovimentoStock) return repos.mov;
            return {};
        };
        return {
            getRepository: repo,
            findOne: (entity: any, opts: any) => repo(entity).findOne(opts),
            update: (entity: any, id: any, patch: any) => repo(entity).update(id, patch),
            delete: (entity: any, id: any) => repo(entity).delete(id),
            create: (_entity: any, v: any) => ({ ...v }),
            save: async (entity: any, v: any) => (entity === MovimentoStock ? (movimentos.push(v), v) : v),
        };
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        artigos = { 1: { id: 1, existencia: 10, stockEncomendado: 4 } };
        movimentos = [];
        encomendaRepo = {
            find: jest.fn(async () => [{ id: 1 }]),
            findOne: jest.fn(),
            create: jest.fn((e: any) => ({ ...e })),
            save: jest.fn(async (e: any) => ({ ...e, id: 7 })),
            update: jest.fn(async () => ({ affected: 1 })),
            delete: jest.fn(async () => ({ affected: 1 })),
        };
        linhaRepo = { update: jest.fn(async () => ({ affected: 1 })) };
        rececaoRepo = { findOne: jest.fn(), update: jest.fn(async () => ({ affected: 1 })) };
        artigoRepo = {
            findOne: jest.fn(async ({ where }: any) => artigos[where.id] ?? null),
            update: jest.fn(async (id: number, patch: any) => { Object.assign(artigos[id], patch); return { affected: 1 }; }),
        };

        const dataSource = {
            transaction: jest.fn(async (cb: any) => cb(makeManager({
                enc: encomendaRepo, linha: linhaRepo,
                rececao: { create: jest.fn((e: any) => ({ ...e })), save: jest.fn(async (e: any) => e), update: rececaoRepo.update },
                rececaoItem: { create: jest.fn((e: any) => ({ ...e })) },
                artigo: artigoRepo,
            }))),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EncomendaService,
                { provide: getRepositoryToken(Encomenda), useValue: encomendaRepo },
                { provide: getRepositoryToken(EncomendaLinha), useValue: linhaRepo },
                { provide: getRepositoryToken(Rececao), useValue: rececaoRepo },
                { provide: getRepositoryToken(RececaoItem), useValue: { } },
                { provide: getRepositoryToken(Artigo), useValue: artigoRepo },
                { provide: DataSource, useValue: dataSource },
            ],
        }).compile();
        service = module.get(EncomendaService);
    });

    it('findAll / findOne carregam relações', async () => {
        encomendaRepo.findOne.mockResolvedValue({ id: 1 });
        await service.findAll();
        await service.findOne(1);
        expect(encomendaRepo.find).toHaveBeenCalled();
        expect(encomendaRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1 } }));
    });

    it('create incrementa stockEncomendado por cada linha', async () => {
        encomendaRepo.findOne.mockResolvedValue({ id: 7, linhas: [] });
        await service.create({ fornecedorId: '2', linhas: [{ artigoId: 1, qtdEncomendada: 6 }] });
        // 4 + 6 = 10
        expect(artigos[1].stockEncomendado).toBe(10);
    });

    it('update para CANCELADA liberta o stock pendente das linhas', async () => {
        encomendaRepo.findOne.mockResolvedValue({
            id: 1, estado: EstadoEncomenda.APROVADA,
            linhas: [{ id: 1, artigoId: 1, qtdEncomendada: 6, qtdRecebida: 2 }],
        });
        await service.update(1, { estado: EstadoEncomenda.CANCELADA });
        // pendente = 6 - 2 = 4 → stockEncomendado 4 - 4 = 0
        expect(artigos[1].stockEncomendado).toBe(0);
        expect(encomendaRepo.update).toHaveBeenCalledWith(1, { estado: EstadoEncomenda.CANCELADA });
    });

    it('update atualiza taxaIva/codigoIva das linhas com id', async () => {
        encomendaRepo.findOne.mockResolvedValue({ id: 1, estado: EstadoEncomenda.APROVADA, linhas: [] });
        await service.update(1, { linhas: [{ id: 3, taxaIva: 14, codigoIva: 'I14' }] });
        expect(linhaRepo.update).toHaveBeenCalledWith(3, { taxaIva: 14, codigoIva: 'I14' });
    });

    describe('#216 — remove só apaga encomendas abertas e sem receções', () => {
        it('aberta e sem receções: liberta o encomendado pendente e apaga, na mesma transação', async () => {
            encomendaRepo.findOne.mockResolvedValue({
                id: 1, estado: EstadoEncomenda.ABERTA, rececoes: [],
                linhas: [{ id: 1, artigoId: 1, qtdEncomendada: 3, qtdRecebida: 0 }],
            });
            await service.remove(1);
            expect(artigos[1].stockEncomendado).toBe(1); // 4 − 3
            expect(encomendaRepo.delete).toHaveBeenCalledWith(1);
        });

        it.each([
            ['com receções', { estado: EstadoEncomenda.ABERTA, rececoes: [{ id: 9, estado: 'Anulada' }] }],
            ['parcial', { estado: EstadoEncomenda.PARCIAL, rececoes: [] }],
            ['recebida', { estado: EstadoEncomenda.RECEBIDA, rececoes: [] }],
            ['cancelada', { estado: EstadoEncomenda.CANCELADA, rececoes: [] }],
        ])('%s → 409 sem apagar nem mexer no stock', async (_n, enc) => {
            encomendaRepo.findOne.mockResolvedValue({ id: 1, linhas: [{ artigoId: 1, qtdEncomendada: 3, qtdRecebida: 0 }], ...enc });
            await expect(service.remove(1)).rejects.toBeInstanceOf(ConflictException);
            expect(encomendaRepo.delete).not.toHaveBeenCalled();
            expect(artigos[1].stockEncomendado).toBe(4);
        });

        it('inexistente → 404', async () => {
            encomendaRepo.findOne.mockResolvedValue(null);
            await expect(service.remove(99)).rejects.toBeInstanceOf(NotFoundException);
        });
    });

    it('receberLinhas dá entrada de stock, baixa o encomendado e marca RECEBIDA', async () => {
        // findOne dentro da transação (encomenda + linhas) e no final (recalculo/return)
        encomendaRepo.findOne
            .mockResolvedValueOnce({ id: 1, linhas: [{ id: 1, artigoId: 1, qtdEncomendada: 5, qtdRecebida: 0, codigo: 'C1', descricao: 'D1', unidade: 'UN' }] }) // dentro tx
            .mockResolvedValueOnce({ id: 1, linhas: [{ id: 1, qtdEncomendada: 5, qtdRecebida: 5 }] }) // recalcular estado
            .mockResolvedValue({ id: 1, estado: EstadoEncomenda.RECEBIDA }); // return final

        await service.receberLinhas(1, [{ artigoId: '1', qtd: 5 }], 'GR-001', 'op@x', 'ARM-01');
        // #204 — entra no armazém de destino; encomendado 4 - 5 → max(0,-1)=0
        expect(entradaStock).toHaveBeenCalledWith(expect.anything(), 1, 5, 'ARM-01');
        expect(artigos[1].existencia).toBe(10); // a existência é recalculada pelo helper
        expect(artigos[1].stockEncomendado).toBe(0);
        expect(encomendaRepo.update).toHaveBeenCalledWith(1, { estado: EstadoEncomenda.RECEBIDA });
        // #213 — o movimento de entrada é gravado na mesma transação (já não é o frontend)
        expect(movimentos).toEqual([expect.objectContaining({ tipo: 'entrada', quantidade: 5, armazemId: 'ARM-01', artigo: { id: 1 } })]);
    });

    it('receberLinhas lança 404 se a encomenda não existe', async () => {
        encomendaRepo.findOne.mockResolvedValueOnce(null);
        await expect(service.receberLinhas(99, [], 'GR', 'op', 'ARM'))
            .rejects.toBeInstanceOf(NotFoundException);
    });

    it('anularRececao reverte stock e recalcula estado', async () => {
        rececaoRepo.findOne.mockResolvedValue({
            id: 1, estado: 'Ativa', armazem: 'ARM-02',
            encomenda: { id: 1, linhas: [{ id: 1, artigoId: 1, qtdRecebida: 5 }] },
            itens: [{ artigoId: '1', qtd: 5 }],
        });
        // recalcularEstado → findOne devolve encomenda sem nada recebido
        encomendaRepo.findOne.mockResolvedValue({ id: 1, estado: EstadoEncomenda.RECEBIDA, linhas: [{ qtdEncomendada: 5, qtdRecebida: 0 }] });

        (saidaStock as jest.Mock).mockResolvedValueOnce(5);
        await service.anularRececao(1, 'ana@aquatex.ao');
        // #213 — a reversão fica no histórico de movimentos
        expect(movimentos).toEqual([expect.objectContaining({ tipo: 'saida', quantidade: 5, armazemId: 'ARM-02', usuario: 'ana@aquatex.ao' })]);
        // #204 — sai do armazém da receção (no máximo o que lá existe); encomendado 4 + 5 = 9
        expect(saidaStock).toHaveBeenCalledWith(expect.anything(), 1, 5, { armazem: 'ARM-02', limitarAoExistente: true });
        expect(artigos[1].stockEncomendado).toBe(9);
        expect(rececaoRepo.update).toHaveBeenCalledWith(1, { estado: 'Anulada' });
        // nada recebido → volta a APROVADA
        expect(encomendaRepo.update).toHaveBeenCalledWith(1, { estado: EstadoEncomenda.APROVADA });
    });

    it('anularRececao lança 404 se a receção não existe ou já anulada', async () => {
        rececaoRepo.findOne.mockResolvedValueOnce(null);
        await expect(service.anularRececao(1)).rejects.toBeInstanceOf(NotFoundException);
        rececaoRepo.findOne.mockResolvedValueOnce({ id: 1, estado: 'Anulada' });
        await expect(service.anularRececao(1)).rejects.toBeInstanceOf(NotFoundException);
    });
});
