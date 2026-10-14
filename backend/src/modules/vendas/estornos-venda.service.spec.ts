import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { EstornosVendaService } from './estornos-venda.service';
import { DocumentoVenda, DocumentoVendaLinha } from './documento-venda.entity';
import { MovimentoCc } from './movimento-cc.entity';
import { DocumentoConfig } from '../vendas-config/documento-config.entity';
import { MotivoEstorno } from '../vendas-config/motivo-estorno.entity';
import { Serie } from '../vendas-config/serie.entity';
import { OrdemTrabalho } from '../ordens-trabalho/ordem-trabalho.entity';
import { anoLocal } from '../vendas-config/series.rules';

/**
 * #169 — EstornosVendaService: NC/ND linha a linha, abate do pendente de origem,
 * saldo a favor, libertação da OT na NC total e reposição na ND. O e2e contra BD
 * real cobre o passo 7 do v11 §7.4 (test/vendas-estorno.e2e.spec.ts).
 */
describe('EstornosVendaService', () => {
    let svc: EstornosVendaService;
    let m: any; let documentos: any; let sysLogs: any; let dataSource: any;
    let st: any;
    const ano = anoLocal(new Date());

    const configs: Record<number, any> = {
        4: { id: 4, codigo: 'FT', tipoCodigo: 'FINANCEIRO', natureza: 'A_RECEBER', ativo: true, estorno: true, estornoDocId: 5, estornoSerieId: 50 },
        5: { id: 5, codigo: 'NC', tipoCodigo: 'FINANCEIRO', natureza: 'A_PAGAR', ativo: true, estorno: true, estornoDocId: 6, estornoSerieId: 60,
            geraMovCc: true, ccTipoId: 1, ccEstadoId: 1, liquidacaoAutomatica: false },
        6: { id: 6, codigo: 'ND', tipoCodigo: 'FINANCEIRO', natureza: 'A_RECEBER', ativo: true, estorno: false,
            geraMovCc: true, ccTipoId: 1, ccEstadoId: 1, liquidacaoAutomatica: false },
    };
    const serie = (id: number, documentoConfigId: number) => ({
        id, documentoConfigId, codigo: String(ano), ano, limiteInferior: 0, limiteSuperior: 999,
        ultimoNumero: null, ultimaDataHora: null, porDefeito: true, sugereDataSistema: true, ativo: true,
    });
    const erros = async (p: Promise<unknown>) => {
        try { await p; } catch (e) {
            expect(e).toBeInstanceOf(UnprocessableEntityException);
            return ((e as UnprocessableEntityException).getResponse() as any).errors;
        }
        throw new Error('esperava 422');
    };
    const pedido = (linhas: any[] = [{ linhaId: 1, quantidade: 1, motivoEstornoId: 10 }]) => ({ linhas });
    const salvo = () => m.save.mock.calls.find((c: any[]) => c[0] === DocumentoVenda)?.[1];
    const movSalvo = () => m.save.mock.calls.find((c: any[]) => c[0] === MovimentoCc)?.[1];

    beforeEach(() => {
        st = {
            origem: {
                id: 50, estado: 'EMITIDO', documentoConfigId: 4, serieId: 40, numero: 1, dataHora: new Date(Date.now() - 60_000),
                clienteId: 3, otId: 7, documentoOrigemId: null, descontoGlobal: '0', modoPagamentoId: 2, moeda: 'AOA',
                referencia: 'OT-000007', requisicao: null, dataDisposicao: '2026-01-01',
            },
            linhas: [
                { id: 1, documentoId: 50, otArtigoId: 11, artigoId: 101, descricao: 'Filtro', quantidade: '2.000', qtdEstornada: '0',
                    precoUnitario: '30000.00', desconto: '0', codigoIva: null, taxaIva: '14.00', ordem: 1, linhaOrigemId: null },
                { id: 2, documentoId: 50, otArtigoId: 12, artigoId: 102, descricao: 'Membrana', quantidade: '1.000', qtdEstornada: '0',
                    precoUnitario: '40000.00', desconto: '0', codigoIva: null, taxaIva: '14.00', ordem: 2, linhaOrigemId: null },
            ],
            linhasOriginais: [],
            original: null,
            mov: { id: 70, natureza: 'D', valorOriginal: '114000.00', valorPendente: '114000.00' },
            ot: { id: 7, numero: 'OT-000007', documentoVendaId: 50 },
        };
        m = {
            findOne: jest.fn(async (entity: any, opts: any) => {
                const w = opts?.where ?? {};
                if (entity === DocumentoVenda) {
                    if (w.numero) return null;
                    if (w.id === st.origem.id) return st.origem;
                    return st.original;
                }
                if (entity === DocumentoConfig) return configs[w.id] ?? null;
                if (entity === Serie) return w.id === 40 ? serie(40, 4) : w.id === 50 ? serie(50, 5) : w.id === 60 ? serie(60, 6) : null;
                if (entity === OrdemTrabalho) return st.ot;
                if (entity === MovimentoCc) return st.mov;
                return null;
            }),
            find: jest.fn(async (entity: any, opts: any) => {
                if (entity === DocumentoVendaLinha) return opts.where.documentoId ? st.linhas : st.linhasOriginais;
                if (entity === MotivoEstorno) return [{ id: 10 }];
                return [];
            }),
            create: jest.fn((_e: any, o: any) => ({ ...o })),
            save: jest.fn(async (e: any, o: any) => (e === DocumentoVenda ? { id: 60, ...o } : o)),
            update: jest.fn(),
            query: jest.fn(async (sql: string) => (sql.includes('FROM clientes') ? [{ id: 3, nome: 'Cliente' }] : [{ nome: 'AQUATEX' }])),
        };
        documentos = { findOne: jest.fn(async (id: number) => ({ id })) };
        sysLogs = { create: jest.fn() };
        dataSource = { transaction: jest.fn(async (cb: any) => cb(m)) };
        svc = new EstornosVendaService(documentos, sysLogs, dataSource);
    });

    it('passo 7 — NC de 1 unidade: 34 200, abate o pendente para 79 800, acumula qtd_estornada e não liberta a OT', async () => {
        await svc.estornar(50, pedido(), { id: 9, email: 'u@x' });
        const nc = salvo();
        expect(nc).toMatchObject({
            documentoConfigId: 5, serieId: 50, numero: 1, estado: 'EMITIDO', documentoOrigemId: 50, otId: 7, clienteId: 3,
            subtotal: 30000, valorIva: 4200, total: 34200, emitidoPorId: 9,
        });
        expect(nc.referencia).toBe(`Estorno de FT ${ano}/1 · OT-000007`);
        expect(nc.linhas).toEqual([expect.objectContaining({ linhaOrigemId: 1, motivoEstornoId: 10, quantidade: 1, totalLiquido: 30000 })]);
        expect(m.update).toHaveBeenCalledWith(DocumentoVendaLinha, 1, { qtdEstornada: 1 });
        expect(m.update).toHaveBeenCalledWith(MovimentoCc, 70, { valorPendente: 79800 });
        expect(movSalvo()).toMatchObject({ natureza: 'C', origemId: 60, valorOriginal: 34200, valorPendente: 0 });
        expect(m.update).not.toHaveBeenCalledWith(OrdemTrabalho, expect.anything(), expect.anything());
        expect(m.update).toHaveBeenCalledWith(Serie, 50, expect.objectContaining({ ultimoNumero: 1 }));
        expect(sysLogs.create).toHaveBeenCalledWith(expect.objectContaining({ acao: 'VENDA_ESTORNADA' }));
        expect(documentos.findOne).toHaveBeenCalledWith(60);
    });

    it('NC total → a OT fica sem documento activo (volta a estar disponível)', async () => {
        await svc.estornar(50, pedido([
            { linhaId: 1, quantidade: 2, motivoEstornoId: 10 },
            { linhaId: 2, quantidade: 1, motivoEstornoId: 10 },
        ]));
        expect(salvo().total).toBe(114000);
        expect(m.update).toHaveBeenCalledWith(MovimentoCc, 70, { valorPendente: 0 });
        expect(m.update).toHaveBeenCalledWith(OrdemTrabalho, 7, { documentoVendaId: null });
    });

    it('fatura já paga → o crédito fica pendente na NC (saldo a favor do cliente)', async () => {
        st.mov.valorPendente = '0.00';
        await svc.estornar(50, pedido());
        expect(m.update).not.toHaveBeenCalledWith(MovimentoCc, expect.anything(), expect.anything());
        expect(movSalvo()).toMatchObject({ natureza: 'C', valorOriginal: 34200, valorPendente: 34200 });
    });

    it('estorno acima do faturado → 422 por linha, sem gravar nada', async () => {
        const e = await erros(svc.estornar(50, pedido([{ linhaId: 1, quantidade: 3, motivoEstornoId: 10 }])));
        expect(e['linhas.0.quantidade']).toMatch(/excede/);
        expect(m.save).not.toHaveBeenCalled();
    });

    it('rascunho → 409; inexistente → 404; sem estorno configurado → 422', async () => {
        st.origem.estado = 'RASCUNHO';
        await expect(svc.estornar(50, pedido())).rejects.toBeInstanceOf(ConflictException);
        await expect(svc.estornar(99, pedido())).rejects.toBeInstanceOf(NotFoundException);
        st.origem.estado = 'EMITIDO';
        st.origem.documentoConfigId = 6; // ND não admite estorno
        expect((await erros(svc.estornar(50, pedido()))).documentoConfigId).toMatch(/não admite estorno/);
    });

    it('documento de estorno com a mesma natureza → 422', async () => {
        const nc = configs[5];
        configs[5] = { ...nc, natureza: 'A_RECEBER' };
        try {
            expect((await erros(svc.estornar(50, pedido()))).documentoConfigId).toMatch(/natureza inversa/);
        } finally { configs[5] = nc; }
    });

    it('data-hora anterior ao documento estornado → 422', async () => {
        const e = await erros(svc.estornar(50, { ...pedido(), dataHora: new Date(Date.now() - 3_600_000).toISOString() }));
        expect(e.dataHora).toMatch(/anterior ao documento estornado/);
    });

    it('violação do CHECK em corrida → 409', async () => {
        m.update.mockImplementationOnce(async () => { throw Object.assign(new Error('check'), { code: '23514' }); });
        await expect(svc.estornar(50, pedido())).rejects.toBeInstanceOf(ConflictException);
    });

    describe('ND sobre NC (estorno de estorno)', () => {
        beforeEach(() => {
            st.origem = { ...st.origem, id: 60, documentoConfigId: 5, serieId: 50, documentoOrigemId: 50 };
            st.linhas = [{ ...st.linhas[0], id: 21, documentoId: 60, quantidade: '1.000', linhaOrigemId: 1 }];
            st.linhasOriginais = [{ id: 1, qtdEstornada: '2.000' }];
            st.original = { id: 50, otId: 7, documentoOrigemId: null };
            st.mov = { id: 71, natureza: 'C', valorOriginal: '34200.00', valorPendente: '34200.00' };
            st.ot = { id: 7, numero: 'OT-000007', documentoVendaId: null };
            m.findOne.mockImplementation(async (entity: any, opts: any) => {
                const w = opts?.where ?? {};
                if (entity === DocumentoVenda) return w.numero ? null : w.id === 60 ? st.origem : st.original;
                if (entity === DocumentoConfig) return configs[w.id] ?? null;
                if (entity === Serie) return w.id === 50 ? serie(50, 5) : w.id === 60 ? serie(60, 6) : null;
                if (entity === OrdemTrabalho) return st.ot;
                if (entity === MovimentoCc) return st.mov;
                return null;
            });
        });

        it('devolve as quantidades à fatura original, abate o crédito da NC e religa a OT', async () => {
            await svc.estornar(60, pedido([{ linhaId: 21, quantidade: 1, motivoEstornoId: 10 }]));
            expect(salvo()).toMatchObject({ documentoConfigId: 6, serieId: 60, documentoOrigemId: 60, total: 34200 });
            expect(m.update).toHaveBeenCalledWith(DocumentoVendaLinha, 21, { qtdEstornada: 1 });
            expect(m.update).toHaveBeenCalledWith(DocumentoVendaLinha, 1, { qtdEstornada: 1 });
            expect(m.update).toHaveBeenCalledWith(MovimentoCc, 71, { valorPendente: 0 });
            expect(movSalvo()).toMatchObject({ natureza: 'D', valorOriginal: 34200, valorPendente: 0 });
            expect(m.update).toHaveBeenCalledWith(OrdemTrabalho, 7, { documentoVendaId: 50 });
        });

        it('OT entretanto faturada noutro documento → 409', async () => {
            st.ot.documentoVendaId = 80;
            await expect(svc.estornar(60, pedido([{ linhaId: 21, quantidade: 1, motivoEstornoId: 10 }])))
                .rejects.toBeInstanceOf(ConflictException);
        });
    });
});
