import { UnprocessableEntityException } from '@nestjs/common';
import { SeriesService } from './series.service';

/** #164 — Séries: série por defeito, limites e bloqueio após o 1.º documento (R2). */
describe('SeriesService', () => {
    let repo: any;
    let docRepo: any;
    let manager: any;
    let svc: SeriesService;

    const serie = (over: any = {}) => ({
        id: 40, documentoConfigId: 4, codigo: '2026', ano: 2026, limiteInferior: 0, limiteSuperior: 99999999,
        ultimoNumero: null, ultimaDataHora: null, porDefeito: true, sugereDataSistema: true, ativo: true, ...over,
    });

    const erros = async (p: Promise<unknown>) => {
        try { await p; } catch (e) {
            expect(e).toBeInstanceOf(UnprocessableEntityException);
            return (e as UnprocessableEntityException).getResponse() as any;
        }
        throw new Error('esperava 422');
    };

    beforeEach(() => {
        repo = {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(async () => serie()),
            exists: jest.fn().mockResolvedValue(false),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
        };
        docRepo = { exists: jest.fn().mockResolvedValue(true), find: jest.fn().mockResolvedValue([]) };
        manager = {
            update: jest.fn(),
            create: jest.fn((_e, o) => ({ ...o })),
            save: jest.fn(async (o) => ({ id: 41, ...o })),
        };
        const dataSource: any = { transaction: jest.fn(async (cb) => cb(manager)) };
        svc = new SeriesService(repo, docRepo, dataSource);
    });

    describe('create', () => {
        const dto = (over: any = {}) => ({ documentoConfigId: 4, codigo: 'B', ano: 2026, ...over });

        it('a primeira série do documento fica por defeito', async () => {
            repo.exists.mockResolvedValue(false);
            await svc.create(dto());
            expect(manager.save.mock.calls[0][0]).toMatchObject({
                porDefeito: true, limiteInferior: 0, limiteSuperior: 99999999, ultimoNumero: null,
            });
        });

        it('série por defeito nova retira a marca às outras séries do documento', async () => {
            repo.exists.mockImplementation(async ({ where }: any) => !where.codigo); // já há séries, código livre
            await svc.create(dto({ porDefeito: true }));
            expect(manager.update).toHaveBeenCalledWith(expect.anything(), { documentoConfigId: 4 }, { porDefeito: false });
        });

        it('documento inexistente, código repetido ou limites incoerentes → 422', async () => {
            docRepo.exists.mockResolvedValue(false);
            expect((await erros(svc.create(dto()))).errors.documentoConfigId).toBeDefined();

            docRepo.exists.mockResolvedValue(true);
            repo.exists.mockResolvedValue(true);
            expect((await erros(svc.create(dto()))).errors.codigo).toMatch(/já tem uma série/);

            repo.exists.mockResolvedValue(false);
            const r = await erros(svc.create(dto({ limiteInferior: 100, limiteSuperior: 100 })));
            expect(r.errors.limiteSuperior).toMatch(/maior/);
        });

        it('devolve as datas derivadas do ano', async () => {
            repo.findOne.mockResolvedValue(serie({ id: 41, codigo: 'B' }));
            await expect(svc.create(dto())).resolves.toMatchObject({ dataInicial: '2026-01-01', dataFinal: '2026-12-31', emUso: false });
        });
    });

    describe('update — R2', () => {
        it('série em uso: ano, código e limites bloqueados', async () => {
            repo.findOne.mockResolvedValue(serie({ ultimoNumero: 5 }));
            const r = await erros(svc.update(40, { ano: 2027, limiteSuperior: 10 }));
            expect(r.errors.ano).toMatch(/bloqueada/);
            expect(r.errors.limiteSuperior).toMatch(/bloqueada/);
        });

        it('série em uso: por defeito, sugestão de data e activo continuam editáveis', async () => {
            repo.findOne.mockResolvedValue(serie({ ultimoNumero: 5, porDefeito: false }));
            await svc.update(40, { porDefeito: true, sugereDataSistema: false });
            expect(manager.update).toHaveBeenCalledWith(expect.anything(), { documentoConfigId: 4 }, { porDefeito: false });
            expect(manager.update).toHaveBeenCalledWith(expect.anything(), 40, { porDefeito: true, sugereDataSistema: false });
        });

        it('série sem uso: limites podem mudar, mas têm de ser coerentes', async () => {
            await svc.update(40, { limiteSuperior: 500 });
            expect(manager.update).toHaveBeenCalledWith(expect.anything(), 40, { limiteSuperior: 500 });
            expect((await erros(svc.update(40, { limiteInferior: 600, limiteSuperior: 500 }))).errors.limiteSuperior).toBeDefined();
        });
    });

    describe('remove', () => {
        it('série com documentos → 422', async () => {
            repo.findOne.mockResolvedValue(serie({ ultimoNumero: 1 }));
            expect((await erros(svc.remove(40))).errors.id).toMatch(/documentos emitidos/);
        });

        it('série usada como série de estorno → 422', async () => {
            docRepo.find.mockResolvedValue([{ codigo: 'FT' }]);
            expect((await erros(svc.remove(40))).errors.id).toMatch(/FT/);
        });

        it('série livre → eliminada', async () => {
            await expect(svc.remove(40)).resolves.toEqual({ id: 40 });
        });
    });
});
