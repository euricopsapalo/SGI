import { TabelasSistemaService } from './tabelas-sistema.service';

/** #223 — cobertura: o CRUD das tabelas do sistema delega no repositório certo. */
describe('TabelasSistemaService', () => {
    const repos: any[] = [];
    const novoRepo = () => {
        const r = {
            find: jest.fn(async () => [{ id: 1 }]),
            findOne: jest.fn(async () => ({ id: 1 })),
            create: jest.fn((b: any) => ({ ...b })),
            save: jest.fn(async (b: any) => ({ ...b, id: 1 })),
            update: jest.fn(async () => ({ affected: 1 })),
            delete: jest.fn(async () => ({ affected: 1 })),
        };
        repos.push(r);
        return r;
    };
    // o construtor recebe um repositório por tabela (14)
    const service: any = new (TabelasSistemaService as any)(...Array.from({ length: 14 }, novoRepo));
    const metodos = Object.getOwnPropertyNames(TabelasSistemaService.prototype).filter(m => m !== 'constructor');

    beforeEach(() => repos.forEach(r => Object.values(r).forEach((f: any) => f.mockClear?.())));

    it('tem CRUD para as 14 tabelas', () => {
        expect(metodos.filter(m => m.startsWith('create'))).toHaveLength(14);
        expect(metodos.filter(m => m.startsWith('remove'))).toHaveLength(14);
    });

    it.each(metodos)('%s delega no repositório', async (metodo) => {
        const args = metodo.startsWith('create') ? [{ descricao: 'x' }]
            : metodo.startsWith('update') ? [1, { descricao: 'y' }]
            : metodo.startsWith('findAll') ? []
            : [1];
        const r = await service[metodo](...args);
        expect(r).toBeDefined();
        const chamadas = repos.reduce((n, repo) => n + Object.values(repo).reduce((k: number, f: any) => k + (f.mock?.calls.length ?? 0), 0), 0);
        expect(chamadas).toBeGreaterThan(0);
        if (metodo.startsWith('update')) {
            expect(repos.some(repo => repo.update.mock.calls.some((c: any[]) => c[0] === 1))).toBe(true);
        }
        if (metodo.startsWith('remove')) {
            expect(repos.some(repo => repo.delete.mock.calls.some((c: any[]) => c[0] === 1))).toBe(true);
        }
    });
});
