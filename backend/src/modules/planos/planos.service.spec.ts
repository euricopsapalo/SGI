import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { PlanosService } from './planos.service';
import { PlanoManutencao } from './plano-manutencao.entity';
import { PlanoMaoObra } from './plano-mao-obra.entity';
import { PlanoArtigo } from './plano-artigo.entity';

/** Unit — PlanosService (#205: editar um plano grava mão de obra, artigos e equipamento). */
describe('PlanosService', () => {
    let repo: any;
    let manager: any;
    let service: PlanosService;

    beforeEach(() => {
        repo = {
            find: jest.fn(async () => []),
            findOne: jest.fn(async ({ where }: any) => ({ id: where.id })),
            create: jest.fn((e: any) => ({ ...e })),
            save: jest.fn(async (e: any) => ({ ...e, id: 1 })),
            delete: jest.fn(async () => ({ affected: 1 })),
        };
        manager = {
            findOne: jest.fn(async (_e: any, { where }: any) => ({ id: where.id })),
            update: jest.fn(async () => ({ affected: 1 })),
            delete: jest.fn(async () => ({ affected: 1 })),
            create: jest.fn((_e: any, v: any) => ({ ...v })),
            save: jest.fn(async (_e: any, v: any) => v),
        };
        const dataSource: any = { transaction: jest.fn(async (cb: any) => cb(manager)) };
        service = new PlanosService(repo, dataSource);
    });

    it('create associa o equipamento e as linhas', async () => {
        await service.create({ equipInstaladoId: '2', descricao: 'P', maosObra: [{ funcaoId: 1 }], artigos: [{ artigoId: 3 }] });
        expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
            equipInstalado: { id: 2 }, maosObra: [{ funcaoId: 1 }], artigos: [{ artigoId: 3 }],
        }));
    });

    it('#205 — update grava os escalares e o equipamento', async () => {
        await service.update(1, { descricao: 'Nova', equipInstaladoId: 5 });
        expect(manager.update).toHaveBeenCalledWith(PlanoManutencao, 1, { descricao: 'Nova', equipInstalado: { id: 5 } });
    });

    it('#205 — update substitui a mão de obra e os artigos', async () => {
        await service.update(1, {
            maosObra: [{ funcaoId: '4', custo: 1500 }],
            artigos: [{ artigoId: '3', quantidade: 2, preco: 45000 }, { artigoId: 9 }],
        });
        expect(manager.delete).toHaveBeenCalledWith(PlanoMaoObra, { plano: { id: 1 } });
        expect(manager.delete).toHaveBeenCalledWith(PlanoArtigo, { plano: { id: 1 } });
        expect(manager.save).toHaveBeenCalledWith(PlanoMaoObra, [{ plano: { id: 1 }, funcaoId: 4, custo: 1500 }]);
        expect(manager.save).toHaveBeenCalledWith(PlanoArtigo, [
            { plano: { id: 1 }, artigoId: 3, quantidade: 2, preco: 45000 },
            { plano: { id: 1 }, artigoId: 9, quantidade: 1, preco: 0 },
        ]);
    });

    it('#205 — aceita também maosDeObra (nome usado no frontend)', async () => {
        await service.update(1, { maosDeObra: [{ funcaoId: 2, custo: 10 }] });
        expect(manager.save).toHaveBeenCalledWith(PlanoMaoObra, [{ plano: { id: 1 }, funcaoId: 2, custo: 10 }]);
    });

    it('#205 — lista vazia apaga as linhas; omitida, não lhes toca', async () => {
        await service.update(1, { artigos: [] });
        expect(manager.delete).toHaveBeenCalledWith(PlanoArtigo, { plano: { id: 1 } });
        expect(manager.delete).not.toHaveBeenCalledWith(PlanoMaoObra, expect.anything());
        expect(manager.save).not.toHaveBeenCalled();
    });

    it('update de um plano inexistente → 404', async () => {
        manager.findOne.mockResolvedValueOnce(null);
        await expect(service.update(99, { descricao: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    });
});
