import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { EncomendaService } from './encomendas.service';
import { Encomenda, EstadoEncomenda } from './encomenda.entity';
import { EncomendaLinha } from './encomenda-linha.entity';
import { Rececao, RececaoItem } from './rececao.entity';
import { Artigo } from '../artigos/artigo.entity';

/** Unit — EncomendaService (issue #38, cobertura ≥80%). */
describe('EncomendaService', () => {
    let service: EncomendaService;
    let encomendaRepo: any;
    let linhaRepo: any;
    let rececaoRepo: any;
    let artigoRepo: any;
    let artigos: Record<number, any>;

    // Manager em memória para dataSource.transaction (receberLinhas).
    const makeManager = (repos: any) => ({
        getRepository: (entity: any) => {
            if (entity === Encomenda) return repos.enc;
            if (entity === EncomendaLinha) return repos.linha;
            if (entity === Rececao) return repos.rececao;
            if (entity === RececaoItem) return repos.rececaoItem;
            if (entity === Artigo) return repos.artigo;
            return {};
        },
    });

    beforeEach(async () => {
        artigos = { 1: { id: 1, existencia: 10, stockEncomendado: 4 } };
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
                rececao: { create: jest.fn((e: any) => ({ ...e })), save: jest.fn(async (e: any) => e) },
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

    it('remove apaga por id', async () => {
        await service.remove(1);
        expect(encomendaRepo.delete).toHaveBeenCalledWith(1);
    });

    it('receberLinhas dá entrada de stock, baixa o encomendado e marca RECEBIDA', async () => {
        // findOne dentro da transação (encomenda + linhas) e no final (recalculo/return)
        encomendaRepo.findOne
            .mockResolvedValueOnce({ id: 1, linhas: [{ id: 1, artigoId: 1, qtdEncomendada: 5, qtdRecebida: 0, codigo: 'C1', descricao: 'D1', unidade: 'UN' }] }) // dentro tx
            .mockResolvedValueOnce({ id: 1, linhas: [{ id: 1, qtdEncomendada: 5, qtdRecebida: 5 }] }) // recalcular estado
            .mockResolvedValue({ id: 1, estado: EstadoEncomenda.RECEBIDA }); // return final

        await service.receberLinhas(1, [{ artigoId: '1', qtd: 5 }], 'GR-001', 'op@x', 'ARM-01');
        // existencia 10 + 5 = 15; encomendado 4 - 5 → max(0,-1)=0
        expect(artigos[1].existencia).toBe(15);
        expect(artigos[1].stockEncomendado).toBe(0);
        expect(encomendaRepo.update).toHaveBeenCalledWith(1, { estado: EstadoEncomenda.RECEBIDA });
    });

    it('receberLinhas lança 404 se a encomenda não existe', async () => {
        encomendaRepo.findOne.mockResolvedValueOnce(null);
        await expect(service.receberLinhas(99, [], 'GR', 'op', 'ARM'))
            .rejects.toBeInstanceOf(NotFoundException);
    });

    it('anularRececao reverte stock e recalcula estado', async () => {
        rececaoRepo.findOne.mockResolvedValue({
            id: 1, estado: 'Ativa',
            encomenda: { id: 1, linhas: [{ id: 1, artigoId: 1, qtdRecebida: 5 }] },
            itens: [{ artigoId: '1', qtd: 5 }],
        });
        // recalcularEstado → findOne devolve encomenda sem nada recebido
        encomendaRepo.findOne.mockResolvedValue({ id: 1, estado: EstadoEncomenda.RECEBIDA, linhas: [{ qtdEncomendada: 5, qtdRecebida: 0 }] });

        await service.anularRececao(1);
        // existencia 10 - 5 = 5; encomendado 4 + 5 = 9
        expect(artigos[1].existencia).toBe(5);
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
