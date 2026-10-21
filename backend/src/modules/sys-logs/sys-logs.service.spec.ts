import { SysLogsService } from './sys-logs.service';

/** #210 — GET /logs paginado e filtrado no servidor. */
describe('SysLogsService.listar (#210)', () => {
    const builders: any[] = [];

    const novoQb = (resultado: { many?: [any[], number]; raw?: any[] }) => {
        const qb: any = { wheres: [] as [string, any][] };
        for (const m of ['select', 'addSelect', 'groupBy', 'orderBy', 'addOrderBy']) qb[m] = jest.fn(() => qb);
        qb.andWhere = jest.fn((sql: string, params: any) => { qb.wheres.push([sql, params]); return qb; });
        qb.skip = jest.fn(() => qb);
        qb.take = jest.fn(() => qb);
        qb.getManyAndCount = jest.fn(async () => resultado.many ?? [[], 0]);
        qb.getRawMany = jest.fn(async () => resultado.raw ?? []);
        builders.push(qb);
        return qb;
    };

    const montar = () => {
        builders.length = 0;
        const fila = [
            novoQb({ many: [[{ id: 3 }, { id: 2 }], 42] }),
            novoQb({ raw: [{ tipo: 'info', n: '30' }, { tipo: 'error', n: '12' }] }),
            novoQb({ raw: [{ modulo: 'OT' }, { modulo: 'Stock' }] }),
        ];
        const repo: any = { createQueryBuilder: jest.fn(() => fila.shift()) };
        return new SysLogsService(repo, {} as any);
    };

    it('pagina e devolve total, contagem por tipo e módulos', async () => {
        const r = await montar().listar({ pagina: 3, porPagina: 20 });
        expect(builders[0].skip).toHaveBeenCalledWith(40);
        expect(builders[0].take).toHaveBeenCalledWith(20);
        expect(r).toEqual({
            items: [{ id: 3 }, { id: 2 }], total: 42, pagina: 3, porPagina: 20,
            porTipo: { info: 30, warning: 0, error: 12 },
            modulos: ['OT', 'Stock'],
        });
    });

    it('por omissão: página 1 com 50 registos e sem filtros (o admin vê todos)', async () => {
        await montar().listar();
        expect(builders[0].skip).toHaveBeenCalledWith(0);
        expect(builders[0].take).toHaveBeenCalledWith(50);
        expect(builders[0].wheres).toEqual([]);
    });

    it('aplica os filtros; a contagem por tipo ignora o filtro de tipo', async () => {
        await montar().listar({ usuario: 'ana@aquatex.ao', modulo: 'OT', tipo: 'error', q: ' falha ', de: '2026-10-01', ate: '2026-10-21' });
        const params = (qb: any) => Object.assign({}, ...qb.wheres.map(([, p]: any) => p));
        expect(params(builders[0])).toEqual({
            usuario: 'ana@aquatex.ao', modulo: 'OT', tipo: 'error', q: '%falha%', de: '2026-10-01', ate: '2026-10-21',
        });
        expect(params(builders[1])).not.toHaveProperty('tipo');
        expect(params(builders[1])).toHaveProperty('modulo', 'OT');
    });
});
