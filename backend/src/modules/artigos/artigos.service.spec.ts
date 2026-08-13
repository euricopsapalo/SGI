/**
 * Unit — ArtigosService.findAll (RF-OT-004 #57)
 * Cobre: `disponivel = existencia − stock_reservado` e o filtro
 * `?paraReposicao=true` (lista de reposição).
 */
import 'reflect-metadata';
import { ArtigosService } from './artigos.service';

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
