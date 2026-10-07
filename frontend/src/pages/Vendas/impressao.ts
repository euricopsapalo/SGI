import type { ClienteImpressao, EmpresaImpressao, FaturaImpressao } from '../../services/vendas';
import type { ReciboImpressao } from '../../services/tesouraria';
import { valorPorExtenso } from '../../utils/valorPorExtenso';
import { cssPagina, MARGENS_PAGINA } from '../../utils/impressaoPagina';
import { imprimirPdf } from '../../utils/imprimirPdf';

/**
 * #178 — Impressão da Fatura e do Recibo (ambos em A4 — #180) com a informação dos modelos
 * de referência. Geradores de HTML puros (testados) + abertura da janela de
 * impressão, no mesmo padrão das restantes impressões do SGI.
 */

const esc = (v: unknown) => String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 106 951,87 — espaço nos milhares e vírgula decimal, como nos modelos. */
export const fmtNum = (v: number, casas = 2) => {
    const [int, dec] = Math.abs(Number(v) || 0).toFixed(casas).split('.');
    const milhares = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${Number(v) < 0 ? '-' : ''}${milhares}${casas ? `,${dec}` : ''}`;
};

/** Quantidade sem zeros inúteis: 1,00 · 2,5 → 2,50. */
const fmtQtd = (v: number) => fmtNum(v, 2);

const linhasOpcionais = (...linhas: (string | null | undefined | false)[]) =>
    linhas.filter(Boolean).map((l) => `<div>${l}</div>`).join('');

function blocoEmpresa(e: EmpresaImpressao) {
    return `
        ${e.logoUrl ? `<img class="logo" src="${esc(e.logoUrl)}" alt="">` : ''}
        <div class="empresa">
            <div class="empresa-nome">${esc(e.nome)}</div>
            ${linhasOpcionais(
                e.nif && `Contribuinte N.º: ${esc(e.nif)}`,
                e.morada && esc(e.morada),
                (e.telefone || e.fax) && `Telef. ${esc(e.telefone)}${e.fax ? ` &nbsp;Fax. ${esc(e.fax)}` : ''}`,
                e.email && esc(e.email),
                e.capitalSocial && `Capital Social ${esc(e.capitalSocial)}`,
                e.conservatoriaRegisto && `Cons. Reg. Com. ${esc(e.conservatoriaRegisto)}`,
                e.matricula && `Matrícula N.º ${esc(e.matricula)}`,
            )}
        </div>`;
}

function blocoCliente(c: ClienteImpressao | null) {
    if (!c) return '';
    const local = [c.codigoPostal, c.localidade].filter(Boolean).join(' ');
    const regiao = [c.municipio, c.provincia].filter(Boolean).join(' — ');
    return `
        <div class="cliente">
            <div class="exmo">Exmo.(s) Sr.(s)</div>
            <div class="cliente-nome">${esc(c.nome)}</div>
            ${linhasOpcionais(c.morada && esc(c.morada), local && esc(local), regiao && esc(regiao))}
        </div>`;
}

/**
 * Título como nos modelos: descrição + tipo fiscal + identificação ("Recibo RG RE 2026/19").
 * O tipo fiscal só aparece quando difere do código do documento (evita "Fatura FT FT 2026/15").
 */
function tituloDocumento(doc: { descricao: string; codigo: string; tipoFiscal: string | null; numeroDocumento: string | null }) {
    const fiscal = doc.tipoFiscal && doc.tipoFiscal !== doc.codigo ? ` ${esc(doc.tipoFiscal)}` : '';
    return `${esc(doc.descricao)}${fiscal} ${esc(doc.numeroDocumento)}`;
}

/**
 * #180 — folha A4 (210 × 297 mm) para os dois documentos.
 * - Ecrã: folha branca centrada, com as margens do documento e sombra, sobre fundo cinzento.
 * - Impressão/PDF: o `@page` define o A4 e as margens; a folha deixa de ter
 *   largura, padding, sombra e altura mínima próprios (senão as margens duplicavam
 *   e a altura mínima podia gerar uma página em branco no fim).
 */
const MARGENS = MARGENS_PAGINA;

const CSS_BASE = `
    ${cssPagina('A4 portrait')}
    * { box-sizing: border-box; }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; margin: 0; }
    @media screen {
        body { background: #e5e7eb; padding: 10mm 0; }
        .folha {
            width: 210mm; min-height: 297mm; margin: 0 auto;
            padding: ${MARGENS.cima}mm ${MARGENS.lados}mm ${MARGENS.baixo}mm;
            background: #fff; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
        }
    }
    @media print {
        body { background: none; padding: 0; }
        .folha { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
    }
    .resumo, .extenso, .rodape, .recebido, .quadro { break-inside: avoid; page-break-inside: avoid; }
    .topo { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .logo { max-height: 60px; max-width: 180px; display: block; margin-bottom: 6px; }
    .empresa-nome, .cliente-nome { font-weight: 700; }
    .exmo { font-size: 0.9em; color: #444; }
    .cliente { min-width: 45%; padding-top: 18px; }
    .titulo { display: flex; justify-content: space-between; align-items: baseline; margin: 14px 0 6px;
        border-bottom: 2px solid #111; padding-bottom: 4px; }
    .titulo h1 { font-size: 1.35em; margin: 0; }
    .via { font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-weight: 700; border-bottom: 1px solid #111; padding: 3px 4px; background: #f2f2f2; }
    td { padding: 3px 4px; vertical-align: top; }
    .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .dados td, .dados th { border: 1px solid #bbb; }
    .linhas tbody tr { border-bottom: 1px solid #e5e5e5; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    .quadro-titulo { font-weight: 700; margin: 10px 0 2px; }
    .seccao { font-size: 0.95em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
        margin: 12px 0 4px; padding: 3px 6px; background: #e8eef5; border-left: 3px solid #1f3a5f;
        break-after: avoid; page-break-after: avoid; }
    .extenso { margin-top: 10px; font-weight: 700; }
    .rodape { margin-top: 14px; font-size: 0.8em; color: #333; border-top: 1px solid #999; padding-top: 4px; }
`;

/* ══ Fatura (A4) ═══════════════════════════════════════════════
 * #186 — blocos agrupados por cabeçalhos (Dados do Documento · Artigos e Serviços ·
 * Resumo de Impostos · Retenção na Fonte · Totais · Coordenadas Bancárias · Observações)
 * e a OT de origem num campo próprio. */
export function buildFaturaHtml(d: FaturaImpressao): string {
    const doc = d.documento;
    // #186 — a OT de origem tem campo próprio; a "Referência" fica só com a referência manual
    // (a gerada a partir da OT tem o mesmo texto e repetia-se).
    const ordemTrabalho = doc.otNumero
        ? [doc.otNumero, doc.nrSerieEquipamento && `N.º série ${doc.nrSerieEquipamento}`].filter(Boolean).join(' · ')
        : '';
    const referencia = doc.referencia && doc.referencia !== ordemTrabalho ? doc.referencia : '';
    const moeda = doc.moeda;
    const retencao = d.retencao;

    const linhas = d.linhas.map((l) => `
        <tr>
            <td>${esc(l.artigoCodigo ?? '')}</td>
            <td>${esc(l.descricao)}</td>
            <td class="num">${fmtQtd(l.quantidade)}</td>
            <td>${esc(l.unidade)}</td>
            <td class="num">${fmtNum(l.precoUnitario)}</td>
            <td class="num">${fmtNum(l.desconto)}</td>
            <td class="num">${l.codigoIva ? `(${esc(l.codigoIva)}) ` : ''}${fmtNum(l.taxaIva)}</td>
            <td class="num">${fmtNum(l.valor)}</td>
        </tr>`).join('');

    const impostos = d.impostos.map((i) => `
        <tr>
            <td>IVA (${fmtNum(i.taxa)})${i.codigoIva ? ` (${esc(i.codigoIva)})` : ''}</td>
            <td class="num">${fmtNum(i.incidencia)}</td>
            <td class="num">${fmtNum(i.valor)}</td>
        </tr>
        ${i.motivoIsencao ? `<tr><td colspan="3" class="motivo">Motivo Isenção: ${esc(i.motivoIsencao)}</td></tr>` : ''}`).join('');

    const coordenadas = d.coordenadasBancarias.map((c) => linhasOpcionais(
        c.banco && `<strong>${esc(c.banco)}</strong>`,
        c.numero && `Nº Conta: ${esc(c.numero)}`,
        c.iban && `IBAN: ${esc(c.iban)}`,
    )).join('<div style="height:4px"></div>');

    const totalLinha = (label: string, v: number, forte = false) =>
        `<tr${forte ? ' class="total"' : ''}><td>${label}</td><td class="num">${fmtNum(v)}</td></tr>`;

    const hash = d.codigoHash ? `${esc(d.codigoHash)}-` : '';

    return `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
<title>${esc(doc.descricao)} ${esc(doc.numeroDocumento)}</title>
<style>
    ${CSS_BASE}
    .dados { margin-bottom: 8px; }
    .linhas { margin-top: 6px; }
    .resumo { display: flex; gap: 20px; margin-top: 12px; align-items: flex-start; }
    .resumo > div { flex: 1; }
    .totais td { padding: 2px 4px; }
    .totais .total td { font-weight: 800; font-size: 1.15em; border-top: 2px solid #111; }
    .motivo { font-size: 0.9em; color: #333; }
    .ot { font-weight: 700; white-space: nowrap; }
</style></head><body><main class="folha">
    <div class="topo">
        <div>${blocoEmpresa(d.empresa)}</div>
        ${blocoCliente(d.cliente)}
    </div>

    <div class="titulo">
        <h1>${tituloDocumento(doc)}</h1>
        <span class="via">${esc(d.via)}</span>
    </div>

    <h2 class="seccao">Dados do Documento</h2>
    <table class="dados">
        <thead><tr><th>V/N.º Contrib.</th><th>Requisição</th><th>Moeda</th><th>Data</th>${ordemTrabalho ? '<th>Ordem de Trabalho</th>' : ''}</tr></thead>
        <tbody><tr>
            <td>${esc(d.cliente?.nif ?? '')}</td><td>${esc(doc.requisicao ?? '')}</td><td>${esc(moeda)}</td><td>${esc(doc.data)}</td>
            ${ordemTrabalho ? `<td class="ot">${esc(ordemTrabalho)}</td>` : ''}
        </tr></tbody>
    </table>
    <table class="dados">
        <thead><tr><th>Desc. Cli.</th><th>Vencimento</th><th>Condição Pagamento</th><th>Modo Pagamento</th><th>Referência</th></tr></thead>
        <tbody><tr>
            <td class="num">${fmtNum(doc.descontoCliente)}</td><td>${esc(doc.dataVencimento ?? '')}</td>
            <td>${esc(doc.condicaoPagamento ?? '')}</td><td>${esc(doc.modoPagamento ?? '')}</td><td>${esc(referencia)}</td>
        </tr></tbody>
    </table>

    <h2 class="seccao">Artigos e Serviços</h2>
    <table class="linhas">
        <thead><tr>
            <th>Artigo</th><th>Descrição</th><th class="num">Qtd.</th><th>Un.</th>
            <th class="num">Pr. Unitário</th><th class="num">Desc.</th><th class="num">IVA</th><th class="num">Valor</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
    </table>

    <div class="resumo">
        <div>
            <h2 class="seccao">Resumo de Impostos</h2>
            <table><thead><tr><th>Taxa/Valor</th><th class="num">Incid./Qtd.</th><th class="num">Total</th></tr></thead>
                <tbody>${impostos}</tbody></table>
            <h2 class="seccao">Retenção na Fonte</h2>
            <table><thead><tr><th>Entidade</th><th class="num">Inc.</th><th class="num">%</th><th class="num">Valor</th></tr></thead>
                <tbody>${retencao
                    ? `<tr><td>${esc(retencao.entidade)}</td><td class="num">${fmtNum(retencao.incidencia)}</td><td class="num">${fmtNum(retencao.percentagem)}</td><td class="num">${fmtNum(retencao.valor)}</td></tr>`
                    : '<tr><td colspan="4">&nbsp;</td></tr>'}</tbody></table>
        </div>
        <div>
            <h2 class="seccao">Totais</h2>
            <table class="totais"><tbody>
                ${totalLinha('Mercadoria/Serviços', d.totais.mercadoriaServicos)}
                ${totalLinha('Descontos Comerciais', d.totais.descontosComerciais)}
                ${totalLinha('IVA', d.totais.valorIva)}
                ${totalLinha(`Total ( ${esc(moeda)} )`, d.totais.total, true)}
            </tbody></table>
        </div>
    </div>

    ${coordenadas ? `<h2 class="seccao">Coordenadas Bancárias</h2>${coordenadas}` : ''}

    <h2 class="seccao">Observações</h2>
    <div class="extenso">VALOR POR EXTENSO: ${esc(valorPorExtenso(d.totais.total))}.</div>
    ${doc.observacoes ? `<div style="margin-top:6px">${esc(doc.observacoes)}</div>` : ''}

    <div class="rodape">
        ${hash}Documento processado por computador | Os bens e/ou serviços foram colocados à disposição na data ${esc(doc.dataDisposicao ?? doc.data)} / © SGI /
        ${d.empresa.rodapeDocumentos ? `<div>${esc(d.empresa.rodapeDocumentos)}</div>` : ''}
    </div>
</main></body></html>`;
}

/* ══ Recibo (A4 — #180) ════════════════════════════════════════ */
export function buildReciboHtml(d: ReciboImpressao): string {
    const doc = d.documento;
    const moeda = doc.moeda;
    const meios = d.meios.map((m) => `
        <tr><td>${esc(m.movimento ?? '')}</td><td>${esc(m.numero ?? '')}</td><td>${esc(m.descricao ?? '')}</td>
            <td>${esc(m.balcao ?? '')}</td><td class="num">${fmtNum(m.valor)}</td></tr>`).join('');
    const docs = d.documentos.map((x) => `
        <tr><td>${esc(x.numeroDocumento)}</td><td class="num">${x.prestacao}</td><td class="num">${fmtNum(x.valorDocumento)}</td>
            <td class="num">${fmtNum(x.valorAtribuido)}</td><td class="num">${fmtNum(x.desconto)}</td>
            <td class="num">${fmtNum(x.retencao)}</td><td class="num">${fmtNum(x.pendente)}</td></tr>`).join('');
    const t = d.totais;

    return `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
<title>${esc(doc.descricao)} ${esc(doc.numeroDocumento)}</title>
<style>
    ${CSS_BASE}
    .bloco { margin-top: 10px; }
    .linha-total td { font-weight: 700; border-top: 1px solid #111; }
    .recebido { margin-top: 12px; font-size: 1.15em; font-weight: 800; text-align: right; }
</style></head><body><main class="folha">
    <div class="topo">
        <div>${blocoEmpresa(d.empresa)}</div>
        ${blocoCliente(d.cliente)}
    </div>

    <div class="titulo">
        <h1>${tituloDocumento(doc)}</h1>
        <span class="via">${esc(d.via)}</span>
    </div>

    <table class="dados">
        <thead><tr><th>V/N.º Contribuinte</th><th>Data Doc.</th><th>Moeda</th></tr></thead>
        <tbody><tr><td>${esc(d.cliente?.nif ?? '')}</td><td>${esc(doc.data)}</td><td>${esc(moeda)}</td></tr></tbody>
    </table>

    <div class="bloco">Através do(s) seguinte(s) meio(s), no valor total de <strong>${fmtNum(d.total)}</strong>
        (${esc(valorPorExtenso(d.total).toUpperCase())}).</div>
    <table class="bloco">
        <thead><tr><th>Movimento</th><th>Número</th><th>Descrição</th><th>Balcão</th><th class="num">Valor</th></tr></thead>
        <tbody>${meios}</tbody>
    </table>

    <div class="bloco">Para pagamento do(s) seguinte(s) documento(s):</div>
    <table class="bloco">
        <thead><tr><th>Doc.</th><th class="num">Prt.</th><th class="num">Valor Documento</th><th class="num">Valor Atribuído</th>
            <th class="num">Desconto</th><th class="num">Retenção</th><th class="num">Pendente</th></tr></thead>
        <tbody>${docs}
            <tr class="linha-total"><td colspan="2" class="num">Total</td><td class="num">${fmtNum(t.valorDocumento)}</td>
                <td class="num">${fmtNum(t.valorAtribuido)}</td><td class="num">${fmtNum(t.desconto)}</td>
                <td class="num">${fmtNum(t.retencao)}</td><td class="num">${fmtNum(t.pendente)}</td></tr>
        </tbody>
    </table>

    <div class="recebido">Total Recebido (${esc(moeda)}) &nbsp; ${fmtNum(d.total)}</div>
    ${doc.observacoes ? `<div class="bloco">Observações: ${esc(doc.observacoes)}</div>` : ''}

    <div class="bloco" style="margin-top:24px">Respeitosos Cumprimentos,</div>
    <div class="rodape">
        Documento processado por computador / © SGI
        ${d.empresa.rodapeDocumentos ? `<div>${esc(d.empresa.rodapeDocumentos)}</div>` : ''}
    </div>
</main></body></html>`;
}

/**
 * #182 — Imprime como PDF gerado no servidor. A janela abre **antes** do pedido à
 * API (senão o bloqueador de pop-ups trava-a); o ficheiro chama-se como o título
 * do documento (ex.: `Fatura FT 2026-1.pdf`). Nunca rejeita.
 */
export const imprimirDocumento = (obterHtml: () => Promise<string>): Promise<boolean> => imprimirPdf(obterHtml);
