import type { ListaPendentesImpressao, Pendente, PendenteImpressao, PendentesFiltros } from '../../services/tesouraria';
import { blocoCliente, blocoEmpresa, CSS_BASE, esc, fmtNum } from './impressao';

/**
 * #175 — Impressão da lista de pendentes (tal como está filtrada, todas as
 * páginas) e do detalhe de um pendente. A4, com os dados da empresa, no mesmo
 * padrão da Fatura e do Recibo (PDF gerado no servidor — #182).
 */

const fmtDataHora = (iso: string) => new Date(iso).toLocaleString('pt-PT');

const ORDENS: Record<string, string> = {
    'dataDocumento:asc': 'mais antigos primeiro', 'dataDocumento:desc': 'mais recentes primeiro',
    'dataVencimento:asc': 'vencimento', 'valorPendente:desc': 'maior pendente', 'cliente:asc': 'cliente',
};

/** Resumo legível dos filtros aplicados ("Sem filtros" quando não há nenhum). */
export function resumoFiltros(f: PendentesFiltros, nomeCliente?: string | null): string[] {
    const tipoData = f.dataTipo === 'vencimento' ? 'Vencimento' : 'Data do documento';
    const r = [
        f.documento && `N.º documento: ${f.documento}`,
        f.ot && `N.º OT: ${f.ot}`,
        f.clienteId && `Cliente: ${nomeCliente ?? `#${f.clienteId}`}`,
        f.cliente && `Cliente contém: ${f.cliente}`,
        (f.de || f.ate) && `${tipoData}: ${f.de ? `de ${f.de}` : ''}${f.de && f.ate ? ' ' : ''}${f.ate ? `até ${f.ate}` : ''}`,
        f.vencidosAte && `Só vencidos até ${f.vencidosAte}`,
    ].filter(Boolean) as string[];
    return r.length ? r : ['Sem filtros'];
}

const CSS_PENDENTES = `
    .meta { display: flex; justify-content: space-between; gap: 12px; font-size: 0.9em; color: #333; margin-bottom: 6px; }
    .filtros { margin: 4px 0 8px; font-size: 0.9em; }
    .filtros span { display: inline-block; margin-right: 12px; }
    .lista { font-size: 0.92em; }
    .lista td, .lista th { padding: 2px 3px; }
    .lista tbody tr { border-bottom: 1px solid #e5e5e5; }
    .atraso { color: #b91c1c; font-weight: 700; }
    .subtotal td { font-weight: 700; background: #f7f7f7; border-top: 1px solid #999; }
    .grupo td { font-weight: 700; padding-top: 8px; }
    .totais-lista { margin-top: 10px; width: 60%; margin-left: auto; }
    .totais-lista td { padding: 2px 4px; }
    .totais-lista .total td { font-weight: 800; border-top: 2px solid #111; }
    .valores td { font-size: 1.05em; }
    .valores .pendente td { font-weight: 800; font-size: 1.15em; border-top: 2px solid #111; }
`;

const linhaPendente = (p: Pendente) => `
    <tr>
        <td>${esc(p.numeroDocumento ?? `#${p.movimentoCcId}`)}</td>
        <td>${esc(p.dataDocumento)}</td>
        <td>${esc(p.dataVencimento)}</td>
        <td class="num${p.diasAtraso > 0 ? ' atraso' : ''}">${p.diasAtraso > 0 ? p.diasAtraso : ''}</td>
        <td>${esc(p.clienteNome)}</td>
        <td>${esc(p.clienteNif ?? '')}</td>
        <td>${esc(p.otNumero ?? '')}</td>
        <td class="num">${fmtNum(p.valorOriginal)}</td>
        <td class="num">${fmtNum(p.valorPendente)}</td>
    </tr>`;

const soma = (ps: Pendente[], k: 'valorOriginal' | 'valorPendente') =>
    Math.round(ps.reduce((s, p) => s + Number(p[k]), 0) * 100) / 100;

/** Lista de pendentes filtrada. Com filtro de cliente, agrupa e subtotaliza por cliente. */
export function buildListaPendentesHtml(d: ListaPendentesImpressao, filtros: PendentesFiltros, nomeCliente?: string | null): string {
    const agrupar = !!(filtros.clienteId || filtros.cliente);
    let corpo: string;
    if (agrupar) {
        const grupos = new Map<number, Pendente[]>();
        d.items.forEach((p) => grupos.set(p.clienteId, [...(grupos.get(p.clienteId) ?? []), p]));
        corpo = [...grupos.values()].map((ps) => `
            <tr class="grupo"><td colspan="9">${esc(ps[0].clienteNome)}${ps[0].clienteNif ? ` — NIF ${esc(ps[0].clienteNif)}` : ''}</td></tr>
            ${ps.map(linhaPendente).join('')}
            <tr class="subtotal"><td colspan="7">Subtotal ${esc(ps[0].clienteNome)} (${ps.length} doc.)</td>
                <td class="num">${fmtNum(soma(ps, 'valorOriginal'))}</td><td class="num">${fmtNum(soma(ps, 'valorPendente'))}</td></tr>`).join('');
    } else {
        corpo = d.items.map(linhaPendente).join('');
    }
    const t = d.totais;

    return `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
<title>Lista de Pendentes ${esc(d.geradoEm.slice(0, 10))}</title>
<style>${CSS_BASE}${CSS_PENDENTES}</style></head><body><main class="folha">
    <div class="topo"><div>${blocoEmpresa(d.empresa)}</div></div>
    <div class="titulo"><h1>Lista de Pendentes</h1><span>${esc(fmtDataHora(d.geradoEm))}</span></div>
    <div class="meta"><span>Impresso por: ${esc(d.utilizador ?? '—')}</span>
        <span>Ordenação: ${esc(ORDENS[`${filtros.ordem ?? 'dataDocumento'}:${filtros.direcao ?? 'asc'}`] ?? '')}</span></div>

    <h2 class="seccao">Filtros aplicados</h2>
    <div class="filtros">${resumoFiltros(filtros, nomeCliente).map((x) => `<span>${esc(x)}</span>`).join('')}</div>
    ${d.truncado ? `<div class="atraso">Atenção: a lista foi limitada a ${d.items.length} de ${t.documentos} documentos — refine os filtros.</div>` : ''}

    <table class="lista">
        <thead><tr>
            <th>Documento</th><th>Data</th><th>Vencimento</th><th class="num">Dias atraso</th><th>Cliente</th><th>NIF</th><th>OT</th>
            <th class="num">Valor original</th><th class="num">Valor pendente</th>
        </tr></thead>
        <tbody>${corpo || '<tr><td colspan="9">Nenhum pendente corresponde aos filtros.</td></tr>'}</tbody>
    </table>

    <table class="totais-lista resumo"><tbody>
        <tr><td>N.º de documentos</td><td class="num">${t.documentos}</td></tr>
        <tr><td>Σ Valor original</td><td class="num">${fmtNum(t.valorOriginal)}</td></tr>
        <tr><td>Σ Vencido</td><td class="num">${fmtNum(t.vencido)}</td></tr>
        <tr class="total"><td>Σ Valor pendente (AOA)</td><td class="num">${fmtNum(t.valorPendente)}</td></tr>
    </tbody></table>

    <div class="rodape">Documento processado por computador — não é documento fiscal / © SGI
        ${d.empresa.rodapeDocumentos ? `<div>${esc(d.empresa.rodapeDocumentos)}</div>` : ''}</div>
</main></body></html>`;
}

const ROTULO_EVENTO: Record<PendenteImpressao['historico'][number]['tipo'], string> = {
    LIQUIDACAO: 'Liquidação',
    ESTORNO_LIQUIDACAO: 'Estorno de liquidação',
    NOTA_CREDITO: 'Nota de Crédito',
};

/** Detalhe de um pendente: documento de origem, OT, linhas, liquidado, pendente e histórico. */
export function buildPendenteHtml(d: PendenteImpressao): string {
    const doc = d.documento;
    const ot = doc.otNumero ? [doc.otNumero, doc.nrSerieEquipamento && `N.º série ${doc.nrSerieEquipamento}`].filter(Boolean).join(' · ') : '';
    const linhas = d.linhas.map((l) => `
        <tr><td>${esc(l.descricao)}</td><td class="num">${fmtNum(l.quantidade)}</td><td class="num">${fmtNum(l.precoUnitario)}</td>
            <td class="num">${fmtNum(l.desconto)}</td><td class="num">${l.codigoIva ? `(${esc(l.codigoIva)}) ` : ''}${fmtNum(l.taxaIva)}</td>
            <td class="num">${fmtNum(l.totalLiquido)}</td></tr>`).join('');
    const historico = d.historico.map((h) => `
        <tr><td>${esc(h.data)}</td><td>${esc(ROTULO_EVENTO[h.tipo])}</td><td>${esc(h.numeroDocumento ?? '')}</td>
            <td class="num">${fmtNum(h.valor)}</td><td class="num">${h.desconto ? fmtNum(h.desconto) : ''}</td>
            <td class="num">${fmtNum(h.efeito)}</td><td class="num">${fmtNum(h.pendenteApos)}</td></tr>`).join('');

    return `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8">
<title>Pendente ${esc(doc.numeroDocumento)}</title>
<style>${CSS_BASE}${CSS_PENDENTES}</style></head><body><main class="folha">
    <div class="topo"><div>${blocoEmpresa(d.empresa)}</div>${blocoCliente(d.cliente)}</div>
    <div class="titulo"><h1>Pendente — ${esc(doc.descricao)} ${esc(doc.numeroDocumento)}</h1><span>${esc(fmtDataHora(d.geradoEm))}</span></div>

    <h2 class="seccao">Documento de Origem</h2>
    <table class="dados">
        <thead><tr><th>Documento</th><th>Data</th><th>Vencimento</th><th>V/N.º Contrib.</th><th>Modo Pagamento</th>${ot ? '<th>Ordem de Trabalho</th>' : ''}</tr></thead>
        <tbody><tr><td>${esc(doc.numeroDocumento)}</td><td>${esc(doc.data)}</td><td>${esc(doc.dataVencimento)}</td>
            <td>${esc(d.cliente?.nif ?? '')}</td><td>${esc(doc.modoPagamento ?? '')}</td>${ot ? `<td class="ot">${esc(ot)}</td>` : ''}</tr></tbody>
    </table>

    ${d.linhas.length ? `
    <h2 class="seccao">Linhas do Documento</h2>
    <table class="linhas">
        <thead><tr><th>Descrição</th><th class="num">Qtd.</th><th class="num">Preço</th><th class="num">Desc. %</th><th class="num">IVA %</th><th class="num">Total</th></tr></thead>
        <tbody>${linhas}</tbody>
    </table>` : ''}

    <div class="resumo" style="display:flex; justify-content:flex-end; margin-top:12px">
        <table class="totais-lista valores"><tbody>
            ${d.totais ? `<tr><td>IVA</td><td class="num">${fmtNum(d.totais.valorIva)}</td></tr>` : ''}
            <tr><td>Valor original</td><td class="num">${fmtNum(d.valorOriginal)}</td></tr>
            <tr><td>Valor já liquidado</td><td class="num">${fmtNum(d.valorLiquidado)}</td></tr>
            <tr class="pendente"><td>Valor pendente (${esc(doc.moeda)})</td><td class="num">${fmtNum(d.valorPendente)}</td></tr>
        </tbody></table>
    </div>

    ${d.historico.length ? `
    <h2 class="seccao">Histórico de Liquidações e Estornos</h2>
    <table class="lista">
        <thead><tr><th>Data</th><th>Movimento</th><th>Documento</th><th class="num">Valor</th><th class="num">Desconto</th>
            <th class="num">Efeito no pendente</th><th class="num">Pendente após</th></tr></thead>
        <tbody>${historico}</tbody>
    </table>` : ''}

    <div class="rodape">Documento processado por computador — não é documento fiscal / © SGI
        ${d.empresa.rodapeDocumentos ? `<div>${esc(d.empresa.rodapeDocumentos)}</div>` : ''}</div>
</main></body></html>`;
}
