import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { DocumentosConfigService } from './documentos-config.service';
import { validarConfiguracao } from './matriz.rules';
import { configFT, matrizFixture, referenciasFixture } from './matriz.fixture';

/** #164 — Documentos configurados: validação pela matriz, unicidade e bloqueio R2. */
describe('DocumentosConfigService', () => {
    const m = matrizFixture();
    const refs = referenciasFixture();

    let repo: any;
    let serieRepo: any;
    let matriz: any;
    let svc: DocumentosConfigService;

    const ftGuardada = () => ({
        id: 4, codigo: 'FT', descricao: 'Fatura', tipoCodigo: 'FINANCEIRO', ativo: true,
        ...configFT(),
        operaSobreCc: false, ligacaoTesouraria: false, ligacaoTesourariaDocId: null,
        liquidacaoAutomatica: false, liquidacaoAutoDocId: null,
        acertoSobraDocId: null, acertoQuebraDocId: null,
        contas: [], series: [],
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
            exists: jest.fn().mockResolvedValue(false),
            create: jest.fn((o) => ({ ...o })),
            save: jest.fn(async (o) => ({ id: 50, ...o })),
            findOne: jest.fn(async () => ftGuardada()),
            find: jest.fn().mockResolvedValue([]),
            delete: jest.fn().mockResolvedValue({ affected: 1 }),
        };
        serieRepo = { exists: jest.fn().mockResolvedValue(false) };
        matriz = {
            validar: jest.fn(async (tipo: string, valores: any, selfId?: number) =>
                ({ ...validarConfiguracao(m, refs, tipo, valores, selfId), matriz: m })),
        };
        svc = new DocumentosConfigService(repo, serieRepo, matriz);
    });

    describe('create', () => {
        const dto = () => ({ codigo: 'FT2', descricao: 'Fatura 2', tipoCodigo: 'FINANCEIRO', ...configFT() } as any);

        it('grava a configuração normalizada pela matriz', async () => {
            await svc.create(dto());
            const gravado = repo.save.mock.calls[0][0];
            expect(gravado).toMatchObject({
                codigo: 'FT2', tipoCodigo: 'FINANCEIRO', tipoFiscal: 'FT', ativo: true,
                ligacaoTesouraria: false, liquidacaoAutoDocId: null, contas: [],
            });
            expect(matriz.validar).toHaveBeenCalledWith('FINANCEIRO', expect.objectContaining({ tipoFiscal: 'FT' }));
        });

        it('código repetido → 422 no campo codigo', async () => {
            repo.exists.mockResolvedValue(true);
            const r = await erros(svc.create(dto()));
            expect(r.errors.codigo).toMatch(/Já existe/);
            expect(repo.save).not.toHaveBeenCalled();
        });

        it('configuração inválida para o tipo → 422 com os erros da matriz', async () => {
            const r = await erros(svc.create({ ...dto(), tipoFiscal: 'RG' }));
            expect(r.statusCode).toBe(422);
            expect(r.errors.tipoFiscal).toMatch(/elegível/);
        });

        it('bancos associados são gravados como relação', async () => {
            await svc.create({ codigo: 'MC2', descricao: 'Mov', tipoCodigo: 'MOV_CONTA', contasBancariaIds: [7] } as any);
            expect(repo.save.mock.calls[0][0].contas).toEqual([{ id: 7 }]);
        });
    });

    describe('update — R2', () => {
        it('documento sem utilização: a configuração pode mudar', async () => {
            await svc.update(4, { tipoFiscal: 'FR' });
            expect(repo.save.mock.calls[0][0].tipoFiscal).toBe('FR');
        });

        it('documento já utilizado: mudar a configuração comportamental → 422', async () => {
            serieRepo.exists.mockResolvedValue(true);
            const r = await erros(svc.update(4, { tipoFiscal: 'FR' }));
            expect(r.errors.tipoFiscal).toMatch(/bloqueada/);
            expect(repo.save).not.toHaveBeenCalled();
        });

        it('documento já utilizado: mudar o código → 422', async () => {
            serieRepo.exists.mockResolvedValue(true);
            const r = await erros(svc.update(4, { codigo: 'FTX' }));
            expect(r.errors.codigo).toMatch(/bloqueada/);
        });

        it('documento já utilizado: descrição e estado activo continuam editáveis', async () => {
            serieRepo.exists.mockResolvedValue(true);
            await svc.update(4, { descricao: 'Fatura (serviços)', ativo: false });
            expect(repo.save.mock.calls[0][0]).toMatchObject({ descricao: 'Fatura (serviços)', ativo: false, tipoFiscal: 'FT' });
        });

        it('a validação usa os valores actuais completados com os enviados', async () => {
            await svc.update(4, { estorno: false, estornoDocId: null, estornoSerieId: null });
            expect(repo.save.mock.calls[0][0]).toMatchObject({ estorno: false, estornoDocId: null, geraMovCc: true });
        });

        it('documento inexistente → 404', async () => {
            repo.findOne.mockResolvedValue(null);
            await expect(svc.update(99, {})).rejects.toBeInstanceOf(NotFoundException);
        });
    });

    describe('remove', () => {
        it('documento já utilizado → 422', async () => {
            serieRepo.exists.mockResolvedValue(true);
            const r = await erros(svc.remove(4));
            expect(r.errors.id).toMatch(/já foi utilizado/);
        });

        it('documento apontado por outro → 422 com os códigos', async () => {
            repo.find.mockResolvedValue([{ codigo: 'FR' }]);
            const r = await erros(svc.remove(4));
            expect(r.errors.id).toMatch(/FR/);
            expect(repo.delete).not.toHaveBeenCalled();
        });

        it('documento livre → eliminado', async () => {
            await expect(svc.remove(4)).resolves.toEqual({ id: 4 });
            expect(repo.delete).toHaveBeenCalledWith(4);
        });
    });

    it('findAll: expõe contas como ids, datas das séries e o estado de utilização', async () => {
        repo.find.mockResolvedValue([{
            ...ftGuardada(), contas: [{ id: 7 }],
            series: [{ id: 40, codigo: '2026', ano: 2026, ultimoNumero: 3 }, { id: 41, codigo: 'B', ano: 2026, ultimoNumero: null }],
        }]);
        const [doc] = await svc.findAll();
        expect(doc.contasBancariaIds).toEqual([7]);
        expect(doc.emUso).toBe(true);
        expect(doc.series[0]).toMatchObject({ codigo: '2026', dataInicial: '2026-01-01', dataFinal: '2026-12-31', emUso: true });
        expect(doc).not.toHaveProperty('contas');
    });
});
