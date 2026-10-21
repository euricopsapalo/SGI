import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FaturasService } from './faturas.service';
import { Fatura } from './fatura.entity';

/** Unit — FaturasService (issue #38, cobertura ≥80%). */
describe('FaturasService', () => {
    let service: FaturasService;
    let repo: any;

    beforeEach(async () => {
        repo = {
            find: jest.fn(async () => [{ id: 1 }]),
            findOne: jest.fn(async ({ where }: any) => ({ id: where.id })),
            create: jest.fn((e: any) => ({ ...e })),
            save: jest.fn(async (e: any) => ({ ...e, id: 10 })),
            update: jest.fn(async () => ({ affected: 1 })),
            delete: jest.fn(async () => ({ affected: 1 })),
        };
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FaturasService,
                { provide: getRepositoryToken(Fatura), useValue: repo },
            ],
        }).compile();
        service = module.get(FaturasService);
    });

    it('findAll carrega cliente e linhas', async () => {
        await service.findAll();
        expect(repo.find).toHaveBeenCalledWith({ relations: ['cliente', 'linhas'] });
    });

    it('findOne carrega relações da fatura pedida', async () => {
        await service.findOne(7);
        expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 7 }, relations: ['cliente', 'linhas'] });
    });

    it('create liga o cliente por id e usa linhas fornecidas', async () => {
        await service.create({ clienteId: '3', linhas: [{ descricao: 'X' }], valorTotal: 100 });
        const arg = repo.create.mock.calls[0][0];
        expect(arg.cliente).toEqual({ id: 3 });
        expect(arg.linhas).toHaveLength(1);
        expect(repo.save).toHaveBeenCalled();
    });

    it('create sem clienteId deixa cliente indefinido e linhas vazias', async () => {
        await service.create({ valorTotal: 50 });
        const arg = repo.create.mock.calls[0][0];
        expect(arg.cliente).toBeUndefined();
        expect(arg.linhas).toEqual([]);
    });

    it('update remove linhas/clienteId e — #218 — o estado e o pagamento do patch', async () => {
        await service.update(5, {
            clienteId: '9', linhas: [{ id: 1 }], estado: 'Paga', dataPagamento: '2026-10-21',
            comprovativo: 'x', motivoAnulacao: 'y', observacoes: 'nota',
        });
        expect(repo.update).toHaveBeenCalledWith(5, { observacoes: 'nota' });
        expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 5 }, relations: ['cliente', 'linhas'] });
    });

    it('remove apaga por id', async () => {
        await service.remove(4);
        expect(repo.delete).toHaveBeenCalledWith(4);
    });
});
