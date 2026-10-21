import { buildFaturaHtml, buildReciboHtml, fmtNum } from './impressao';
import type { FaturaImpressao } from '../../services/vendas';
import type { ReciboImpressao } from '../../services/tesouraria';

/** #178 — a fatura e o recibo impressos contêm todos os blocos dos modelos de referência. */

const empresa = {
    nome: 'FÉNIX TEC, LDA', nif: '5000464015', morada: 'Luanda-Angola', telefone: '+244 938773523', fax: '222 000 000',
    email: 'geral@fenix.ao', website: null, capitalSocial: '100 000,00', conservatoriaRegisto: 'Luanda', matricula: '123/45',
    logoUrl: 'data:image/png;base64,AAA', rodapeDocumentos: 'Obrigado pela preferência',
};
const cliente = {
    id: 3, nome: 'AQUATEX <Comércio>', nif: '5000221627', telefone: null, email: null,
    morada: 'Rua Maria José Antunes, 66', localidade: 'Luanda', codigoPostal: '0000', municipio: 'Maianga', provincia: 'Luanda',
    condicaoPagamento: 'Fim do Mês',
};

const fatura: FaturaImpressao = {
    via: 'Original', empresa, cliente,
    coordenadasBancarias: [{ banco: 'BAI', numero: '001167698.10.001', iban: 'AO06.0070.0000.0116.7698.1013.2' }],
    documento: {
        descricao: 'Fatura', codigo: 'FT', tipoFiscal: 'FT', numeroDocumento: 'FT 2026/15', dataHora: '2026-09-07T10:00:00Z',
        data: '2026-09-07', dataVencimento: '2026-09-30', condicaoPagamento: 'Fim do Mês', modoPagamento: 'Transferência',
        requisicao: 'REQ-1', moeda: 'AOA', descontoCliente: 0, referencia: 'OT-000007 · N.º série SN-9', otNumero: 'OT-000007',
        nrSerieEquipamento: 'SN-9', dataDisposicao: '2026-09-07', observacoes: null,
    },
    linhas: [
        { artigoCodigo: 'S001', descricao: 'PRESTAÇÃO DE SERVIÇOS INFORMÁTICOS', quantidade: 1, unidade: 'UN', precoUnitario: 70000, desconto: 0, codigoIva: '90', taxaIva: 0, valor: 70000 },
        { artigoCodigo: 'S002', descricao: 'SUPORTE ERP', quantidade: 1, unidade: 'UN', precoUnitario: 36951.87, desconto: 0, codigoIva: '90', taxaIva: 0, valor: 36951.87 },
    ],
    totais: { mercadoriaServicos: 106951.87, descontosComerciais: 0, valorIva: 0, total: 106951.87, valorPendente: 106951.87 },
    impostos: [{ codigoIva: '90', taxa: 0, incidencia: 106951.87, valor: 0, motivoIsencao: 'Transmissão de bens e serviço não sujeita' }],
    retencao: null,
    codigoHash: 'X8Fj',
};

describe('impressão — Fatura', () => {
    const html = buildFaturaHtml(fatura);

    it('cabeçalho: empresa com identificação legal, cliente e documento/via', () => {
        for (const t of ['FÉNIX TEC, LDA', 'Contribuinte N.º: 5000464015', 'Fax. 222 000 000', 'Capital Social 100 000,00',
            'Cons. Reg. Com. Luanda', 'Matrícula N.º 123/45', 'Exmo.(s) Sr.(s)', 'Rua Maria José Antunes, 66', '0000 Luanda',
            'Fatura FT 2026/15', 'Original', 'src="data:image/png;base64,AAA"']) {
            expect(html).toContain(t);
        }
    });

    it('dados do documento e linhas com código, unidade e IVA', () => {
        for (const t of ['V/N.º Contrib.', '5000221627', 'REQ-1', 'AOA', '2026-09-07', 'Vencimento', '2026-09-30', 'Fim do Mês',
            'OT-000007 · N.º série SN-9', 'S001', 'PRESTAÇÃO DE SERVIÇOS INFORMÁTICOS', '36 951,87', '(90) 0,00']) {
            expect(html).toContain(t);
        }
    });

    it('quadros de impostos (com motivo de isenção) e de retenção, totais e coordenadas bancárias', () => {
        for (const t of ['Resumo de Impostos', 'IVA (0,00) (90)', '106 951,87', 'Motivo Isenção: Transmissão de bens e serviço não sujeita',
            'Retenção na Fonte', 'Mercadoria/Serviços', 'Descontos Comerciais', 'Total ( AOA )', 'Coordenadas Bancárias',
            'Nº Conta: 001167698.10.001', 'IBAN: AO06.0070.0000.0116.7698.1013.2']) {
            expect(html).toContain(t);
        }
        expect(html).not.toMatch(/Câmbio|USD|Portes|Carga|Descarga/);
    });

    it('valor por extenso e rodapé com o código do hash', () => {
        expect(html).toContain('VALOR POR EXTENSO: Cento e seis mil, novecentos e cinquenta e um Kwanzas e oitenta e sete Cêntimos.');
        expect(html).toContain('X8Fj-Documento processado por computador | Os bens e/ou serviços foram colocados à disposição na data 2026-09-07 / © SGI /');
        expect(html).toContain('Obrigado pela preferência');
        expect(html).toContain('size: A4 portrait');
    });

    it('o tipo fiscal não se repete quando é igual ao código do documento', () => {
        expect(html).not.toContain('FT FT 2026/15');
    });

    it('escapa texto (sem HTML injectado) e mostra a Segunda via', () => {
        expect(html).toContain('AQUATEX &lt;Comércio&gt;');
        expect(buildFaturaHtml({ ...fatura, via: 'Segunda via', codigoHash: null })).toContain('Segunda via');
        expect(buildFaturaHtml({ ...fatura, codigoHash: null })).toContain('>\n        Documento processado por computador');
    });

    it('#186 — blocos com cabeçalhos sugestivos, pela ordem do documento', () => {
        const seccoes = [...html.matchAll(/<h2 class="seccao">([^<]+)<\/h2>/g)].map((m) => m[1]);
        expect(seccoes).toEqual(['Dados do Documento', 'Artigos e Serviços', 'Resumo de Impostos', 'Retenção na Fonte',
            'Totais', 'Coordenadas Bancárias', 'Observações']);
    });

    it('#186 — a OT de origem tem campo próprio e não se repete na Referência', () => {
        expect(html).toContain('<th>Ordem de Trabalho</th>');
        expect(html).toContain('<td class="ot">OT-000007 · N.º série SN-9</td>');
        expect(html.match(/OT-000007/g)).toHaveLength(1);
        // a referência gerada a partir da OT (mesmo texto) não se duplica; a manual mantém-se
        const auto = buildFaturaHtml({ ...fatura, documento: { ...fatura.documento, referencia: 'OT-000007 · N.º série SN-9' } });
        expect(auto.match(/OT-000007/g)).toHaveLength(1);
        const manual = buildFaturaHtml({ ...fatura, documento: { ...fatura.documento, referencia: 'Contrato 2026/4' } });
        expect(manual).toContain('<td>Contrato 2026/4</td>');
        expect(manual).toContain('<td class="ot">OT-000007 · N.º série SN-9</td>');
    });

    it('#186 — fatura sem OT não mostra o campo Ordem de Trabalho', () => {
        const semOt = buildFaturaHtml({ ...fatura, documento: { ...fatura.documento, otNumero: null, nrSerieEquipamento: null, referencia: 'Venda balcão' } });
        expect(semOt).not.toContain('Ordem de Trabalho');
        expect(semOt).not.toContain('class="ot"');
        expect(semOt).toContain('<td>Venda balcão</td>');
    });

    it('quadro de retenção preenchido quando existir (#179)', () => {
        const r = buildFaturaHtml({ ...fatura, retencao: { entidade: 'Retenção Clientes - Lei 19/14', incidencia: 106951.87, percentagem: 6.5, valor: 6951.87 } });
        expect(r).toContain('Retenção Clientes - Lei 19/14');
        expect(r).toContain('6,50');
        expect(r).toContain('6 951,87');
        // o que o cliente paga: total − retenção
        expect(r).toContain('Retenção na Fonte</td><td class="num">-6 951,87');
        expect(r).toContain('Total a Pagar ( AOA )');
    });

    it('sem retenção não há linha "Total a Pagar" (#179)', () => {
        expect(buildFaturaHtml(fatura)).not.toContain('Total a Pagar');
    });

    it('#170 — NC: documento de origem e motivo de cada linha', () => {
        const nc = buildFaturaHtml({
            ...fatura,
            documento: { ...fatura.documento, codigo: 'NC', descricao: 'Nota de Crédito', documentoOrigem: { numeroDocumento: 'FT 2026/7', data: '2026-01-05' } },
            linhas: fatura.linhas.map((l, i) => ({ ...l, motivoEstorno: i === 0 ? 'Devolução <parcial>' : null })),
        });
        expect(nc).toContain('<th>Doc. Origem</th>');
        expect(nc).toContain('FT 2026/7 de 2026-01-05');
        expect(nc).toContain('Motivo: Devolução &lt;parcial&gt;');
        expect(nc.match(/Motivo: /g)).toHaveLength(1);
        expect(html).not.toContain('Doc. Origem');
    });

    it('#170 — FR: recibo da liquidação automática e conta', () => {
        const fr = buildFaturaHtml({ ...fatura, documento: { ...fatura.documento, liquidacao: { numeroDocumento: 'RE 2026/4', conta: 'Caixa Sede' } } });
        expect(fr).toContain('Pago — RE 2026/4 · Caixa Sede');
        expect(html).not.toContain('class="pago"');
    });
});

const recibo: ReciboImpressao = {
    via: 'Original', empresa, cliente,
    documento: { descricao: 'Recebimento', codigo: 'RE', tipoFiscal: 'RG', numeroDocumento: 'RE 2026/19', dataHora: '2026-09-26T10:00:00Z', data: '2026-09-26', moeda: 'AOA', observacoes: null },
    total: 2841.3,
    meios: [{ movimento: 'TCHQ', descricao: 'Transferência de Cheques', numero: 'CH-1', balcao: 'BAI — Maianga', valor: 2841.3 }],
    documentos: [
        { numeroDocumento: 'FT 2026/6', prestacao: 1, valorDocumento: 2902.8, valorAtribuido: 2902.8, desconto: 0, retencao: 0, pendente: 0 },
        { numeroDocumento: 'NC 2026/2', prestacao: 1, valorDocumento: -61.5, valorAtribuido: -61.5, desconto: 0, retencao: 0, pendente: 0 },
    ],
    totais: { valorDocumento: 2841.3, valorAtribuido: 2841.3, desconto: 0, retencao: 0, pendente: 0 },
};

describe('impressão — Recibo', () => {
    const html = buildReciboHtml(recibo);

    it('contém todos os blocos do modelo', () => {
        for (const t of ['Exmo.(s) Sr.(s)', 'Recebimento RG RE 2026/19', 'Original', 'V/N.º Contribuinte', 'Data Doc.', 'Moeda',
            'Através do(s) seguinte(s) meio(s), no valor total de <strong>2 841,30</strong>',
            'DOIS MIL, OITOCENTOS E QUARENTA E UM KWANZAS E TRINTA CÊNTIMOS',
            'Movimento', 'Número', 'Balcão', 'TCHQ', 'CH-1', 'Transferência de Cheques', 'BAI — Maianga',
            'Para pagamento do(s) seguinte(s) documento(s):', 'Prt.', 'Valor Documento', 'Valor Atribuído', 'Retenção', 'Pendente',
            'FT 2026/6', '2 902,80', 'NC 2026/2', '-61,50', 'Total Recebido (AOA)', 'Respeitosos Cumprimentos,',
            'Documento processado por computador / © SGI']) {
            expect(html).toContain(t);
        }
    });
});

/** #180 — os dois documentos em folha A4 centrada no ecrã e A4 na impressão. */
describe('impressão — folha A4', () => {
    it.each([
        ['Fatura', buildFaturaHtml(fatura)],
        ['Recibo', buildReciboHtml(recibo)],
    ])('%s: @page A4 vertical, folha de 210 × 297 mm centrada no ecrã e sem margens duplicadas na impressão', (_n, html) => {
        expect(html).toMatch(/@page \{\s*size: A4 portrait;\s*margin: 14mm 12mm 14mm;/);
        // regra uniforme: paginação no canto superior direito e restantes cantos vazios
        expect(html).toContain('@top-left { content: ""; }');
        expect(html).toContain('@bottom-right { content: ""; }');
        expect(html).not.toContain('A5');
        expect(html).toMatch(/<body><main class="folha">[\s\S]*<\/main><\/body><\/html>$/);
        expect(html).toMatch(/@media screen \{[\s\S]*\.folha \{[\s\S]*width: 210mm; min-height: 297mm; margin: 0 auto;/);
        expect(html).toMatch(/@media print \{[\s\S]*\.folha \{ width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; \}/);
        expect(html).toContain('counter(page) "/" counter(pages)');
    });
});

it('fmtNum: espaço nos milhares, vírgula decimal, negativos', () => {
    expect(fmtNum(106951.87)).toBe('106 951,87');
    expect(fmtNum(0)).toBe('0,00');
    expect(fmtNum(-61.5)).toBe('-61,50');
    expect(fmtNum(1234567.891)).toBe('1 234 567,89');
});
