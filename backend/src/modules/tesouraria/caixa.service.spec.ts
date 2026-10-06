import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CaixaService, sessaoCaixaAberta } from './caixa.service';
import { SessaoCaixa } from './sessao-caixa.entity';
import { MovimentoConta, OrigemMovimentoConta } from './movimento-conta.entity';
import { ContaBancaria } from '../vendas-config/conta-bancaria.entity';
import { DocumentoConfig } from '../vendas-config/documento-config.entity';
import { Serie } from '../vendas-config/serie.entity';
import { anoLocal } from '../vendas-config/series.rules';

/**
 * #167 — CaixaService: abertura, saída e fecho com apuramento e acerto.
 * O e2e contra BD real cobre o mesmo fluxo com os bloqueios verdadeiros
 * (test/tesouraria-liquidacoes.e2e.spec.ts).
 */
describe('CaixaService', () => {
    let svc: CaixaService;
    let repo: any; let mcRepo: any; let contaRepo: any; let sysLogs: any; let dataSource: any; let m: any;
    let st: any;
    const ano = anoLocal(new Date());
    const abertaEm = new Date(Date.now() - 3600_000);

    const doc = (id: number, codigo: string, tipoCodigo: string, over: any = {}) =>
        ({ id, codigo, descricao: codigo, tipoCodigo, ativo: true, contas: [{ id: 7 }], ...over });
    const serie = (id: number, documentoConfigId: number, over: any = {}) => ({
        id, documentoConfigId, codigo: String(ano), ano, limiteInferior: 0, limiteSuperior: 999,
        ultimoNumero: null, ultimaDataHora: null, porDefeito: true, sugereDataSistema: true, ativo: true, ...over,
    });
    const erros = async (p: Promise<unknown>) => {
        try { await p; } catch (e) {
            expect(e).toBeInstanceOf(UnprocessableEntityException);
            return ((e as UnprocessableEntityException).getResponse() as any).errors;
        }
        throw new Error('esperava 422');
    };
    const saved = (entity: any) => m.save.mock.calls.filter((c: any[]) => c[0] === entity).map((c: any[]) => c[1]);

    beforeEach(() => {
        st = {
            conta: { id: 7, codigo: 'CXAOA', tipo: 'CAIXA', aberta: false, ativo: true },
            docs: [
                doc(40, 'ABC', 'ABERTURA_CAIXA'), doc(41, 'SDC', 'SAIDA_CAIXA'),
                doc(42, 'FCC', 'FECHO_CAIXA', { acertoSobraDocId: 43, acertoQuebraDocId: 44 }),
            ],
            acertos: { 43: doc(43, 'ACS', 'MOV_CONTA'), 44: doc(44, 'ACQ', 'MOV_CONTA') } as Record<number, any>,
            series: { 40: serie(400, 40), 41: serie(410, 41), 42: serie(420, 42), 43: serie(430, 43), 44: serie(440, 44) } as Record<number, any>,
            sessaoAberta: null as any,
            ultimoFecho: null as any,
            valores: [] as any[],
        };
        repo = {
            find: jest.fn(async () => [{ id: 1, contaBancariaId: 7, valorSugerido: '0', valorDeclarado: '1000', valorContado: '1200', saldoTeorico: '1200', fechadaEm: new Date(), aberturaNumero: 1, aberturaSerie: { codigo: '2026', documentoConfig: { codigo: 'ABC' } } }]),
            findOne: jest.fn(async (opts: any) => {
                if (opts.where.id) return { id: opts.where.id, contaBancariaId: 7, valorSugerido: '0', valorDeclarado: '1000', valorContado: null, saldoTeorico: null, fechadaEm: null, abertaEm, aberturaNumero: 1, aberturaSerie: { codigo: '2026', documentoConfig: { codigo: 'ABC' } } };
                return opts.where.fechadaEm?._type === 'isNull' ? st.sessaoAberta : st.ultimoFecho;
            }),
        };
        mcRepo = { find: jest.fn(async () => []) };
        contaRepo = {
            find: jest.fn(async () => [st.conta]),
            findOne: jest.fn(async () => st.conta),
        };
        sysLogs = { create: jest.fn() };
        m = {
            findOne: jest.fn(async (entity: any, opts: any) => {
                if (entity === ContaBancaria) return st.conta;
                if (entity === SessaoCaixa) return opts.where.fechadaEm?._type === 'isNull' ? st.sessaoAberta : st.ultimoFecho;
                if (entity === Serie) return st.series[opts.where.documentoConfigId];
                if (entity === DocumentoConfig) return st.acertos[opts.where.id] ?? null;
                return null;
            }),
            find: jest.fn(async (entity: any, opts: any) => {
                if (entity === DocumentoConfig) {
                    return opts.where.id ? st.docs.filter((d: any) => d.id === opts.where.id) : st.docs.filter((d: any) => d.tipoCodigo === opts.where.tipoCodigo && d.ativo);
                }
                if (entity === MovimentoConta) return st.valores.map((v: any, i: number) => ({ id: i + 1, valor: v }));
                return [];
            }),
            create: jest.fn((_e: any, o: any) => ({ ...o })),
            save: jest.fn(async (e: any, o: any) => (e === SessaoCaixa ? { id: 9, ...o } : e === MovimentoConta ? { id: 77, ...o } : o)),
            update: jest.fn(),
        };
        dataSource = {
            transaction: jest.fn(async (cb: any) => cb(m)),
            query: jest.fn(async () => []),
        };
        svc = new CaixaService(repo, mcRepo, contaRepo, sysLogs, dataSource);
    });

    const abrirSessao = (over: any = {}) => {
        st.conta.aberta = true;
        st.sessaoAberta = { id: 9, contaBancariaId: 7, valorDeclarado: '1000.00', abertaEm, ...over };
    };

    describe('sessaoCaixaAberta', () => {
        it('conta DO → null; caixa fechada ou sem sessão → 422; caixa aberta → sessão', async () => {
            expect(await sessaoCaixaAberta(m, { tipo: 'DO' } as any, 'c', 'x')).toBeNull();
            expect((await erros(sessaoCaixaAberta(m, st.conta, 'c', 'fechada'))).c).toBe('fechada');
            st.conta.aberta = true;
            expect((await erros(sessaoCaixaAberta(m, st.conta, 'c', 'fechada'))).c).toBe('fechada');
            abrirSessao();
            expect(await sessaoCaixaAberta(m, st.conta, 'c', 'x')).toMatchObject({ id: 9 });
        });
    });

    describe('abrir', () => {
        it('sugere o contado no fecho anterior, regista sugerido e declarado, numera o ABC e marca a caixa aberta', async () => {
            st.ultimoFecho = { id: 3, valorContado: '1200.00', fechadaEm: new Date(Date.now() - 7200_000) };
            await svc.abrir(7, { valorDeclarado: 1150, observacoes: ' troco ' }, { id: 5, email: 'u@x' });
            const s = saved(SessaoCaixa)[0];
            expect(s).toMatchObject({
                contaBancariaId: 7, aberturaSerieId: 400, aberturaNumero: 1, abertaPorId: 5,
                valorSugerido: 1200, valorDeclarado: 1150, observacoesAbertura: 'troco',
            });
            expect(m.update).toHaveBeenCalledWith(Serie, 400, expect.objectContaining({ ultimoNumero: 1 }));
            expect(m.update).toHaveBeenCalledWith(ContaBancaria, 7, { aberta: true });
            expect(m.findOne.mock.calls[0]).toEqual([ContaBancaria, expect.objectContaining({ lock: { mode: 'pessimistic_write' } })]);
            expect(sysLogs.create).toHaveBeenCalledWith(expect.objectContaining({ acao: 'CAIXA_ABERTA', detalhes: expect.stringContaining('sugerido 1200') }));
        });

        it('caixa já aberta, inactiva, ou conta que não é caixa → 422; conta inexistente → 404', async () => {
            st.conta.aberta = true;
            expect((await erros(svc.abrir(7, { valorDeclarado: 0 }))).contaBancariaId).toMatch(/já está aberta/);
            st.conta = { ...st.conta, aberta: false, ativo: false };
            expect((await erros(svc.abrir(7, { valorDeclarado: 0 }))).contaBancariaId).toMatch(/inactiva/);
            st.conta = { ...st.conta, tipo: 'DO' };
            expect((await erros(svc.abrir(7, { valorDeclarado: 0 }))).contaBancariaId).toMatch(/não é uma caixa/);
            st.conta = null;
            await expect(svc.abrir(7, { valorDeclarado: 0 })).rejects.toBeInstanceOf(NotFoundException);
            expect(m.save).not.toHaveBeenCalled();
        });

        it('abertura anterior ao último fecho → 422', async () => {
            st.ultimoFecho = { id: 3, valorContado: '0', fechadaEm: new Date(Date.now() + 3600_000) };
            expect((await erros(svc.abrir(7, { valorDeclarado: 0 }))).dataHora).toMatch(/posterior ao último fecho/);
        });

        it('documento: sem ABC associado à caixa, indicado de outro tipo, inactivo ou não associado → 422', async () => {
            st.docs[0].contas = [];
            expect((await erros(svc.abrir(7, { valorDeclarado: 0 }))).documentoConfigId).toMatch(/Não há nenhum documento de abertura de caixa/);
            expect((await erros(svc.abrir(7, { valorDeclarado: 0, documentoConfigId: 40 }))).documentoConfigId).toMatch(/não está associada/);
            expect((await erros(svc.abrir(7, { valorDeclarado: 0, documentoConfigId: 41 }))).documentoConfigId).toMatch(/não é de abertura/);
            expect((await erros(svc.abrir(7, { valorDeclarado: 0, documentoConfigId: 99 }))).documentoConfigId).toMatch(/não existe/);
            st.docs[0] = { ...st.docs[0], ativo: false, contas: [{ id: 7 }] };
            expect((await erros(svc.abrir(7, { valorDeclarado: 0, documentoConfigId: 40 }))).documentoConfigId).toMatch(/inactivo/);
        });

        it('série sem data obrigatória → 422; corrida no índice único → 409', async () => {
            st.series[40] = serie(400, 40, { sugereDataSistema: false });
            expect((await erros(svc.abrir(7, { valorDeclarado: 0 }))).dataHora).toMatch(/exige/);
            dataSource.transaction.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
            await expect(svc.abrir(7, { valorDeclarado: 0 })).rejects.toBeInstanceOf(ConflictException);
            dataSource.transaction.mockRejectedValueOnce(new Error('outro'));
            await expect(svc.abrir(7, { valorDeclarado: 0 })).rejects.toThrow('outro');
        });
    });

    describe('saida', () => {
        it('exige a caixa aberta', async () => {
            expect((await erros(svc.saida(7, { valor: 10, motivo: 'Compra' }))).contaBancariaId).toMatch(/está fechada/);
        });

        it('gera um movimento SDC negativo na sessão, com o motivo, sem exceder o saldo teórico', async () => {
            abrirSessao();
            st.valores = ['50000.00', '-1000.00'];
            await svc.saida(7, { valor: 2500, motivo: ' Combustível ' }, { id: 5, email: 'u@x' });
            const mc = saved(MovimentoConta)[0];
            expect(mc).toMatchObject({
                documentoConfigId: 41, serieId: 410, numero: 1, contaBancariaId: 7, sessaoCaixaId: 9,
                origemTipo: OrigemMovimentoConta.SAIDA_CAIXA, origemId: 9, valor: -2500, descricao: 'Combustível',
            });
            expect(m.update).toHaveBeenCalledWith(Serie, 410, expect.objectContaining({ ultimoNumero: 1 }));
            expect(sysLogs.create).toHaveBeenCalledWith(expect.objectContaining({ acao: 'CAIXA_SAIDA' }));

            m.save.mockClear();
            expect((await erros(svc.saida(7, { valor: 50000.01, motivo: 'Demais' }))).valor).toMatch(/excede o saldo da caixa \(50000\)/);
            expect(m.save).not.toHaveBeenCalled();
        });

        it('data-hora anterior à abertura → 422', async () => {
            abrirSessao();
            const antes = new Date(abertaEm.getTime() - 1000).toISOString();
            expect((await erros(svc.saida(7, { valor: 1, motivo: 'Compra', dataHora: antes }))).dataHora).toMatch(/posterior à abertura/);
        });
    });

    describe('fechar', () => {
        it('exige a caixa aberta', async () => {
            expect((await erros(svc.fechar(7, { valorContado: 0 }))).contaBancariaId).toMatch(/já está fechada/);
        });

        it('sem diferença: fecha sem acerto e marca a caixa fechada', async () => {
            abrirSessao();
            st.valores = ['50000.00', '-2500.00'];
            await svc.fechar(7, { valorContado: 48500, observacoes: 'ok' }, { id: 5, email: 'u@x' });
            expect(saved(MovimentoConta)).toHaveLength(0);
            expect(m.update).toHaveBeenCalledWith(SessaoCaixa, 9, expect.objectContaining({
                fechoSerieId: 420, fechoNumero: 1, fechadaPorId: 5, saldoTeorico: 48500, valorContado: 48500,
                documentoAcertoId: null, observacoesFecho: 'ok',
            }));
            expect(m.update).toHaveBeenCalledWith(ContaBancaria, 7, { aberta: false });
            expect(sysLogs.create).toHaveBeenCalledWith(expect.objectContaining({ acao: 'CAIXA_FECHADA', detalhes: expect.stringContaining('sem diferença') }));
        });

        it('sobra → acerto ACS positivo; quebra → acerto ACQ negativo; ligados à sessão', async () => {
            abrirSessao();
            st.valores = ['50000.00'];
            await svc.fechar(7, { valorContado: 51200 });
            let mc = saved(MovimentoConta)[0];
            expect(mc).toMatchObject({ documentoConfigId: 43, serieId: 430, valor: 200, origemTipo: OrigemMovimentoConta.ACERTO_CAIXA, origemId: 9, sessaoCaixaId: 9 });
            expect(mc.descricao).toMatch(/Acerto de sobra no fecho FCC/);
            expect(m.update).toHaveBeenCalledWith(SessaoCaixa, 9, expect.objectContaining({ saldoTeorico: 51000, valorContado: 51200, documentoAcertoId: 77 }));
            expect(m.update).toHaveBeenCalledWith(Serie, 430, expect.objectContaining({ ultimoNumero: 1 }));

            m.save.mockClear();
            await svc.fechar(7, { valorContado: 50000 });
            mc = saved(MovimentoConta)[0];
            expect(mc).toMatchObject({ documentoConfigId: 44, valor: -1000 });
            expect(sysLogs.create).toHaveBeenLastCalledWith(expect.objectContaining({ detalhes: expect.stringContaining('quebra 1000') }));
        });

        it('acerto não configurado ou inactivo → 422 e a caixa não fecha', async () => {
            abrirSessao();
            st.docs[2].acertoQuebraDocId = null;
            expect((await erros(svc.fechar(7, { valorContado: 500 }))).valorContado).toMatch(/quebra de 500.*não está configurado/);
            st.acertos[43] = { ...st.acertos[43], ativo: false };
            expect((await erros(svc.fechar(7, { valorContado: 1500 }))).valorContado).toMatch(/sobra de 500/);
            expect(m.update).not.toHaveBeenCalledWith(ContaBancaria, 7, { aberta: false });
        });
    });

    describe('leitura', () => {
        it('listar: estado de cada caixa com o valor sugerido e a sessão aberta', async () => {
            st.sessaoAberta = { id: 9, contaBancariaId: 7, valorSugerido: '0', valorDeclarado: '1000', valorContado: null, fechadaEm: null, abertaEm, aberturaNumero: 2, aberturaSerie: { codigo: '2026', documentoConfig: { codigo: 'ABC' } } };
            st.ultimoFecho = { id: 3, contaBancariaId: 7, valorSugerido: '0', valorDeclarado: '0', valorContado: '1200', saldoTeorico: '1000', fechadaEm: new Date(), aberturaNumero: 1, fechoNumero: 1, fechoSerie: { codigo: '2026', documentoConfig: { codigo: 'FCC' } }, documentoAcerto: { numero: 1, valor: '200', documentoConfig: { codigo: 'ACS' }, serie: { codigo: '2026' } } };
            mcRepo.find.mockResolvedValueOnce([{ id: 1, sessaoCaixaId: 9, valor: '500.00' }, { id: 2, sessaoCaixaId: 9, valor: '-100.00' }]);
            const [c] = await svc.listar();
            expect(c.valorSugerido).toBe(1200);
            expect(c.sessao).toMatchObject({ estado: 'ABERTA', aberturaDocumento: 'ABC 2026/2', entradas: 500, saidas: 100, saldoTeorico: 1400, valorContado: null, diferenca: null });
            expect(c.ultimoFecho).toMatchObject({ estado: 'FECHADA', fechoDocumento: 'FCC 2026/1', saldoTeorico: 1000, valorContado: 1200, diferenca: 200, acertoDocumento: 'ACS 2026/1', acertoValor: 200 });
        });

        it('sessão: movimentos com o documento de origem; acerto fora do saldo teórico; 404', async () => {
            mcRepo.find.mockResolvedValueOnce([
                { id: 1, origemTipo: 'LIQUIDACAO', origemId: 5, valor: '500.00', numero: 1, documentoConfig: { codigo: 'MC' }, serie: { codigo: '2026' }, modoPagamento: { descricao: 'Numerário' } },
                { id: 2, origemTipo: 'SAIDA_CAIXA', origemId: 9, valor: '-100.00', numero: 1, descricao: 'Compra', documentoConfig: { codigo: 'SDC' }, serie: { codigo: '2026' } },
                { id: 3, origemTipo: 'ACERTO_CAIXA', origemId: 9, valor: '50.00', numero: 1, documentoConfig: { codigo: 'ACS' }, serie: { codigo: '2026' } },
            ]);
            dataSource.query.mockResolvedValueOnce([{ id: 5, numeroDocumento: 'RE 2026/4', clienteNome: 'Cliente' }]);
            const s = await svc.sessao(9);
            expect(s).toMatchObject({ entradas: 500, saidas: 100, saldoTeorico: 1400 });
            expect(s.movimentos.map((x: any) => [x.numeroDocumento, x.origemDocumento, x.descricao, x.valor])).toEqual([
                ['MC 2026/1', 'RE 2026/4', 'Cliente', 500],
                ['SDC 2026/1', null, 'Compra', -100],
                ['ACS 2026/1', null, null, 50],
            ]);
            repo.findOne.mockResolvedValueOnce(null);
            await expect(svc.sessao(1)).rejects.toBeInstanceOf(NotFoundException);
        });

        it('findOne: caixa inexistente ou conta DO → 404; histórico de sessões', async () => {
            const c = await svc.findOne(7);
            expect(c.sessao).toBeNull();
            st.conta = { ...st.conta, tipo: 'DO' };
            await expect(svc.findOne(7)).rejects.toBeInstanceOf(NotFoundException);
            const [h] = await svc.sessoes(7);
            expect(h).toMatchObject({ estado: 'FECHADA', valorContado: 1200, diferenca: 0 });
        });
    });
});
