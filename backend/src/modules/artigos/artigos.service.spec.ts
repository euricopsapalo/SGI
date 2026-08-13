import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
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
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ArtigosService,
                { provide: getRepositoryToken(Artigo), useValue: artigosRepo },
                { provide: getRepositoryToken(MovimentoStock), useValue: movimentosRepo },
                { provide: getRepositoryToken(StockArmazem), useValue: stockArmazemRepo },
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
