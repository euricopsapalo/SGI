import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { LiquidacoesService } from './liquidacoes.service';
import { Liquidacao } from './liquidacao.entity';
import { MovimentoConta } from './movimento-conta.entity';
import { MovimentoCc } from '../vendas/movimento-cc.entity';
import { DocumentoConfig } from '../vendas-config/documento-config.entity';
import { Serie } from '../vendas-config/serie.entity';
import { ContaBancaria } from '../vendas-config/conta-bancaria.entity';
import { Cliente } from '../clientes/cliente.entity';
import { SessaoCaixa } from './sessao-caixa.entity';
import { ModoPagamento } from '../tabelas-sistema/modo-pagamento.entity';
import { anoLocal } from '../vendas-config/series.rules';

/**
 * #166 — LiquidacoesService: RE que abate pendentes e emite o MC na mesma
 * transacção. O e2e contra BD real cobre o mesmo fluxo com os locks verdadeiros
 * (test/tesouraria-liquidacoes.e2e.spec.ts).
 */
describe('LiquidacoesService', () => {
    let svc: LiquidacoesService;
    let repo: any; let mcRepo: any; let sysLogs: any; let dataSource: any; let m: any;
    let st: any;
    const ano = anoLocal(new Date());
    const agora = new Date().toISOString();

    const re = (over: any = {}) => ({
        id: 20, codigo: 'RE', tipoCodigo: 'LIQUIDACOES', natureza: 'RECEBIMENTO', ativo: true,
        operaSobreCc: true, ccTipoId: 1, ccEstadoId: 1, ligacaoTesouraria: true, ligacaoTesourariaDocId: 30, ...over,
    });
    const serie = (over: any = {}) => ({
        id: 200, documentoConfigId: 20, codigo: String(ano), ano, limiteInferior: 0, limiteSuperior: 999,
        ultimoNumero: null, ultimaDataHora: null, porDefeito: true, sugereDataSistema: true, ativo: true, ...over,
    });
    const dto = (over: any = {}) => ({
        documentoConfigId: 20, clienteId: 3, contaBancariaId: 7,
        linhas: [{ movimentoCcId: 1, valorPago: 50000 }], ...over,
    });
    const erros = async (p: Promise<unknown>) => {
        try { await p; } catch (e) {
            expect(e).toBeInstanceOf(UnprocessableEntityException);
            return ((e as UnprocessableEntityException).getResponse() as any).errors;
        }
        throw new Error('esperava 422');
    };

    beforeEach(() => {
        st = {
            re: re(),
            mc: { id: 30, codigo: 'MC', tipoCodigo: 'MOV_CONTA', ativo: true, contas: [{ id: 7 }] },
            serieRe: serie(),
            serieMc: serie({ id: 300, documentoConfigId: 30 }),
            conta: { id: 7, codigo: 'CXAOA', tipo: 'CAIXA', aberta: true, ativo: true },
            sessao: { id: 11, contaBancariaId: 7 },
            cliente: { id: 3, nome: 'Cliente' },
            movs: [
                { id: 1, clienteId: 3, ccTipoId: 1, ccEstadoId: 1, natureza: 'D', valorPendente: '114000.00', modoPagamentoId: 2 },
                { id: 2, clienteId: 3, ccTipoId: 1, ccEstadoId: 1, natureza: 'D', valorPendente: '10000.00', modoPagamentoId: null },
            ],
            modos: [{ id: 2, movimento: 'TRFR' }],
        };
        repo = {
            find: jest.fn(async () => [{ id: 9, numero: 1, total: '50000.00', desconto: '0', documentoConfig: { codigo: 'RE' }, serie: { codigo: '2026' }, cliente: { nome: 'C' }, contaBancaria: { codigo: 'CXAOA' } }]),
            findOne: jest.fn(async () => ({
                id: 9, numero: 1, total: '50000.00', desconto: '0', documentoConfig: { codigo: 'RE' }, serie: { codigo: '2026' },
                cliente: { nome: 'C' }, contaBancaria: { codigo: 'CXAOA' },
                linhas: [{ id: 2, movimentoCcId: 1, valorPago: '50000.00', desconto: '0', pendenteAnterior: '114000.00' }],
            })),
        };
        mcRepo = { find: jest.fn(async () => [{ id: 4, numero: 1, valor: '50000.00', documentoConfig: { codigo: 'MC' }, serie: { codigo: '2026' }, modoPagamento: { descricao: 'Numerário' } }]) };
        sysLogs = { create: jest.fn() };
        m = {
            findOne: jest.fn(async (entity: any, opts: any) => {
                if (entity === DocumentoConfig) return opts.where.id === 30 ? st.mc : st.re;
                if (entity === Cliente) return st.cliente;
                if (entity === ContaBancaria) return st.conta;
                if (entity === Serie) return opts.where.documentoConfigId === 30 ? st.serieMc : st.serieRe;
                if (entity === SessaoCaixa) return st.sessao;
                return null;
            }),
            find: jest.fn(async (entity: any) => (entity === MovimentoCc ? st.movs : entity === ModoPagamento ? st.modos : [])),
            create: jest.fn((_e: any, o: any) => ({ ...o })),
            save: jest.fn(async (e: any, o: any) => (e === Liquidacao ? { id: 9, ...o } : o)),
            update: jest.fn(),
            // #178 — cópia dos dados do cliente/empresa gravada no recibo.
            query: jest.fn(async (sql: string) => (sql.includes('FROM clientes') ? [{ id: 3, nome: 'Cliente' }] : [{ nome: 'AQUATEX' }])),
        };
        dataSource = {
            transaction: jest.fn(async (cb: any) => cb(m)),
            query: jest.fn(async () => [{ id: 1, numeroDocumento: 'FT 2026/1', otNumero: 'OT-1', valorOriginal: 114000 }]),
        };
        svc = new LiquidacoesService(repo, mcRepo, sysLogs, dataSource);
    });

    it('emite o RE, abate o pendente, numera a série e gera o MC na conta escolhida', async () => {
        const r: any = await svc.create(dto({ dataHora: agora, referenciaPagamento: 'TRF-1' }), { id: 5, email: 'u@x' });
        const liq = m.save.mock.calls.find((c: any[]) => c[0] === Liquidacao)[1];
        expect(liq).toMatchObject({ numero: 1, serieId: 200, clienteId: 3, contaBancariaId: 7, total: 50000, desconto: 0, emitidoPorId: 5 });
        expect(liq).toMatchObject({ referenciaPagamento: 'TRF-1', snapshotCliente: { nome: 'Cliente' }, snapshotEmpresa: { nome: 'AQUATEX' } });
        expect(liq.linhas[0]).toMatchObject({ movimentoCcId: 1, valorPago: 50000, desconto: 0, pendenteAnterior: 114000 });
        expect(m.update).toHaveBeenCalledWith(MovimentoCc, 1, { valorPendente: 64000 });
        expect(m.update).toHaveBeenCalledWith(Serie, 200, { ultimoNumero: 1, ultimaDataHora: new Date(agora) });
        const mc = m.save.mock.calls.find((c: any[]) => c[0] === MovimentoConta)[1];
        expect(mc).toMatchObject({ documentoConfigId: 30, serieId: 300, numero: 1, contaBancariaId: 7, valor: 50000, modoPagamentoId: 2, origemId: 9 });
        expect(mc.sessaoCaixaId).toBe(11); // #167 — o movimento entra na sessão de caixa aberta
        expect(m.update).toHaveBeenCalledWith(Serie, 300, expect.objectContaining({ ultimoNumero: 1 }));
        const locks = m.findOne.mock.calls.filter((c: any[]) => c[1]?.lock).map((c: any[]) => c[0]);
        expect(locks).toEqual([ContaBancaria, Serie, Serie]);
        expect(m.find.mock.calls[0][1].lock).toEqual({ mode: 'pessimistic_write' });
        expect(sysLogs.create).toHaveBeenCalledWith(expect.objectContaining({ acao: 'LIQUIDACAO_EMITIDA' }));
        expect(r).toMatchObject({ numeroDocumento: 'RE 2026/1', total: 50000 });
        expect(r.linhas[0]).toMatchObject({ numeroDocumento: 'FT 2026/1', valorPago: 50000, pendenteAnterior: 114000 });
        expect(r.movimentosConta[0]).toMatchObject({ numeroDocumento: 'MC 2026/1', valor: 50000 });
    });

    it('um MC por modo de pagamento, com números seguidos; o desconto não entra na conta', async () => {
        await svc.create(dto({ linhas: [{ movimentoCcId: 1, valorPago: 100000, desconto: 14000 }, { movimentoCcId: 2, valorPago: 10000 }] }));
        const mcs = m.save.mock.calls.filter((c: any[]) => c[0] === MovimentoConta).map((c: any[]) => c[1]);
        expect(mcs.map((x: any) => [x.modoPagamentoId, x.valor, x.numero])).toEqual([[2, 100000, 1], [null, 10000, 2]]);
        expect(mcs[1].dataHora.getTime()).toBeGreaterThan(mcs[0].dataHora.getTime());
        expect(m.update).toHaveBeenCalledWith(MovimentoCc, 1, { valorPendente: 0 });
        expect(m.save.mock.calls.find((c: any[]) => c[0] === Liquidacao)[1]).toMatchObject({ total: 110000, desconto: 14000 });
    });

    it('caixa fechada → 422 e nada é gravado', async () => {
        st.conta.aberta = false;
        expect((await erros(svc.create(dto()))).contaBancariaId).toMatch(/fechada/);
        expect(m.save).not.toHaveBeenCalled();
    });

    it('#167 — caixa marcada aberta mas sem sessão → 422; conta DO não precisa de sessão', async () => {
        st.sessao = null;
        expect((await erros(svc.create(dto()))).contaBancariaId).toMatch(/fechada/);
        st.conta = { ...st.conta, tipo: 'DO', aberta: false };
        await svc.create(dto());
        expect(m.save.mock.calls.find((c: any[]) => c[0] === MovimentoConta)[1].sessaoCaixaId).toBeNull();
    });

    it('#187 — numerário numa conta que não é caixa → 422 e nada é gravado', async () => {
        st.conta = { ...st.conta, codigo: 'BFAAO', tipo: 'DO', aberta: false };
        st.modos = [{ id: 2, movimento: 'NUM' }];
        expect((await erros(svc.create(dto()))).contaBancariaId).toMatch(/numerário.*BFAAO não é uma caixa/);
        expect(m.save).not.toHaveBeenCalled();
        expect(m.find).toHaveBeenCalledWith(ModoPagamento, { where: { id: expect.anything() } });
    });

    it('#187 — numerário na caixa aberta entra na sessão; transferência no banco é aceite', async () => {
        st.modos = [{ id: 2, movimento: 'NUM' }];
        await svc.create(dto());
        expect(m.save.mock.calls.find((c: any[]) => c[0] === MovimentoConta)[1]).toMatchObject({ contaBancariaId: 7, sessaoCaixaId: 11 });
        expect(m.find).not.toHaveBeenCalledWith(ModoPagamento, expect.anything()); // numa caixa nem é preciso consultar o modo

        m.save.mockClear();
        st.conta = { ...st.conta, tipo: 'DO', aberta: false };
        st.modos = [{ id: 2, movimento: 'TRFR' }];
        await svc.create(dto());
        expect(m.save.mock.calls.find((c: any[]) => c[0] === MovimentoConta)[1]).toMatchObject({ sessaoCaixaId: null });
    });

    it('conta não associada ao MC, inexistente ou inactiva → 422', async () => {
        expect((await erros(svc.create(dto({ contaBancariaId: 8 })))).contaBancariaId).toMatch(/não está associada/);
        st.conta = { ...st.conta, ativo: false };
        expect((await erros(svc.create(dto()))).contaBancariaId).toMatch(/inactiva/);
    });

    it.each([
        ['inexistente', null, /não existe/],
        ['inactivo', re({ ativo: false }), /inactivo/],
        ['que não é recebimento', re({ natureza: 'PAGAMENTO' }), /não é um recebimento/],
        ['sem conta corrente', re({ ccEstadoId: null }), /não opera/],
        ['sem ligação a tesouraria', re({ ligacaoTesouraria: false }), /ligação a tesouraria/],
    ])('documento %s → 422', async (_n, cfg, msg) => {
        st.re = cfg;
        expect((await erros(svc.create(dto()))).documentoConfigId).toMatch(msg as RegExp);
    });

    it('MC inexistente/inactivo ou cliente inexistente → 422', async () => {
        st.mc = { ...st.mc, ativo: false };
        expect((await erros(svc.create(dto()))).documentoConfigId).toMatch(/tesouraria/);
        st.mc.ativo = true; st.cliente = null;
        expect((await erros(svc.create(dto()))).clienteId).toMatch(/não existe/);
    });

    it('linhas inválidas (excede pendente) e total zero → 422', async () => {
        expect((await erros(svc.create(dto({ linhas: [{ movimentoCcId: 1, valorPago: 200000 }] }))))['linhas.0.valorPago']).toMatch(/excede/);
        expect((await erros(svc.create(dto({ linhas: [{ movimentoCcId: 1, valorPago: 0, desconto: 10 }] })))).linhas).toMatch(/superior a zero/);
    });

    it('série: retroactiva → 422 (dataHora); outra série; sem série; exige data', async () => {
        st.serieRe = serie({ ultimoNumero: 3, ultimaDataHora: new Date(Date.now() + 3600_000) });
        expect((await erros(svc.create(dto()))).dataHora).toMatch(/posterior/);
        st.serieRe = serie({ documentoConfigId: 99 });
        expect((await erros(svc.create(dto({ serieId: 200 })))).serieId).toMatch(/não pertence/);
        st.serieRe = null;
        expect((await erros(svc.create(dto()))).serieId).toMatch(/série por defeito/);
        st.serieRe = serie({ sugereDataSistema: false });
        expect((await erros(svc.create(dto()))).dataHora).toMatch(/exige/);
    });

    it('série do MC com data posterior → 422 identificado como Movimento em conta', async () => {
        st.serieMc = serie({ id: 300, documentoConfigId: 30, ultimoNumero: 5, ultimaDataHora: new Date(Date.now() + 3600_000) });
        expect((await erros(svc.create(dto()))).dataHora).toMatch(/^Movimento em conta \(MC\)/);
    });

    it('série esgotada → 422 no campo série; UNIQUE numa corrida → 409', async () => {
        st.serieRe = serie({ ultimoNumero: 999 });
        expect((await erros(svc.create(dto()))).serieId).toMatch(/limite/);
        dataSource.transaction.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
        await expect(svc.create(dto())).rejects.toBeInstanceOf(ConflictException);
        dataSource.transaction.mockRejectedValueOnce(new Error('outro'));
        await expect(svc.create(dto())).rejects.toThrow('outro');
    });

    it('findAll filtra por cliente; findOne 404', async () => {
        const [l] = await svc.findAll({ clienteId: '3' });
        expect(repo.find.mock.calls[0][0].where).toEqual({ clienteId: 3 });
        expect(l).toMatchObject({ numeroDocumento: 'RE 2026/1', total: 50000, contaCodigo: 'CXAOA' });
        await svc.findAll();
        expect(repo.find.mock.calls[1][0].where).toBeUndefined();
        repo.findOne.mockResolvedValueOnce(null);
        await expect(svc.findOne(1)).rejects.toBeInstanceOf(NotFoundException);
    });
});
