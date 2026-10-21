import { ConflictException, NotFoundException } from '@nestjs/common';
import { ArmazensService } from './armazens.service';
import { Armazem } from './armazem.entity';
import { StockArmazem } from '../artigos/stock-armazem.entity';

/** #216 — DELETE /armazens/:id deixa de apagar stock em cascata. */
describe('ArmazensService.remove (#216)', () => {
    const montar = (o: { comStock?: number; porOmissao?: number; existe?: boolean } = {}) => {
        const qb: any = { where: jest.fn(() => qb), andWhere: jest.fn(() => qb), getCount: jest.fn(async () => o.comStock ?? 0) };
        const m: any = {
            createQueryBuilder: jest.fn(() => qb),
            count: jest.fn(async () => o.porOmissao ?? 0),
            delete: jest.fn(async () => ({ affected: 1 })),
        };
        const repo: any = {
            findOne: jest.fn(async () => (o.existe === false ? null : { id: 3, codigo: 'ARM-03' })),
            manager: { transaction: jest.fn(async (cb: any) => cb(m)) },
        };
        return { service: new ArmazensService(repo), m };
    };

    it('sem stock e sem artigos que o usem por omissão: apaga as linhas vazias e o armazém', async () => {
        const { service, m } = montar();
        await expect(service.remove(3)).resolves.toEqual({ affected: 1 });
        expect(m.delete).toHaveBeenCalledWith(StockArmazem, { armazem: { id: 3 } });
        expect(m.delete).toHaveBeenCalledWith(Armazem, 3);
    });

    it('com stock → 409 sem apagar nada', async () => {
        const { service, m } = montar({ comStock: 2 });
        await expect(service.remove(3)).rejects.toThrow(ConflictException);
        await expect(service.remove(3)).rejects.toThrow(/tem stock em 2 artigo/);
        expect(m.delete).not.toHaveBeenCalled();
    });

    it('armazém por omissão de artigos → 409 sem apagar nada', async () => {
        const { service, m } = montar({ porOmissao: 5 });
        await expect(service.remove(3)).rejects.toThrow(/por omissão de 5 artigo/);
        expect(m.delete).not.toHaveBeenCalled();
    });

    it('inexistente → 404', async () => {
        const { service } = montar({ existe: false });
        await expect(service.remove(3)).rejects.toThrow(NotFoundException);
    });
});
