import { buildRelatorioComprasHtml, RelatorioComprasDados } from './relatorioComprasHtml';
import { comPaginacao } from '../../utils/impressaoPagina';

/** #217 — o relatório de Compras sai em HTML para o PDF do servidor (imprimirPdf). */
const dados = (extra: Partial<RelatorioComprasDados> = {}): RelatorioComprasDados => ({
    empresa: { nome: 'AQUATEX', nif: '5000', morada: 'Luanda' },
    geradoEm: '21/10/2026 10:00',
    kpis: { emAberto: 2, emAtraso: 1, hoje: 0, semana: 3 },
    porEstado: [{ label: 'Aberta', count: 1 }, { label: 'Parcial', count: 1 }, { label: 'Recebida', count: 2 }],
    ultimos7Dias: [{ label: 'seg, 20/10', count: 2 }],
    emAberto: [
        { numero: 'N-000001', fornecedor: 'Forn <A&B>', data: '01/10/2026', entrega: '10/10/2026', estado: 'Aberta', valor: '1 000,00 Kz', pctRecebido: 0, atrasada: true },
    ],
    emAtraso: [
        { numero: 'N-000001', fornecedor: 'Forn <A&B>', entrega: '10/10/2026', diasAtraso: 11, estado: 'Aberta', valor: '1 000,00 Kz' },
    ],
    ...extra,
});

describe('buildRelatorioComprasHtml (#217)', () => {
    it('tem título, indicadores, estados (com %) e as duas tabelas', () => {
        const html = buildRelatorioComprasHtml(dados());
        expect(html).toContain('<title>Relatório de Compras</title>');
        expect(html).toContain('<span>Em atraso</span><strong>1</strong>');
        expect(html).toContain('<td>Recebida</td><td class="n">2</td><td class="n">50%</td>');
        expect(html).toContain('N-000001');
        expect(html).toContain('+11d');
        expect(html).toContain('(atrasada)');
    });

    it('escapa os textos vindos dos dados', () => {
        const html = buildRelatorioComprasHtml(dados());
        expect(html).toContain('Forn &lt;A&amp;B&gt;');
        expect(html).not.toContain('Forn <A&B>');
    });

    it('sem encomendas mostra as mensagens de vazio', () => {
        const html = buildRelatorioComprasHtml(dados({ emAberto: [], emAtraso: [] }));
        expect(html).toContain('Sem encomendas em aberto.');
        expect(html).toContain('Nenhuma encomenda em atraso.');
    });

    it('não usa window.print() e aceita a regra de página com "Pág. x/y" (#180)', () => {
        const html = buildRelatorioComprasHtml(dados());
        expect(html).not.toMatch(/window\.print/);
        expect(comPaginacao(html)).toMatch(/counter\(page\)/);
    });
});
