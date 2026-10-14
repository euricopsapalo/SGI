import { buildListaPendentesHtml, buildPendenteHtml, resumoFiltros } from './impressaoPendentes';
import type { ListaPendentesImpressao, Pendente, PendenteImpressao } from '../../services/tesouraria';

/** #175 — impressão da lista de pendentes e do detalhe de um pendente. */
const empresa = {
    nome: 'AQUATEX', nif: '500', morada: 'Luanda', telefone: null, fax: null, email: null, website: null,
    capitalSocial: null, conservatoriaRegisto: null, matricula: null, logoUrl: null, rodapeDocumentos: 'Rodapé',
};

const pendente = (p: Partial<Pendente>): Pendente => ({
    movimentoCcId: 1, natureza: 'D', documentoVendaId: 1, numeroDocumento: 'FT 2026/1',
    dataDocumento: '2026-01-10', dataVencimento: '2026-02-09', dataIntroducao: '2026-01-10', diasAtraso: 0,
    clienteId: 1, clienteNome: 'Alfa', clienteNif: '111', otId: 1, otNumero: 'OT-000001',
    valorOriginal: 1140, valorPendente: 1140, ccTipoId: 1, ccEstadoId: 1, estadoCodigo: null,
    modoPagamentoId: null, modoPagamentoDescricao: null, ...p,
});

const lista: ListaPendentesImpressao = {
    empresa, geradoEm: '2026-03-01T10:00:00Z', utilizador: 'Sofia Vendas', truncado: false,
    items: [
        pendente({}),
        pendente({ movimentoCcId: 2, numeroDocumento: 'FT 2026/2', diasAtraso: 12, valorPendente: 500 }),
        pendente({ movimentoCcId: 3, numeroDocumento: 'FT 2026/3', clienteId: 2, clienteNome: 'Beta <SA>', clienteNif: null, valorOriginal: 200, valorPendente: 200 }),
    ],
    totais: { documentos: 3, valorOriginal: 2480, valorPendente: 1840, vencido: 500 },
};

describe('resumoFiltros', () => {
    it('sem filtros', () => {
        expect(resumoFiltros({})).toEqual(['Sem filtros']);
    });
    it('descreve os filtros aplicados, com o nome do cliente e o tipo de data', () => {
        expect(resumoFiltros({ documento: 'FT', ot: '12', clienteId: 4, dataTipo: 'vencimento', de: '2026-01-01', ate: '2026-01-31', vencidosAte: '2026-02-01' }, 'Alfa'))
            .toEqual(['N.º documento: FT', 'N.º OT: 12', 'Cliente: Alfa', 'Vencimento: de 2026-01-01 até 2026-01-31', 'Só vencidos até 2026-02-01']);
    });
});

describe('buildListaPendentesHtml', () => {
    it('cabeçalho, filtros, colunas, todas as linhas e totais iguais aos do ecrã', () => {
        const html = buildListaPendentesHtml(lista, {});
        expect(html).toContain('Lista de Pendentes');
        expect(html).toContain('AQUATEX');
        expect(html).toContain('Impresso por: Sofia Vendas');
        expect(html).toContain('<span>Sem filtros</span>');
        ['Documento', 'Vencimento', 'Dias atraso', 'Cliente', 'NIF', 'OT', 'Valor original', 'Valor pendente'].forEach((c) => expect(html).toContain(`${c}</th>`));
        expect(html.match(/FT 2026\/\d/g)).toHaveLength(3);
        expect(html).toContain('<td class="num atraso">12</td>');
        expect(html).toContain('1 840,00');
        expect(html).toContain('Σ Vencido</td><td class="num">500,00');
        expect(html).toContain('Beta &lt;SA&gt;');
        expect(html).not.toContain('Subtotal');
    });

    it('com filtro de cliente, agrupa e subtotaliza por cliente', () => {
        const html = buildListaPendentesHtml(lista, { cliente: 'a' });
        expect(html).toContain('Cliente contém: a');
        expect(html).toContain('Subtotal Alfa (2 doc.)');
        expect(html).toContain('<td class="num">1 640,00</td>');
        expect(html).toContain('Subtotal Beta &lt;SA&gt; (1 doc.)');
    });

    it('avisa quando a lista foi limitada', () => {
        expect(buildListaPendentesHtml({ ...lista, truncado: true, totais: { ...lista.totais, documentos: 9000 } }, {}))
            .toContain('limitada a 3 de 9000 documentos');
    });
});

describe('buildPendenteHtml', () => {
    const d: PendenteImpressao = {
        empresa, geradoEm: '2026-03-01T10:00:00Z',
        cliente: { id: 1, nome: 'Alfa', nif: '111', telefone: null, email: null, morada: 'Rua 1', localidade: null, codigoPostal: null, municipio: null, provincia: null, condicaoPagamento: null },
        documento: { codigo: 'FT', descricao: 'Fatura', numeroDocumento: 'FT 2026/1', data: '2026-01-10', dataVencimento: '2026-02-09',
            moeda: 'AOA', modoPagamento: 'Transferência', otNumero: 'OT-000001', nrSerieEquipamento: 'SN1' },
        linhas: [{ descricao: 'Filtro', quantidade: 2, precoUnitario: 500, desconto: 0, codigoIva: 'NOR', taxaIva: 14, totalLiquido: 1000 }],
        totais: { subtotal: 1000, desconto: 0, valorIva: 140, total: 1140 },
        valorOriginal: 1140, valorLiquidado: 800, valorPendente: 340,
        historico: [
            { tipo: 'LIQUIDACAO', numeroDocumento: 'RE 2026/9', data: '2026-01-20', valor: 800, desconto: 0, efeito: -800, pendenteApos: 340 },
        ],
    };

    it('documento de origem, OT, linhas, liquidado, pendente e histórico', () => {
        const html = buildPendenteHtml(d);
        expect(html).toContain('Pendente — Fatura FT 2026/1');
        expect(html).toContain('OT-000001 · N.º série SN1');
        expect(html).toContain('<td>Filtro</td>');
        expect(html).toContain('Valor já liquidado</td><td class="num">800,00');
        expect(html).toContain('Valor pendente (AOA)</td><td class="num">340,00');
        expect(html).toContain('Histórico de Liquidações e Estornos');
        expect(html).toContain('<td>Liquidação</td><td>RE 2026/9</td>');
        expect(html).toContain('Alfa');
    });

    it('sem histórico nem OT, não mostra esses blocos', () => {
        const html = buildPendenteHtml({ ...d, historico: [], documento: { ...d.documento, otNumero: null } });
        expect(html).not.toContain('Histórico');
        expect(html).not.toContain('Ordem de Trabalho');
    });
});
