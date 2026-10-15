import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ArtigosService } from './artigos.service';
import { Artigo } from './artigo.entity';
import { MovimentoStock } from './movimento-stock.entity';
import { StockArmazem } from './stock-armazem.entity';

/** Unit — ArtigosService (issue #38, cobertura ≥80%). */
describe('ArtigosService', () => {
    let service: ArtigosService;
    let artigosRepo: any;
    let movimentosRepo: any;
    let stockArmazemRepo: any;

    beforeEach(async () => {
        artigosRepo = {
            find: jest.fn(async () => [{ id: 1 }]),
            findOne: jest.fn(async ({ where }: any) => ({ id: where.id, existencia: 10, stockReservado: 2, stockEncomendado: 5 })),
            create: jest.fn((e: any) => ({ ...e })),
            save: jest.fn(async (e: any) => ({ ...e, id: 1 })),
            update: jest.fn(async () => ({ affected: 1 })),
            delete: jest.fn(async () => ({ affected: 1 })),
        };
        movimentosRepo = {
            find: jest.fn(async () => []),
            findOne: jest.fn(async () => ({ id: 1 })),
            create: jest.fn((e: any) => ({ ...e })),
            save: jest.fn(async (e: any) => ({ ...e, id: 1 })),
            delete: jest.fn(async () => ({ affected: 1 })),
        };
        stockArmazemRepo = {
            find: jest.fn(async () => []),
            findOne: jest.fn(),
            create: jest.fn((e: any) => ({ ...e })),
            save: jest.fn(async (e: any) => e),
            delete: jest.fn(async () => ({ affected: 1 })),
        };
        // RF-OT-004 (#57) — o service passou a injetar DataSource (filtro ?paraReposicao).
        const dataSource = { getRepository: jest.fn() };
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ArtigosService,
                { provide: getRepositoryToken(Artigo), useValue: artigosRepo },
                { provide: getRepositoryToken(MovimentoStock), useValue: movimentosRepo },
                { provide: getRepositoryToken(StockArmazem), useValue: stockArmazemRepo },
                { provide: DataSource, useValue: dataSource },
            ],
        }).compile();
        service = module.get(ArtigosService);
    });

    it('CRUD básico delega no repositório', async () => {
        await service.findAll();
        await service.findOne(1);
        await service.create({ codigo: 'A1' } as any);
        await service.update(1, { descricao: 'x' } as any);
        await service.remove(1);
        expect(artigosRepo.find).toHaveBeenCalled();
        expect(artigosRepo.save).toHaveBeenCalled();
        expect(artigosRepo.update).toHaveBeenCalledWith(1, { descricao: 'x' });
        expect(artigosRepo.delete).toHaveBeenCalledWith(1);
    });

    it('#195 — retenção só em Serviços: 422 num Produto; passar a Produto desliga-a', async () => {
        await expect(service.create({ codigo: 'P1', sujeitoRetencao: true } as any)).rejects.toMatchObject({
            response: { errors: { sujeitoRetencao: expect.stringMatching(/Serviço/) } },
        });
        artigosRepo.findOne.mockResolvedValueOnce({ id: 1, tipo: 'SERVICO', sujeitoRetencao: true });
        await service.update(1, { tipo: 'PRODUTO' } as any);
        expect(artigosRepo.update).toHaveBeenCalledWith(1, { tipo: 'PRODUTO', sujeitoRetencao: false });
    });

    it('ajusteExistencia soma o delta à existência', async () => {
        await service.ajusteExistencia(1, 5);
        expect(artigosRepo.update).toHaveBeenCalledWith(1, { existencia: 15 });
    });

    it('ajusteExistencia devolve null se o artigo não existe', async () => {
        artigosRepo.findOne.mockResolvedValueOnce(null);
        const r = await service.ajusteExistencia(99, 5);
        expect(r).toBeNull();
    });

    it('ajusteReserva nunca desce abaixo de 0', async () => {
        await service.ajusteReserva(1, -10); // reservado 2 - 10 → 0
        expect(artigosRepo.update).toHaveBeenCalledWith(1, { stockReservado: 0 });
    });

    it('ajusteStockEncomendado nunca desce abaixo de 0', async () => {
        await service.ajusteStockEncomendado(1, -10); // 5 - 10 → 0
        expect(artigosRepo.update).toHaveBeenCalledWith(1, { stockEncomendado: 0 });
    });

    it('createMovimento de entrada atualiza dataUltimaEntrada', async () => {
        await service.createMovimento({ artigoId: 1, tipo: 'entrada', quantidade: 3 });
        const call = artigosRepo.update.mock.calls.find((c: any[]) => c[1]?.dataUltimaEntrada);
        expect(call).toBeDefined();
    });

    it('createMovimento de saída atualiza dataUltimaSaida', async () => {
        await service.createMovimento({ artigoId: 1, tipo: 'saida', quantidade: 3 });
        const call = artigosRepo.update.mock.calls.find((c: any[]) => c[1]?.dataUltimaSaida);
        expect(call).toBeDefined();
    });

    it('createMovimento sem artigoId não toca no artigo', async () => {
        await service.createMovimento({ tipo: 'entrada', quantidade: 3 });
        expect(movimentosRepo.save).toHaveBeenCalled();
        expect(artigosRepo.update).not.toHaveBeenCalled();
    });

    it('upsertStockArmazem cria nova linha e ressincroniza a existência', async () => {
        stockArmazemRepo.findOne.mockResolvedValue(null);
        stockArmazemRepo.find.mockResolvedValue([{ quantidade: 4 }, { quantidade: 6 }]);
        await service.upsertStockArmazem(1, 2, 4, 1);
        expect(stockArmazemRepo.create).toHaveBeenCalled();
        // resync: soma 4+6 = 10
        expect(artigosRepo.update).toHaveBeenCalledWith(1, { existencia: 10 });
    });

    it('upsertStockArmazem atualiza linha existente', async () => {
        stockArmazemRepo.findOne.mockResolvedValue({ id: 5, quantidade: 1, stockMinimo: 0 });
        stockArmazemRepo.find.mockResolvedValue([{ quantidade: 8 }]);
        await service.upsertStockArmazem(1, 2, 8, 2);
        expect(stockArmazemRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 5, quantidade: 8 }));
    });

    it('removeStockArmazem apaga e ressincroniza a existência do artigo', async () => {
        stockArmazemRepo.findOne.mockResolvedValue({ id: 5, artigo: { id: 1 } });
        stockArmazemRepo.find.mockResolvedValue([{ quantidade: 3 }]);
        await service.removeStockArmazem(5);
        expect(stockArmazemRepo.delete).toHaveBeenCalledWith(5);
        expect(artigosRepo.update).toHaveBeenCalledWith(1, { existencia: 3 });
    });

    it('findAllMovimentos / findOneMovimento / removeMovimento delegam no repo', async () => {
        await service.findAllMovimentos();
        await service.findOneMovimento(1);
        await service.removeMovimento(1);
        expect(movimentosRepo.find).toHaveBeenCalled();
        expect(movimentosRepo.delete).toHaveBeenCalledWith(1);
    });
});

/**
 * Unit — ArtigosService.findAll (RF-OT-004 #57)
 * Cobre: `disponivel = existencia − stock_reservado` e o filtro
 * `?paraReposicao=true` (lista de reposição).
 */
describe('ArtigosService.findAll (RF-OT-004)', () => {
    const artigosAll = [
        { id: 1, descricao: 'A', existencia: 10, stockReservado: 3 },
        { id: 2, descricao: 'B', existencia: 5, stockReservado: 0 },
    ];

    function makeService(reposicaoIds: number[]) {
        const artigosRepo: any = {
            find: jest.fn(async () => artigosAll),
            findBy: jest.fn(async ({ id }: any) => artigosAll.filter((a) => id._value?.includes?.(a.id) ?? id.includes?.(a.id))),
        };
        // In() devolve um FindOperator; simplificamos comparando via _value.
        const qb = {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getRawMany: jest.fn(async () => reposicaoIds.map((id) => ({ artigoId: id }))),
        };
        const dataSource: any = {
            getRepository: jest.fn(() => ({ createQueryBuilder: jest.fn(() => qb) })),
        };
        return new ArtigosService(artigosRepo, {} as any, {} as any, dataSource);
    }

    it('sem filtro devolve todos com o campo disponivel calculado', async () => {
        const svc = makeService([]);
        const res: any[] = await svc.findAll();
        expect(res).toHaveLength(2);
        expect(res[0].disponivel).toBe(7); // 10 − 3
        expect(res[1].disponivel).toBe(5);
    });

    it('paraReposicao=true devolve só os artigos com linhas em reposição', async () => {
        const svc = makeService([1]);
        const res: any[] = await svc.findAll({ paraReposicao: 'true' });
        expect(res.map((a) => a.id)).toEqual([1]);
        expect(res[0].disponivel).toBe(7);
    });

    it('paraReposicao=true sem linhas devolve lista vazia', async () => {
        const svc = makeService([]);
        const res: any[] = await svc.findAll({ paraReposicao: 'true' });
        expect(res).toEqual([]);
    });
});

/**
 * Unit — ArtigosService.transferencia (#37, transação DB)
 * Cobre: validações de guarda, débito/crédito atómico entre armazéns,
 * criação da linha de destino inexistente e registo do movimento.
 */
describe('ArtigosService.transferencia (#37)', () => {
    function makeManager(origem: any, destino: any) {
        const saRepo = {
            findOne: jest.fn()
                .mockResolvedValueOnce(origem)   // origem
                .mockResolvedValueOnce(destino), // destino
            create: jest.fn((e: any) => ({ ...e })),
            save: jest.fn(async (e: any) => e),
        };
        const movRepo = {
            create: jest.fn((e: any) => ({ ...e })),
            save: jest.fn(async (e: any) => e),
        };
        const manager = {
            getRepository: jest.fn((ent: any) => (ent === StockArmazem ? saRepo : movRepo)),
        };
        const dataSource: any = { transaction: jest.fn(async (cb: any) => cb(manager)) };
        const svc = new ArtigosService({} as any, movRepo as any, saRepo as any, dataSource);
        return { svc, saRepo, movRepo, dataSource };
    }

    it('rejeita quantidade não positiva', async () => {
        const { svc } = makeManager({ quantidade: 10 }, null);
        await expect(svc.transferencia(1, 1, 2, 0)).rejects.toThrow(/positiva/i);
    });

    it('rejeita origem igual ao destino', async () => {
        const { svc } = makeManager({ quantidade: 10 }, null);
        await expect(svc.transferencia(1, 2, 2, 5)).rejects.toThrow(/diferentes/i);
    });

    it('rejeita stock insuficiente na origem', async () => {
        const { svc } = makeManager({ quantidade: 3 }, null);
        await expect(svc.transferencia(1, 1, 2, 5)).rejects.toThrow(/insuficiente/i);
    });

    it('debita origem, credita destino existente e regista o movimento', async () => {
        const origem = { quantidade: 10 };
        const destino = { quantidade: 4 };
        const { svc, saRepo, movRepo } = makeManager(origem, destino);
        const res = await svc.transferencia(1, 1, 2, 6, 'ana@x.pt');
        expect(origem.quantidade).toBe(4);   // 10 − 6
        expect(destino.quantidade).toBe(10); // 4 + 6
        expect(saRepo.create).not.toHaveBeenCalled();
        expect(movRepo.save).toHaveBeenCalled();
        expect(res).toEqual({ ok: true, artigoId: 1, quantidade: 6 });
    });

    it('cria a linha de destino quando não existe', async () => {
        const origem = { quantidade: 8 };
        const { svc, saRepo } = makeManager(origem, null);
        await svc.transferencia(1, 1, 3, 2);
        expect(origem.quantidade).toBe(6);
        expect(saRepo.create).toHaveBeenCalledWith(expect.objectContaining({ quantidade: 2 }));
    });

    // #37 — rollback: falha a meio (gravação do movimento) desfaz o débito/crédito.
    // A transação faz snapshot das quantidades mutáveis e restaura-as em caso de erro,
    // como no adaptador real do TypeORM.
    it('rollback: falha ao gravar o movimento repõe origem e destino', async () => {
        const origem = { quantidade: 10 };
        const destino = { quantidade: 4 };
        const saRepo = {
            findOne: jest.fn()
                .mockResolvedValueOnce(origem)
                .mockResolvedValueOnce(destino),
            create: jest.fn((e: any) => ({ ...e })),
            save: jest.fn(async (e: any) => e),
        };
        const movRepo = {
            create: jest.fn((e: any) => ({ ...e })),
            save: jest.fn(async () => { throw new Error('falha simulada ao gravar movimento'); }),
        };
        const manager = {
            getRepository: jest.fn((ent: any) => (ent === StockArmazem ? saRepo : movRepo)),
        };
        const dataSource: any = {
            transaction: jest.fn(async (cb: any) => {
                const snap = [origem.quantidade, destino.quantidade];
                try {
                    return await cb(manager);
                } catch (err) {
                    [origem.quantidade, destino.quantidade] = snap;
                    throw err;
                }
            }),
        };
        const svc = new ArtigosService({} as any, movRepo as any, saRepo as any, dataSource);

        await expect(svc.transferencia(1, 1, 2, 6, 'ana@x.pt')).rejects.toThrow(/movimento/i);
        // estado reposto: nenhuma quantidade alterada
        expect(origem.quantidade).toBe(10);
        expect(destino.quantidade).toBe(4);
    });
});
