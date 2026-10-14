import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { LiquidacoesService } from './liquidacoes.service';
import { Liquidacao, LiquidacaoLinha } from './liquidacao.entity';
import { MovimentoConta } from './movimento-conta.entity';
import { SessaoCaixa } from './sessao-caixa.entity';
import { MovimentoCc } from '../vendas/movimento-cc.entity';
import { DocumentoConfig } from '../vendas-config/documento-config.entity';
import { ContaBancaria } from '../vendas-config/conta-bancaria.entity';
import { MotivoEstorno } from '../vendas-config/motivo-estorno.entity';
import { Serie } from '../vendas-config/serie.entity';
import { anoLocal } from '../vendas-config/series.rules';

/**
 * #169 — Estorno de liquidação (RE → ERE): repõe o pendente e gera MC de sinal
 * contrário na mesma conta (sessão de caixa aberta hoje). O e2e cobre o mesmo
 * fluxo contra BD real (test/vendas-estorno.e2e.spec.ts).
 */
describe('LiquidacoesService.estornar', () => {
    let svc: LiquidacoesService;
    let repo: any; let mcRepo: any; let sysLogs: any; let dataSource: any; let m: any;
    let st: any;
    const ano = anoLocal(new Date());
    const serie = (id: number, documentoConfigId: number) => ({
        id, documentoConfigId, codigo: String(ano), ano, limiteInferior: 0, limiteSuperior: 999,
        ultimoNumero: null, ultimaDataHora: null, porDefeito: true, sugereDataSistema: true, ativo: true,
    });
    const configs: Record<number, any> = {
        20: { id: 20, codigo: 'RE', tipoCodigo: 'LIQUIDACOES', natureza: 'RECEBIMENTO', ativo: true, estorno: true, estornoDocId: 21, estornoSerieId: null },
        21: { id: 21, codigo: 'ERE', tipoCodigo: 'LIQUIDACOES', natureza: 'PAGAMENTO', ativo: true, ligacaoTesouraria: true, ligacaoTesourariaDocId: 30 },
        30: { id: 30, codigo: 'MC', tipoCodigo: 'MOV_CONTA', ativo: true },
    };
    const erros = async (p: Promise<unknown>) => {
        try { await p; } catch (e) {
            expect(e).toBeInstanceOf(UnprocessableEntityException);
            return ((e as UnprocessableEntityException).getResponse() as any).errors;
        }
        throw new Error('esperava 422');
    };
    const saves = (entity: any) => m.save.mock.calls.filter((c: any[]) => c[0] === entity).map((c: any[]) => c[1]);

    beforeEach(() => {
        st = {
            origem: { id: 9, documentoConfigId: 20, serieId: 200, numero: 1, dataHora: new Date(Date.now() - 60_000), clienteId: 3,
                contaBancariaId: 7, total: '50000.00', desconto: '0', moeda: 'AOA', referenciaPagamento: null, liquidacaoOrigemId: null },
            ja: null,
            motivo: { id: 10, ativo: true, descricao: 'Erro de faturação' },
            conta: { id: 7, codigo: 'CXAOA', tipo: 'CAIXA', aberta: true, ativo: true },
            sessao: { id: 11, contaBancariaId: 7, valorDeclarado: '0' },
            sessaoValores: [{ id: 1, valor: '50000.00' }],
            mcs: [{ id: 4, valor: '50000.00', modoPagamentoId: 2 }],
            linhas: [{ id: 2, movimentoCcId: 1, valorPago: '50000.00', desconto: '0' }],
            movs: [{ id: 1, valorOriginal: '114000.00', valorPendente: '29800.00' }],
        };
        m = {
            findOne: jest.fn(async (entity: any, opts: any) => {
                const w = opts?.where ?? {};
                if (entity === Liquidacao) return w.liquidacaoOrigemId ? st.ja : w.id === 9 ? st.origem : null;
                if (entity === DocumentoConfig) return configs[w.id] ?? null;
                if (entity === Serie) {
                    if (w.id === 200) return serie(200, 20);
                    return w.documentoConfigId === 30 ? serie(300, 30) : serie(210, 21);
                }
                if (entity === MotivoEstorno) return st.motivo;
                if (entity === ContaBancaria) return st.conta;
                if (entity === SessaoCaixa) return st.sessao;
                return null;
            }),
            find: jest.fn(async (entity: any, opts: any) => {
                if (entity === MovimentoConta) return opts.where.sessaoCaixaId ? st.sessaoValores : st.mcs;
                if (entity === LiquidacaoLinha) return st.linhas;
                if (entity === MovimentoCc) return st.movs;
                return [];
            }),
            create: jest.fn((_e: any, o: any) => ({ ...o })),
            save: jest.fn(async (e: any, o: any) => (e === Liquidacao ? { id: 12, ...o } : o)),
            update: jest.fn(),
            query: jest.fn(async (sql: string) => (sql.includes('FROM clientes') ? [{ id: 3, nome: 'Cliente' }] : [{ nome: 'AQUATEX' }])),
        };
        repo = {
            find: jest.fn(async () => []),
            findOne: jest.fn(async () => ({ id: 12, numero: 1, total: '50000.00', desconto: '0', liquidacaoOrigemId: 9, linhas: [] })),
        };
        mcRepo = { find: jest.fn(async () => []) };
        sysLogs = { create: jest.fn() };
        dataSource = { transaction: jest.fn(async (cb: any) => cb(m)), query: jest.fn(async () => []) };
        svc = new LiquidacoesService(repo, mcRepo, sysLogs, dataSource);
    });

    it('emite o ERE, repõe o pendente e devolve o valor da caixa com MC negativo na sessão aberta', async () => {
        const r: any = await svc.estornar(9, { motivoEstornoId: 10 }, { id: 5, email: 'u@x' });
        const [ere] = saves(Liquidacao);
        expect(ere).toMatchObject({
            documentoConfigId: 21, serieId: 210, numero: 1, clienteId: 3, contaBancariaId: 7, total: 50000,
            liquidacaoOrigemId: 9, motivoEstornoId: 10, emitidoPorId: 5,
        });
        expect(ere.linhas).toEqual([{ movimentoCcId: 1, valorPago: 50000, desconto: 0, pendenteAnterior: 29800 }]);
        expect(m.update).toHaveBeenCalledWith(MovimentoCc, 1, { valorPendente: 79800 });
        expect(saves(MovimentoConta)).toEqual([expect.objectContaining({
            contaBancariaId: 7, sessaoCaixaId: 11, origemId: 12, valor: -50000, modoPagamentoId: 2, serieId: 300, numero: 1,
        })]);
        expect(sysLogs.create).toHaveBeenCalledWith(expect.objectContaining({ acao: 'LIQUIDACAO_ESTORNADA' }));
        expect(r).toMatchObject({ id: 12, eEstorno: true });
    });

    it('caixa fechada → 422 e nada é gravado', async () => {
        st.conta.aberta = false;
        expect((await erros(svc.estornar(9, { motivoEstornoId: 10 }))).contaBancariaId)
            .toBe('A caixa CXAOA está fechada. Abra a caixa antes de estornar recebimentos.');
        expect(m.save).not.toHaveBeenCalled();
    });

    it('caixa sem saldo para devolver → 422', async () => {
        st.sessaoValores = [{ id: 1, valor: '10000.00' }];
        expect((await erros(svc.estornar(9, { motivoEstornoId: 10 }))).contaBancariaId).toMatch(/não tem saldo/);
    });

    it('conta bancária (não caixa) não exige sessão', async () => {
        st.conta = { id: 7, codigo: 'BFA', tipo: 'DO', ativo: true };
        await svc.estornar(9, { motivoEstornoId: 10 });
        expect(saves(MovimentoConta)[0]).toMatchObject({ sessaoCaixaId: null, valor: -50000 });
    });

    it('já estornada, ou é ela própria um estorno → 409; inexistente → 404', async () => {
        st.ja = { id: 12, numero: 1, documentoConfig: { codigo: 'ERE' }, serie: { codigo: String(ano) } };
        await expect(svc.estornar(9, { motivoEstornoId: 10 })).rejects.toThrow(/já foi estornado \(ERE/);
        st.ja = null;
        st.origem.liquidacaoOrigemId = 3;
        await expect(svc.estornar(9, { motivoEstornoId: 10 })).rejects.toBeInstanceOf(ConflictException);
        await expect(svc.estornar(99, { motivoEstornoId: 10 })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('motivo inválido, data anterior ou estorno não configurado → 422', async () => {
        st.motivo = null;
        expect((await erros(svc.estornar(9, { motivoEstornoId: 77 }))).motivoEstornoId).toBeDefined();
        st.motivo = { id: 10, ativo: true, descricao: 'x' };
        expect((await erros(svc.estornar(9, { motivoEstornoId: 10, dataHora: new Date(Date.now() - 3_600_000).toISOString() }))).dataHora)
            .toMatch(/anterior/);
        const re = configs[20];
        configs[20] = { ...re, estorno: false };
        try {
            expect((await erros(svc.estornar(9, { motivoEstornoId: 10 }))).documentoConfigId).toMatch(/não admite estorno/);
        } finally { configs[20] = re; }
    });

    it('pendente reposto acima do original (inconsistência) → 409', async () => {
        st.movs = [{ id: 1, valorOriginal: '114000.00', valorPendente: '100000.00' }];
        await expect(svc.estornar(9, { motivoEstornoId: 10 })).rejects.toBeInstanceOf(ConflictException);
    });
});
