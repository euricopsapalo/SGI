import { NotFoundException } from '@nestjs/common';
import { historicoPendente, ImpressaoPendentesService, MAX_LINHAS_IMPRESSAO } from './impressao-pendentes.service';

/** #175 — impressão de pendentes (o SQL valida-se contra BD real no e2e). */
describe('historicoPendente', () => {
    it('liquidações abatem (com desconto), o estorno repõe e a NC abate no máximo o que havia', () => {
        const h = historicoPendente(1000, [
            { tipo: 'LIQUIDACAO', numeroDocumento: 'RE 1', data: '2026-01-02', valor: 300, desconto: 20 },
            { tipo: 'ESTORNO_LIQUIDACAO', numeroDocumento: 'ERE 1', data: '2026-01-03', valor: 300, desconto: 20 },
            { tipo: 'LIQUIDACAO', numeroDocumento: 'RE 2', data: '2026-01-04', valor: 900, desconto: 0 },
            { tipo: 'NOTA_CREDITO', numeroDocumento: 'NC 1', data: '2026-01-05', valor: 500, desconto: 0 },
        ]);
        expect(h.map((e) => [e.efeito, e.pendenteApos])).toEqual([[-320, 680], [320, 1000], [-900, 100], [-100, 0]]);
    });

    it('sem eventos → vazio', () => {
        expect(historicoPendente(10, [])).toEqual([]);
    });
});

describe('ImpressaoPendentesService', () => {
    let ds: any; let cc: any; let svc: ImpressaoPendentesService;
    beforeEach(() => {
        ds = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('FROM configuracao_empresa') && sql.includes('logo_url')) return [{ logoUrl: 'L', rodapeDocumentos: null }];
                if (sql.includes('FROM configuracao_empresa')) return [{ nome: 'AQUATEX' }];
                if (sql.includes('FROM movimentos_cc m LEFT JOIN')) return [{ id: 7, clienteId: 3, origemTipo: 'DOCUMENTO_VENDA', origemId: 50,
                    valorOriginal: 1140, valorPendente: 340, dataDocumento: '2026-01-10', dataVencimento: '2026-02-09', modoPagamento: 'Transferência' }];
                if (sql.includes('FROM documentos_venda d') && sql.includes('d.id = $1')) return [{ id: 50, codigo: 'FT', descricao: 'Fatura', serie: '2026', numero: 3,
                    moeda: 'AOA', dataHora: '2026-01-10T10:00:00Z', subtotal: 1000, desconto: 0, valorIva: 140, total: 1140,
                    snapshotCliente: { id: 3, nome: 'Alfa' }, otNumero: 'OT-1', nrSerie: 'SN1' }];
                if (sql.includes('FROM documentos_venda_linhas')) return [{ descricao: 'Filtro', quantidade: 1, precoUnitario: 1000, desconto: 0, codigoIva: 'NOR', taxaIva: 14, totalLiquido: 1000 }];
                if (sql.includes('FROM liquidacoes_linhas')) return [{ codigo: 'RE', serie: '2026', numero: 9, dataHora: '2026-01-20T10:00:00Z',
                    processado: '2026-01-20T10:00:00Z', eEstorno: false, valor: 800, desconto: 0 }];
                if (sql.includes('documento_origem_id')) return [];
                return [];
            }),
        };
        cc = { pendentes: jest.fn(async () => ({ items: [{ movimentoCcId: 1 }], pagina: 1, porPagina: MAX_LINHAS_IMPRESSAO,
            totais: { documentos: 1, valorOriginal: 10, valorPendente: 10, vencido: 0 } })) };
        svc = new ImpressaoPendentesService(ds, cc);
    });

    it('lista: todas as páginas do filtro, com empresa e utilizador', async () => {
        const r = await svc.lista({ clienteId: 3, pagina: 4, porPagina: 50, ordem: 'cliente' }, 'Sofia');
        expect(cc.pendentes).toHaveBeenCalledWith({ clienteId: 3, pagina: 1, porPagina: MAX_LINHAS_IMPRESSAO, ordem: 'cliente' });
        expect(r).toMatchObject({ utilizador: 'Sofia', truncado: false, empresa: { nome: 'AQUATEX', logoUrl: 'L' } });
        expect(r.items).toHaveLength(1);
    });

    it('detalhe: documento, OT, linhas, liquidado/pendente e histórico', async () => {
        const r = await svc.detalhe(7);
        expect(r.documento).toMatchObject({ numeroDocumento: 'FT 2026/3', otNumero: 'OT-1', nrSerieEquipamento: 'SN1', dataVencimento: '2026-02-09' });
        expect(r.cliente).toEqual({ id: 3, nome: 'Alfa' });
        expect(r.linhas).toHaveLength(1);
        expect(r).toMatchObject({ valorOriginal: 1140, valorLiquidado: 800, valorPendente: 340 });
        expect(r.historico).toEqual([expect.objectContaining({ tipo: 'LIQUIDACAO', numeroDocumento: 'RE 2026/9', efeito: -800, pendenteApos: 340 })]);
    });

    it('detalhe de movimento inexistente → 404', async () => {
        ds.query.mockImplementation(async () => []);
        await expect(svc.detalhe(99)).rejects.toBeInstanceOf(NotFoundException);
    });
});
