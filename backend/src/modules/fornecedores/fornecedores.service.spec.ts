import { ConflictException } from '@nestjs/common';
import { FornecedoresService } from './fornecedores.service';

/** #223 — cobertura do FornecedoresService (inclui a guarda de eliminação). */
describe('FornecedoresService', () => {
    const montar = (encomendas = 0) => {
        const repo: any = {
            find: jest.fn(async () => [{ id: 1 }]),
            findOne: jest.fn(async ({ where }: any) => ({ id: where.id, nome: 'F' })),
            create: jest.fn((b: any) => ({ ...b })),
            save: jest.fn(async (b: any) => ({ ...b, id: 2 })),
            update: jest.fn(async () => ({ affected: 1 })),
            delete: jest.fn(async () => ({ affected: 1 })),
        };
        const dataSource: any = { query: jest.fn(async () => [{ total: encomendas }]) };
        return { service: new FornecedoresService(repo, dataSource), repo, dataSource };
    };

    it('CRUD básico delega no repositório', async () => {
        const { service, repo } = montar();
        await expect(service.findAll()).resolves.toEqual([{ id: 1 }]);
        await expect(service.findOne(3)).resolves.toEqual({ id: 3, nome: 'F' });
        await expect(service.create({ nome: 'Novo' } as any)).resolves.toEqual({ nome: 'Novo', id: 2 });
        await expect(service.update(3, { nome: 'X' } as any)).resolves.toEqual({ id: 3, nome: 'F' });
        expect(repo.update).toHaveBeenCalledWith(3, { nome: 'X' });
    });

    it('elimina quando não tem encomendas', async () => {
        const { service, repo } = montar(0);
        await expect(service.remove(3)).resolves.toEqual({ message: 'Fornecedor eliminado com sucesso', id: 3 });
        expect(repo.delete).toHaveBeenCalledWith(3);
    });

    it('com encomendas → 409 sem apagar', async () => {
        const { service, repo } = montar(2);
        await expect(service.remove(3)).rejects.toThrow(ConflictException);
        expect(repo.delete).not.toHaveBeenCalled();
    });
});
