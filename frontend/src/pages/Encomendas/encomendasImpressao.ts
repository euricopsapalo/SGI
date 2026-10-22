import {
    Encomenda,
    EncomendaLinha,
    EmpresaConfig,
    Artigo,
    TaxaIva,
    Rececao,
    FaturaFornecedor,
    CondicaoPagamento,
    ModoPagamento,
    Fornecedor,
} from '../../contexts/GlobalContext';
import { imprimirPdf } from '../../utils/imprimirPdf';
import { linhaTotal, makePrintFmt } from './encomendas.utils';

/** #223 — extraído de EncomendaPage.tsx (divisão em componentes, sem alterações de comportamento). */

/* ══ Print Nota de Encomenda — abre janela A4 ══════════════ */
export function buildNotaEncomendaHtml(encomenda: Encomenda, fornecedorNome: string, empresa?: EmpresaConfig, simbolo?: string, artigos?: Artigo[], taxasIva?: TaxaIva[]): string {
    const emp = empresa ?? {} as EmpresaConfig;
    const { fmt, fmtMoney, fmtDate } = makePrintFmt(emp, simbolo);

    // Fallback: derive taxaIva from artigo when not persisted in the line
    const linhasResolvidas: EncomendaLinha[] = (encomenda.linhas ?? []).map(l => {
        if ((l.taxaIva ?? 0) !== 0 || !artigos || !taxasIva) return l;
        const art = artigos.find(a => a.id === l.artigoId);
        if (!art?.codigoIva) return l;
        const taxa = taxasIva.find(t => t.codigo === art.codigoIva)?.taxa ?? 0;
        return { ...l, codigoIva: art.codigoIva, taxaIva: taxa };
    });
    const encResolvida: Encomenda = { ...encomenda, linhas: linhasResolvidas };

    // Stamp config per estado
    const stampMap: Record<string, { label: string; color: string; bg: string; border: string }> = {
        Recebida:  { label: 'RECEBIDO',                 color: '#15803d', bg: 'rgba(21,128,61,0.08)',   border: '#15803d' },
        Aprovada:  { label: 'APROVADA',                 color: '#15803d', bg: 'rgba(21,128,61,0.08)',   border: '#15803d' },
        Parcial:   { label: 'PARCIALMENTE\nRECEBIDO',   color: '#b45309', bg: 'rgba(180,83,9,0.08)',    border: '#b45309' },
        Aberta:    { label: 'EM ABERTO',                color: '#0D6EBF', bg: 'rgba(13,110,191,0.08)',  border: '#0D6EBF' },
        Cancelada: { label: 'CANCELADA',                color: '#dc2626', bg: 'rgba(220,38,38,0.08)',   border: '#dc2626' },
        Faturada:  { label: 'CONCLUÍDA',                color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: '#7c3aed' },
    };
    const stamp = stampMap[encomenda.estado] ?? stampMap['Aberta'];
    const stampLines = stamp.label.split('\n');

    // Dates
    const dataGeracao = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const rececaoAtiva = [...(encomenda.rececoes ?? [])].filter(r => r.estado === 'Ativa').sort((a, b) => b.dataHora.localeCompare(a.dataHora));
    const dataUltimaRececao = rececaoAtiva.length > 0
        ? new Date(rececaoAtiva[0].dataHora).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } as any)
        : null;

    const linhaIva   = (l: EncomendaLinha) => Math.round(linhaTotal(l) * ((l.taxaIva ?? 0) / 100) * 100) / 100;
    const linhaComIva = (l: EncomendaLinha) => linhaTotal(l) + linhaIva(l);
    const totalSemIva = encResolvida.linhas.reduce((s, l) => s + linhaTotal(l), 0);
    const totalIva    = encResolvida.linhas.reduce((s, l) => s + linhaIva(l), 0);
    const totalComIva = totalSemIva + totalIva;

    const linhasHtml = encResolvida.linhas.map(l => `
        <tr>
            <td style="font-family:monospace">${l.codigo}</td>
            <td>${l.descricao}</td>
            <td style="text-align:center">${l.unidade}</td>
            <td style="text-align:right">${fmt(l.qtdEncomendada)}</td>
            <td style="text-align:right">${fmtMoney(l.custoUnit, encResolvida.moeda)}</td>
            <td style="text-align:right">${l.desconto > 0 ? `${l.desconto}%` : '—'}</td>
            <td style="text-align:right">${(l.taxaIva ?? 0) > 0 ? `<span style="color:#0D6EBF;font-weight:600">${l.taxaIva}%</span>` : '—'}</td>
            <td style="text-align:right;font-weight:600">
                ${fmtMoney(linhaComIva(l), encomenda.moeda)}
                ${(l.taxaIva ?? 0) > 0 ? `<div style="font-size:7.5pt;font-weight:400;color:#888">s/ IVA: ${fmtMoney(linhaTotal(l), encomenda.moeda)}</div>` : ''}
            </td>
        </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<title>Nota de Encomenda ${encomenda.numero}</title>
<style>
  @page { size: A4; margin: 18mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #1a1a1a; position: relative; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
  .empresa-nome { font-size: 13pt; font-weight: 800; color: #1a1a1a; }
  .empresa-info { font-size: 8.5pt; color: #666; margin-top: 3px; line-height: 1.5; }
  .doc-title { text-align: right; }
  .doc-title h1 { font-size: 14pt; font-weight: 800; letter-spacing: 0.05em; color: #0D6EBF; }
  .doc-title .doc-num { font-size: 11pt; font-weight: 700; margin-top: 3px; }
  .doc-title .doc-date { font-size: 9pt; color: #666; margin-top: 2px; }
  .divider { border: none; border-top: 2px solid #0D6EBF; margin: 12px 0; }
  .divider-thin { border: none; border-top: 1px solid #e0e0e0; margin: 10px 0; }
  .section { margin-bottom: 14px; }
  .section-title { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #0D6EBF; margin-bottom: 5px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; font-size: 9pt; }
  .info-row { display: flex; gap: 6px; margin-bottom: 3px; }
  .info-label { color: #888; min-width: 110px; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 12px 0; }
  thead tr { background: #0D6EBF; color: #fff; }
  thead th { padding: 6px 8px; text-align: left; font-weight: 600; font-size: 8.5pt; }
  tbody tr:nth-child(even) { background: #f5f8ff; }
  tbody td { padding: 5px 8px; border-bottom: 1px solid #e8e8e8; }
  tfoot td { padding: 8px; font-weight: 700; border-top: 2px solid #0D6EBF; }
  .total-row { font-size: 11pt; }
  .obs { font-size: 8.5pt; color: #666; margin-top: 10px; font-style: italic; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 40px; }
  .sig-box { border-top: 1px solid #1a1a1a; padding-top: 6px; font-size: 8.5pt; color: #666; text-align: center; }
  .footer { margin-top: 24px; font-size: 7.5pt; color: #aaa; text-align: center; border-top: 1px solid #e0e0e0; padding-top: 8px; }
  /* Watermark stamp */
  .stamp-watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 52pt; font-weight: 900; letter-spacing: 0.12em;
    color: ${stamp.color}; opacity: 0.08;
    white-space: pre-line; text-align: center;
    pointer-events: none; z-index: 0; line-height: 1.1;
  }
  /* Corner stamp badge */
  .stamp-badge {
    display: inline-block;
    border: 2.5px solid ${stamp.border};
    color: ${stamp.color};
    background: ${stamp.bg};
    padding: 3px 10px; border-radius: 4px;
    font-size: 8.5pt; font-weight: 800; letter-spacing: 0.1em;
    white-space: pre-line; text-align: center; line-height: 1.3;
    margin-top: 5px;
  }
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
  <!-- Watermark -->
  <div class="stamp-watermark">${stampLines.join('\n')}</div>

  <!-- Header -->
  <div class="header">
    <div>
      <div class="empresa-nome">${emp.nome}</div>
      <div class="empresa-info">
        ${emp.morada}<br>
        NIF: ${emp.nif} &nbsp;·&nbsp; Tel: ${emp.telefone}<br>
        ${emp.email}
      </div>
    </div>
    <div class="doc-title">
      <h1>NOTA DE ENCOMENDA</h1>
      <div class="doc-num">Nº ${encomenda.numero}</div>
      <div class="doc-date">Data da encomenda: ${fmtDate(encomenda.data)}</div>
      <div class="doc-date">Data de geração: ${dataGeracao}</div>
      ${dataUltimaRececao ? `<div class="doc-date">Data de receção: ${dataUltimaRececao}</div>` : ''}
      <div><span class="stamp-badge">${stampLines.join('\n')}</span></div>
    </div>
  </div>
  <hr class="divider">

  <!-- Fornecedor + Detalhes -->
  <div class="info-grid">
    <div class="section">
      <div class="section-title">Fornecedor</div>
      <div style="font-weight:600;font-size:10pt">${fornecedorNome}</div>
    </div>
    <div class="section">
      <div class="section-title">Detalhes</div>
      <div class="info-row"><span class="info-label">Data entrega prevista:</span><span>${fmtDate(encomenda.dataEntrega)}</span></div>
      <div class="info-row"><span class="info-label">Cond. pagamento:</span><span>${encomenda.condicoesPagamento || '—'}</span></div>
      <div class="info-row"><span class="info-label">Responsável:</span><span>${encomenda.responsavel}</span></div>
      <div class="info-row"><span class="info-label">Moeda:</span><span>${encomenda.moeda}</span></div>
    </div>
  </div>
  ${encomenda.descricao ? `<div class="info-row" style="font-size:9pt;color:#555;margin-bottom:10px"><span class="info-label">Descrição:</span><span>${encomenda.descricao}</span></div>` : ''}
  <hr class="divider-thin">

  <!-- Artigos -->
  <div class="section-title" style="margin-top:10px">Artigos Encomendados</div>
  <table>
    <thead>
      <tr>
        <th>Código</th>
        <th>Descrição</th>
        <th style="text-align:center">UN</th>
        <th style="text-align:right">Qtd</th>
        <th style="text-align:right">Custo Un.</th>
        <th style="text-align:right">Desc.%</th>
        <th style="text-align:right">IVA%</th>
        <th style="text-align:right">Total c/ IVA</th>
      </tr>
    </thead>
    <tbody>${linhasHtml}</tbody>
    <tfoot>
      <tr>
        <td colspan="7" style="text-align:right;padding-right:12px;font-size:8.5pt;color:#555">Subtotal s/ IVA</td>
        <td style="text-align:right;font-size:8.5pt">${fmtMoney(totalSemIva, encomenda.moeda)}</td>
      </tr>
      <tr>
        <td colspan="7" style="text-align:right;padding-right:12px;font-size:8.5pt;color:#555">IVA</td>
        <td style="text-align:right;font-size:8.5pt;color:#0D6EBF">${fmtMoney(totalIva, encomenda.moeda)}</td>
      </tr>
      <tr class="total-row">
        <td colspan="7" style="text-align:right;padding-right:12px;border-top:2px solid #0D6EBF">TOTAL c/ IVA</td>
        <td style="text-align:right;border-top:2px solid #0D6EBF">${fmtMoney(totalComIva, encomenda.moeda)}</td>
      </tr>
    </tfoot>
  </table>

  ${encomenda.observacoes ? `<div class="obs">Observações: ${encomenda.observacoes}</div>` : ''}

  <!-- Assinaturas -->
  <div class="signatures">
    <div class="sig-box">O Responsável pela Encomenda<br><br><br><br>${encomenda.responsavel}</div>
    <div class="sig-box">Aprovado por<br><br><br><br>_________________________</div>
  </div>

  <div class="footer">${emp.nome} · ${emp.morada} · NIF: ${emp.nif}</div>
</body>
</html>`;

    return html;
}

export function printNotaEncomenda(encomenda: Encomenda, fornecedorNome: string, empresa?: EmpresaConfig, simbolo?: string, artigos?: Artigo[], taxasIva?: TaxaIva[]) {
    void imprimirPdf(buildNotaEncomendaHtml(encomenda, fornecedorNome, empresa, simbolo, artigos, taxasIva));
}

/* ══ Print Nota de Entrada — guia de recebimento A4 ════════ */
export function buildNotaEntradaHtml(
    rececao: Rececao,
    encomenda: Encomenda,
    empresa?: EmpresaConfig,
    simbolo?: string,
): string {
    const emp = empresa ?? {} as EmpresaConfig;
    const { fmt } = makePrintFmt(emp, simbolo);
    const dataHora = new Date(rececao.dataHora).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const todasGuias = encomenda.rececoes
        .filter(r => r.estado === 'Ativa')
        .sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime())
        .map(r => r.guiaRemessa);
    const guiasAnteriores = todasGuias.filter(g => g !== rececao.guiaRemessa);

    const linhasHtml = rececao.itens.map(item => `
        <tr>
            <td style="font-family:monospace">${item.codigo}</td>
            <td>${item.descricao}</td>
            <td style="text-align:center">${item.unidade}</td>
            <td style="text-align:right;font-weight:700">${fmt(item.qtd)}</td>
        </tr>`).join('');

    const novoEstado = encomenda.estado;
    const entradaStamp = encomenda.estado === 'Faturada'
        ? { label: 'FATURADA',          color: '#7c3aed' }
        : { label: 'A AGUARDAR\nFATURA', color: '#b45309' };

    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<title>Nota de Entrada — ${encomenda.numero}</title>
<style>
  @page { size: A4; margin: 18mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #1a1a1a; position: relative; }
  .stamp-watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 52pt; font-weight: 900; letter-spacing: 0.12em;
    color: ${entradaStamp.color}; opacity: 0.08;
    white-space: pre-line; text-align: center;
    pointer-events: none; z-index: 0; line-height: 1.1;
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
  .empresa-nome { font-size: 13pt; font-weight: 800; }
  .empresa-info { font-size: 8.5pt; color: #666; margin-top: 3px; line-height: 1.5; }
  .doc-title { text-align: right; }
  .doc-title h1 { font-size: 14pt; font-weight: 800; letter-spacing: 0.05em; color: #16a34a; }
  .doc-title .doc-num { font-size: 10pt; font-weight: 700; margin-top: 3px; }
  .doc-title .doc-date { font-size: 9pt; color: #666; margin-top: 2px; }
  .divider { border: none; border-top: 2px solid #16a34a; margin: 12px 0; }
  .divider-thin { border: none; border-top: 1px solid #e0e0e0; margin: 10px 0; }
  .section { margin-bottom: 14px; }
  .section-title { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #16a34a; margin-bottom: 5px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; font-size: 9pt; }
  .info-row { display: flex; gap: 6px; margin-bottom: 4px; font-size: 9pt; }
  .info-label { color: #888; min-width: 130px; }
  .badge { display: inline-block; background: #dcfce7; color: #16a34a; border: 1px solid #bbf7d0; border-radius: 4px; padding: 2px 8px; font-size: 8.5pt; font-weight: 600; }
  .guia-box { background: #f0fdf4; border: 2px solid #16a34a; border-radius: 6px; padding: 12px 16px; margin: 14px 0; }
  .guia-box-label { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #16a34a; margin-bottom: 6px; }
  .guia-num { font-size: 13pt; font-weight: 800; letter-spacing: 0.04em; color: #1a1a1a; }
  .guia-prev { font-size: 8.5pt; color: #666; margin-top: 6px; padding-top: 6px; border-top: 1px solid #bbf7d0; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 10px 0; }
  thead tr { background: #16a34a; color: #fff; }
  thead th { padding: 6px 8px; text-align: left; font-weight: 600; font-size: 8.5pt; }
  tbody tr:nth-child(even) { background: #f0fdf4; }
  tbody td { padding: 5px 8px; border-bottom: 1px solid #e8e8e8; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 40px; }
  .sig-box { border-top: 1px solid #1a1a1a; padding-top: 6px; font-size: 8.5pt; color: #666; text-align: center; }
  .footer { margin-top: 24px; font-size: 7.5pt; color: #aaa; text-align: center; border-top: 1px solid #e0e0e0; padding-top: 8px; }
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="stamp-watermark">${entradaStamp.label}</div>
  <div class="header">
    <div>
      <div class="empresa-nome">${emp.nome}</div>
      <div class="empresa-info">
        ${emp.morada}<br>
        NIF: ${emp.nif} &nbsp;·&nbsp; Tel: ${emp.telefone}<br>
        ${emp.email}
      </div>
    </div>
    <div class="doc-title">
      <h1>NOTA DE ENTRADA</h1>
      <div class="doc-num">Ref. Encomenda: ${encomenda.numero}</div>
      <div class="doc-date">Data/Hora: ${dataHora}</div>
    </div>
  </div>
  <hr class="divider">

  <div class="info-grid">
    <div class="section">
      <div class="section-title">Dados da Recepção</div>
      <div class="info-row"><span class="info-label">Data / Hora:</span><span>${dataHora}</span></div>
      <div class="info-row"><span class="info-label">Operador Responsável:</span><span><strong>${rececao.operador}</strong></span></div>
      <div class="info-row"><span class="info-label">Armazém de Destino:</span><span><strong>${rececao.armazem}</strong></span></div>
    </div>
    <div class="section">
      <div class="section-title">Encomenda de Origem</div>
      <div class="info-row"><span class="info-label">Nº Encomenda:</span><span>${encomenda.numero}</span></div>
      <div class="info-row"><span class="info-label">Estado após recepção:</span><span><span class="badge">${novoEstado}</span></span></div>
      <div class="info-row"><span class="info-label">Entregas totais:</span><span>${todasGuias.length}</span></div>
    </div>
  </div>
  <hr class="divider-thin">

  <div class="guia-box">
    <div class="guia-box-label">Guia de Remessa do Fornecedor — Esta Entrega</div>
    <div class="guia-num">${rececao.guiaRemessa}</div>
    ${guiasAnteriores.length > 0 ? `<div class="guia-prev">Entregas anteriores (${guiasAnteriores.length}): ${guiasAnteriores.join(' &nbsp;·&nbsp; ')}</div>` : ''}
  </div>

  <div class="section-title" style="margin-top:4px">Artigos Recebidos Nesta Entrega</div>
  <table>
    <thead>
      <tr>
        <th>Código</th>
        <th>Descrição</th>
        <th style="text-align:center">UN</th>
        <th style="text-align:right">Qtd. Recebida</th>
      </tr>
    </thead>
    <tbody>${linhasHtml}</tbody>
  </table>

  <div class="signatures">
    <div class="sig-box">Operador Responsável<br><br><br><br>${rececao.operador}</div>
    <div class="sig-box">Conferência / Aprovação<br><br><br><br>_________________________</div>
  </div>

  <div class="footer">${emp.nome} &nbsp;·&nbsp; ${emp.morada} &nbsp;·&nbsp; NIF: ${emp.nif}</div>
</body>
</html>`;

    return html;
}

export function printNotaEntrada(
    rececao: Rececao,
    encomenda: Encomenda,
    empresa?: EmpresaConfig,
    simbolo?: string,
) {
    void imprimirPdf(buildNotaEntradaHtml(rececao, encomenda, empresa, simbolo));
}

/* ══ Print Fatura Fornecedor (VFA / VFR) ════════════════════ */
export function buildFaturaFornecedorHtml(
    fatura: FaturaFornecedor,
    fornecedor: Fornecedor | undefined,
    empresa?: EmpresaConfig,
    simbolo?: string,
    artigos?: Artigo[],
    condicoes?: CondicaoPagamento[],
    modos?: ModoPagamento[],
    conferidor?: string,
): string {
    const emp = empresa ?? {} as EmpresaConfig;
    const { fmt, fmtMoney, fmtDate } = makePrintFmt(emp, simbolo);

    const stampMap: Record<string, { label: string; color: string; bg: string; border: string }> = {
        Pendente: { label: 'PENDENTE', color: '#b45309', bg: 'rgba(180,83,9,0.08)',    border: '#b45309' },
        Paga:     { label: 'PAGA',     color: '#15803d', bg: 'rgba(21,128,61,0.08)',   border: '#15803d' },
        Anulada:  { label: 'ANULADA',  color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: '#6b7280' },
    };
    const stamp = stampMap[fatura.estadoPagamento] ?? stampMap['Pendente'];
    const dataRegisto = fatura.dataRegistoSistema
        ? fmtDate(String(fatura.dataRegistoSistema).split('T')[0])
        : new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const modoPag = fatura.modoPagamentoId && modos
        ? modos.find(m => String(m.id) === String(fatura.modoPagamentoId))?.descricao ?? '—'
        : '—';
    const condPag = fatura.condicaoPagamentoId && condicoes
        ? (() => { const c = condicoes.find(x => String(x.id) === String(fatura.condicaoPagamentoId)); return c ? `${c.descricao}${c.numDias > 0 ? ` (${c.numDias} dias)` : ''}` : '—'; })()
        : '—';

    const linhasHtml = (fatura.linhas ?? []).map(l => {
        const art = artigos?.find(a => a.id === String(l.produtoId ?? ''));
        const descricao = l.descricaoCustomizada || art?.descricao || '—';
        const codigo    = art?.codigo ?? '—';
        return `
        <tr>
            <td style="font-family:monospace;font-size:8.5pt">${codigo}</td>
            <td>${descricao}</td>
            <td style="text-align:right">${fmt(l.quantidade)}</td>
            <td style="text-align:center">${l.unidadeVenda || 'UN'}</td>
            <td style="text-align:right">${fmtMoney(l.precoUnitarioNet, fatura.moeda)}</td>
            <td style="text-align:right">${l.taxaIva > 0 ? `<span style="color:#40cfff;font-weight:600">${l.taxaIva}%</span>` : '—'}</td>
            <td style="text-align:right;font-weight:600">${fmtMoney(l.valorTotalLinha, fatura.moeda)}</td>
        </tr>`;
    }).join('');

    const localizacoes = Array.from(new Set(
        (fatura.linhas ?? []).map(l => artigos?.find(a => a.id === String(l.produtoId ?? ''))?.codigoArmazem).filter(Boolean)
    )).join(', ') || '—';

    return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<title>${fatura.tipoDocumento} — ${fatura.numFaturaExterno}</title>
<style>
  @page { size: A4; margin: 18mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #1a1a1a; position: relative; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .empresa-nome { font-size: 13pt; font-weight: 800; }
  .empresa-info { font-size: 8.5pt; color: #666; margin-top: 3px; line-height: 1.5; }
  .doc-title { text-align: right; }
  .doc-title h1 { font-size: 14pt; font-weight: 800; letter-spacing: 0.05em; color: #40cfff; }
  .doc-title .doc-num { font-size: 11pt; font-weight: 700; margin-top: 3px; }
  .doc-title .doc-sub { font-size: 8.5pt; color: #666; margin-top: 2px; }
  .divider { border: none; border-top: 2px solid #40cfff; margin: 10px 0; }
  .divider-thin { border: none; border-top: 1px solid #e0e0e0; margin: 8px 0; }
  .section { margin-bottom: 12px; }
  .section-title { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #40cfff; margin-bottom: 5px; border-bottom: 1px solid #e0f9ff; padding-bottom: 2px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0 16px; }
  .info-row { display: flex; gap: 6px; margin-bottom: 3px; font-size: 9pt; }
  .info-label { color: #888; min-width: 110px; flex-shrink: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 8px 0; }
  thead tr { background: #40cfff; color: #fff; }
  thead th { padding: 6px 8px; text-align: left; font-weight: 600; font-size: 8.5pt; }
  tbody tr:nth-child(even) { background: #f0fdff; }
  tbody td { padding: 5px 8px; border-bottom: 1px solid #e8e8e8; }
  tfoot td { padding: 7px 8px; font-weight: 700; }
  .total-row td { font-size: 11pt; border-top: 2px solid #40cfff; }
  .obs { font-size: 8.5pt; color: #666; margin-top: 8px; font-style: italic; }
  .footer { margin-top: 20px; font-size: 7.5pt; color: #aaa; text-align: center; border-top: 1px solid #e0e0e0; padding-top: 7px; }
  .stamp-watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 60pt; font-weight: 900; letter-spacing: 0.12em;
    color: ${stamp.color}; opacity: 0.07;
    pointer-events: none; z-index: 0; white-space: nowrap;
  }
  .stamp-badge {
    display: inline-block; border: 2.5px solid ${stamp.border};
    color: ${stamp.color}; background: ${stamp.bg};
    padding: 3px 10px; border-radius: 4px;
    font-size: 8.5pt; font-weight: 800; letter-spacing: 0.1em; margin-top: 4px;
  }
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="stamp-watermark">${stamp.label}</div>

  <!-- CABEÇALHO -->
  <div class="header">
    <div>
      <div class="empresa-nome">${emp.nome}</div>
      <div class="empresa-info">
        NIF: ${emp.nif}<br>
        ${emp.morada}<br>
        Tel: ${emp.telefone} &nbsp;·&nbsp; ${emp.email}
      </div>
    </div>
    <div class="doc-title">
      <h1>${fatura.tipoDocumento}</h1>
      <div class="doc-num">Nº ${fatura.numFaturaExterno}</div>
      <div class="doc-sub">Tipo: ${fatura.tipoDocumento} &nbsp;·&nbsp; Moeda: ${fatura.moeda}</div>
      <div><span class="stamp-badge">${stamp.label}</span></div>
    </div>
  </div>
  <hr class="divider">

  <!-- DATAS -->
  <div class="section">
    <div class="section-title">Datas</div>
    <div class="grid-3">
      <div class="info-row"><span class="info-label">Emissão:</span><span>${fmtDate(fatura.dataEmissao)}</span></div>
      <div class="info-row"><span class="info-label">Entrega:</span><span>${dataRegisto}</span></div>
      <div class="info-row"><span class="info-label">Vencimento:</span><span>${fatura.dataVencimento ? fmtDate(fatura.dataVencimento) : '—'}</span></div>
    </div>
  </div>
  <hr class="divider-thin">

  <!-- FORNECEDOR -->
  <div class="section">
    <div class="section-title">Fornecedor</div>
    <div class="grid-2">
      <div>
        <div style="font-weight:700;font-size:10pt;margin-bottom:3px">${fornecedor?.nome ?? '—'}</div>
        <div class="info-row"><span class="info-label">NIF:</span><span>${fornecedor?.nif ?? '—'}</span></div>
        <div class="info-row"><span class="info-label">Endereço:</span><span>${fornecedor?.morada ?? '—'}</span></div>
        <div class="info-row"><span class="info-label">Contacto:</span><span>${fornecedor?.telefone ?? '—'} ${fornecedor?.email ? `· ${fornecedor.email}` : ''}</span></div>
      </div>
      <div>
        <div class="info-row"><span class="info-label">Cond. Pagamento:</span><span>${condPag}</span></div>
        ${fatura.descricao ? `<div class="info-row"><span class="info-label">Descrição:</span><span>${fatura.descricao}</span></div>` : ''}
      </div>
    </div>
  </div>
  <hr class="divider-thin">

  <!-- ARTIGOS -->
  <div class="section">
    <div class="section-title">Artigos</div>
    <table>
      <thead><tr>
        <th>Código</th><th>Descrição</th>
        <th style="text-align:right">Qtd</th><th style="text-align:center">UN</th>
        <th style="text-align:right">Preço Unit.</th><th style="text-align:right">IVA %</th>
        <th style="text-align:right">Total c/ IVA</th>
      </tr></thead>
      <tbody>${linhasHtml}</tbody>
    </table>
  </div>

  <!-- RESUMO FINANCEIRO -->
  <div style="display:flex;justify-content:flex-end;margin-bottom:14px">
    <table style="width:280px;margin:0">
      <thead><tr><th colspan="2" style="text-align:left">Resumo Financeiro</th></tr></thead>
      <tbody>
        <tr><td style="color:#555">Subtotal:</td><td style="text-align:right">${fmtMoney(fatura.totalLiquido, fatura.moeda)}</td></tr>
        <tr><td style="color:#40cfff">IVA:</td><td style="text-align:right;color:#40cfff">${fmtMoney(fatura.totalIva, fatura.moeda)}</td></tr>
        ${fatura.totalRetencao > 0 ? `<tr><td style="color:#dc2626">Retenção:</td><td style="text-align:right;color:#dc2626">− ${fmtMoney(fatura.totalRetencao, fatura.moeda)}</td></tr>` : ''}
      </tbody>
      <tfoot><tr class="total-row"><td>TOTAL FINAL</td><td style="text-align:right">${fmtMoney(fatura.totalFinal, fatura.moeda)}</td></tr></tfoot>
    </table>
  </div>

  <!-- PAGAMENTO -->
  <div class="section">
    <div class="section-title">Pagamento</div>
    <div class="grid-2">
      <div>
        <div class="info-row"><span class="info-label">Método:</span><span>${modoPag}</span></div>
        <div class="info-row"><span class="info-label">Data de Pagamento:</span><span>${fatura.dataPagamento ? fmtDate(fatura.dataPagamento) : '—'}</span></div>
        <div class="info-row"><span class="info-label">Referência:</span><span>${fatura.referenciaPagamento ?? '—'}</span></div>
      </div>
      <div>
        <div class="info-row"><span class="info-label">Estado:</span>
          <span style="font-weight:700;color:${stamp.color}">${stamp.label}</span>
        </div>
      </div>
    </div>
  </div>
  <hr class="divider-thin">

  <!-- RECEPÇÃO -->
  <div class="section">
    <div class="section-title">Recepção</div>
    <div class="grid-3">
      <div class="info-row"><span class="info-label">Data de Recepção:</span><span>${dataRegisto}</span></div>
      <div class="info-row"><span class="info-label">Conferidor:</span><span>${conferidor ?? '—'}</span></div>
      <div class="info-row"><span class="info-label">Localização:</span><span>${localizacoes}</span></div>
    </div>
  </div>

  ${fatura.observacoes ? `<div class="obs">Observações: ${fatura.observacoes}</div>` : ''}
  <div class="footer">${emp.nome} &nbsp;·&nbsp; NIF: ${emp.nif} &nbsp;·&nbsp; ${emp.morada}</div>
</body>
</html>`;
}

/* ══ Print VNC ══════════════════════════════════════════════ */
export function buildVNCHtml(
    fatura: FaturaFornecedor,
    fornecedor: Fornecedor | undefined,
    empresa?: EmpresaConfig,
    simbolo?: string,
    artigos?: Artigo[],
    _condicoes?: CondicaoPagamento[],
    _modos?: ModoPagamento[],
    conferidor?: string,
): string {
    const emp = empresa ?? {} as EmpresaConfig;
    const { fmt, fmtMoney, fmtDate } = makePrintFmt(emp, simbolo);

    const estadoEfetivo = (!fatura.estadoDocumento || fatura.estadoDocumento === 'NA') ? 'Rascunho' : fatura.estadoDocumento;
    const vncStampMap: Record<string, { label: string; color: string; bg: string; border: string }> = {
        Rascunho:         { label: 'RASCUNHO',      color: '#374151', bg: 'rgba(55,65,81,0.07)',   border: '#374151' },
        AguardaAprovacao: { label: 'EM APROVAÇÃO',  color: '#b45309', bg: 'rgba(180,83,9,0.07)',   border: '#b45309' },
        Validado:         { label: 'VALIDADO',       color: '#15803d', bg: 'rgba(21,128,61,0.07)', border: '#15803d' },
    };
    const stamp = vncStampMap[estadoEfetivo] ?? vncStampMap['Rascunho'];

    const isDevolucao  = fatura.tipoNotaCredito === 'Devolucao';
    const isAcerto     = fatura.tipoNotaCredito === 'AcertoPreco';
    const dataRegisto  = fatura.dataRegistoSistema
        ? fmtDate(String(fatura.dataRegistoSistema).split('T')[0])
        : new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const tipoNCLabel = isDevolucao ? 'Devolução (Impacto Logístico + Financeiro)' : isAcerto ? 'Acerto de Preço (Impacto Financeiro)' : '—';

    const faturasOrigHtml = (fatura.faturasAssociadas ?? []).map(fa =>
        `<div class="info-row"><span class="info-label">Fatura Original:</span><span style="font-weight:600">${fa.faturaAssociada?.tipoDocumento ?? ''} ${fa.faturaAssociada?.numFaturaExterno ?? String(fa.faturaAssociadaId)}</span></div>`
    ).join('') || '<div class="info-row"><span style="color:#888">—</span></div>';

    const artigosDevHtml = isDevolucao ? (fatura.linhas ?? []).map(l => {
        const art = artigos?.find(a => a.id === String(l.produtoId ?? ''));
        const descricao = l.descricaoCustomizada || art?.descricao || '—';
        const codigo    = art?.codigo ?? '—';
        const armazem   = art?.codigoArmazem ?? '—';
        return `
        <tr>
            <td style="font-family:monospace;font-size:8.5pt">${codigo}</td>
            <td>${descricao}</td>
            <td style="text-align:right">${fmt(l.quantidade)}</td>
            <td style="text-align:right">${fmtMoney(l.precoUnitarioNet, fatura.moeda)}</td>
            <td style="text-align:right">${l.taxaIva > 0 ? `${l.taxaIva}%` : '—'}</td>
            <td style="text-align:center">${armazem}</td>
            <td style="text-align:right;font-weight:600">${fmtMoney(l.valorTotalLinha, fatura.moeda)}</td>
        </tr>`;
    }).join('') : '';

    const totalDevolvido = isDevolucao
        ? (fatura.linhas ?? []).reduce((s, l) => s + Number(l.quantidade), 0)
        : 0;

    return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<title>VNC — ${fatura.numFaturaExterno}</title>
<style>
  @page { size: A4; margin: 18mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #1a1a1a; position: relative; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .empresa-nome { font-size: 13pt; font-weight: 800; }
  .empresa-info { font-size: 8.5pt; color: #666; margin-top: 3px; line-height: 1.5; }
  .doc-title { text-align: right; }
  .doc-title h1 { font-size: 14pt; font-weight: 800; letter-spacing: 0.05em; color: #40cfff; }
  .doc-title .doc-num { font-size: 11pt; font-weight: 700; margin-top: 3px; }
  .doc-title .doc-sub { font-size: 8.5pt; color: #666; margin-top: 2px; }
  .divider { border: none; border-top: 2px solid #40cfff; margin: 10px 0; }
  .divider-thin { border: none; border-top: 1px solid #e0e0e0; margin: 8px 0; }
  .section { margin-bottom: 12px; }
  .section-title { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #40cfff; margin-bottom: 5px; border-bottom: 1px solid #e0f9ff; padding-bottom: 2px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0 16px; }
  .info-row { display: flex; gap: 6px; margin-bottom: 3px; font-size: 9pt; }
  .info-label { color: #888; min-width: 130px; flex-shrink: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 8px 0; }
  thead tr { background: #40cfff; color: #fff; }
  thead th { padding: 6px 8px; text-align: left; font-weight: 600; font-size: 8.5pt; }
  tbody tr:nth-child(even) { background: #f0fdff; }
  tbody td { padding: 5px 8px; border-bottom: 1px solid #e8e8e8; }
  tfoot td { padding: 7px 8px; font-weight: 700; }
  .total-row td { border-top: 2px solid #40cfff; }
  .impact-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 14px; margin-bottom: 10px; }
  .impact-box .impact-title { font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #374151; margin-bottom: 5px; }
  .obs { font-size: 8.5pt; color: #666; margin-top: 8px; font-style: italic; }
  .footer { margin-top: 20px; font-size: 7.5pt; color: #aaa; text-align: center; border-top: 1px solid #e0e0e0; padding-top: 7px; }
  .stamp-watermark {
    position: fixed; top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 52pt; font-weight: 900; letter-spacing: 0.12em;
    color: ${stamp.color}; opacity: 0.07;
    pointer-events: none; z-index: 0; white-space: nowrap;
  }
  .stamp-badge {
    display: inline-block; border: 2.5px solid ${stamp.border};
    color: ${stamp.color}; background: ${stamp.bg};
    padding: 3px 10px; border-radius: 4px;
    font-size: 8.5pt; font-weight: 800; letter-spacing: 0.1em; margin-top: 4px;
  }
  @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="stamp-watermark">${stamp.label}</div>

  <!-- CABEÇALHO -->
  <div class="header">
    <div>
      <div class="empresa-nome">${emp.nome}</div>
      <div class="empresa-info">
        NIF: ${emp.nif}<br>
        ${emp.morada}<br>
        Tel: ${emp.telefone} &nbsp;·&nbsp; ${emp.email}
      </div>
    </div>
    <div class="doc-title">
      <h1>VNC</h1>
      <div class="doc-num">Nº ${fatura.numFaturaExterno}</div>
      <div class="doc-sub">Tipo de Documento: VNC &nbsp;·&nbsp; Moeda: ${fatura.moeda}</div>
      <div><span class="stamp-badge">${stamp.label}</span></div>
    </div>
  </div>
  <hr class="divider">

  <!-- DATAS -->
  <div class="section">
    <div class="section-title">Datas</div>
    <div class="grid-2">
      <div class="info-row"><span class="info-label">Emissão (Fornecedor):</span><span>${fmtDate(fatura.dataEmissao)}</span></div>
      <div class="info-row"><span class="info-label">Registo (Sistema):</span><span>${dataRegisto}</span></div>
    </div>
  </div>
  <hr class="divider-thin">

  <!-- FORNECEDOR -->
  <div class="section">
    <div class="section-title">Fornecedor (Origem)</div>
    <div style="font-weight:700;font-size:10pt;margin-bottom:4px">${fornecedor?.nome ?? '—'}</div>
    <div class="info-row"><span class="info-label">NIF:</span><span>${fornecedor?.nif ?? '—'}</span></div>
    <div class="info-row"><span class="info-label">Endereço/Contacto:</span><span>${fornecedor?.morada ?? '—'}${fornecedor?.telefone ? ` | Tel: ${fornecedor.telefone}` : ''}</span></div>
  </div>
  <hr class="divider-thin">

  <!-- DOCUMENTO ORIGINAL -->
  <div class="section">
    <div class="section-title">Documento Original</div>
    ${faturasOrigHtml}
  </div>
  <hr class="divider-thin">

  <!-- MOTIVO -->
  <div class="section">
    <div class="section-title">Motivo da Nota de Crédito</div>
    <div class="info-row"><span class="info-label">Tipo:</span><span style="font-weight:600">${tipoNCLabel}</span></div>
    ${fatura.descricao ? `<div class="info-row"><span class="info-label">Descrição:</span><span>${fatura.descricao}</span></div>` : ''}
  </div>

  ${isDevolucao ? `
  <hr class="divider-thin">
  <!-- ARTIGOS DEVOLVIDOS -->
  <div class="section">
    <div class="section-title">Artigos Devolvidos (Impacto Logístico)</div>
    <table>
      <thead><tr>
        <th>Código</th><th>Descrição</th>
        <th style="text-align:right">Qtd</th>
        <th style="text-align:right">Preço Unit.</th>
        <th style="text-align:right">IVA (%)</th>
        <th style="text-align:center">Armazém</th>
        <th style="text-align:right">Total</th>
      </tr></thead>
      <tbody>${artigosDevHtml}</tbody>
    </table>
  </div>` : ''}

  <!-- RESUMO FINANCEIRO (impacto financeiro — sempre presente) -->
  <hr class="divider-thin">
  <div class="section">
    <div class="section-title">Resumo Financeiro (Impacto Financeiro)</div>
    <div style="display:flex;justify-content:flex-end">
      <table style="width:320px;margin:0">
        <tbody>
          <tr><td style="color:#555">Subtotal:</td><td style="text-align:right">${fmtMoney(fatura.totalLiquido, fatura.moeda)}</td></tr>
          <tr><td style="color:#555">IVA:</td><td style="text-align:right">${fmtMoney(fatura.totalIva, fatura.moeda)}</td></tr>
          ${fatura.totalRetencao > 0 ? `<tr><td style="color:#dc2626">Retenção:</td><td style="text-align:right;color:#dc2626">− ${fmtMoney(fatura.totalRetencao, fatura.moeda)}</td></tr>` : ''}
        </tbody>
        <tfoot><tr class="total-row">
          <td style="color:#dc2626;font-size:10.5pt">CRÉDITO A SEU FAVOR</td>
          <td style="text-align:right;color:#dc2626;font-size:10.5pt">${fmtMoney(fatura.totalFinal, fatura.moeda)}</td>
        </tr></tfoot>
      </table>
    </div>
  </div>

  <!-- RESUMO IMPACTOS -->
  <hr class="divider-thin">
  <div class="section">
    <div class="section-title">Resumo de Impactos</div>
    <div class="impact-box">
      ${isDevolucao ? `<div class="impact-title">Impacto Logístico</div>
      <div class="info-row"><span class="info-label">Total Devolvido:</span><span style="font-weight:700">${fmt(totalDevolvido)} UN</span></div>` : ''}
      <div class="impact-title" style="margin-top:${isDevolucao ? 8 : 0}px">Impacto Financeiro</div>
      <div class="info-row"><span class="info-label">Crédito Autorizado:</span><span style="font-weight:700;color:#dc2626">${fmtMoney(fatura.totalFinal, fatura.moeda)}</span></div>
      <div style="margin-top:8px" class="info-row"><span class="info-label">Status Geral:</span>
        <span style="font-weight:700;color:${stamp.color}">${estadoEfetivo === 'AguardaAprovacao' ? 'Aguarda Aprovação' : estadoEfetivo}</span>
      </div>
    </div>
  </div>

  ${fatura.observacoes ? `<div class="obs">Observações: ${fatura.observacoes}</div>` : ''}

  <!-- RODAPÉ -->
  <div class="footer">
    Entidade de Registo: ${emp.nome} &nbsp;·&nbsp; NIF: ${emp.nif}<br>
    Nota: Guarde este documento para fins de reconciliação contabilística. Emitido por ${fornecedor?.nome ?? '—'}.
    ${conferidor ? `&nbsp;·&nbsp; Registado por: ${conferidor}` : ''}
  </div>
</body>
</html>`;
}

export function printDocFornecedor(html: string) {
    void imprimirPdf(html);
}

/* ══ Print Sugestões ═════════════════════════════════════════ */
export function buildSugestoesHtml(artigos: Artigo[], empresa?: EmpresaConfig, simbolo?: string): string {
    const emp = empresa ?? {} as EmpresaConfig;
    const { fmtMoney, fmtDate } = makePrintFmt(emp, simbolo);
    const today = fmtDate(new Date().toISOString());
    const rows = artigos.map(a => {
        const disp = a.stockDisponivel ?? Math.max(0, a.existencia - a.stockReservado);
        const deficit = Math.max(0, a.stockSeguranca - (disp + a.stockEncomendado));
        return `<tr>
            <td style="font-family:monospace">${a.codigo}</td>
            <td>${a.descricao}</td>
            <td style="text-align:center">${a.classe}</td>
            <td style="text-align:right">${disp.toLocaleString('pt-PT')}</td>
            <td style="text-align:right">${a.stockEncomendado.toLocaleString('pt-PT')}</td>
            <td style="text-align:right">${a.stockSeguranca.toLocaleString('pt-PT')}</td>
            <td style="text-align:right;font-weight:700;color:#dc2626">${deficit.toLocaleString('pt-PT')}</td>
            <td style="text-align:right">${fmtMoney(a.precoCusto)}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8">
<title>Sugestões de Encomenda</title>
<style>
  @page{size:A4;margin:18mm 15mm}*{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:9.5pt;color:#1a1a1a}
  h1{font-size:14pt;font-weight:800;color:#0D6EBF;margin-bottom:4px}
  .meta{font-size:8pt;color:#666;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;font-size:8.5pt;margin-top:12px}
  thead tr{background:#0D6EBF;color:#fff}
  thead th{padding:6px 8px;text-align:left;font-weight:600}
  tbody tr:nth-child(even){background:#f5f8ff}
  tbody td{padding:5px 8px;border-bottom:1px solid #e8e8e8}
  .footer{margin-top:24px;font-size:7.5pt;color:#aaa;text-align:center;border-top:1px solid #e0e0e0;padding-top:8px}
  @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body>
<h1>Sugestões de Encomenda — Rupturas de Stock</h1>
<div class="meta">${emp.nome} &nbsp;·&nbsp; NIF: ${emp.nif} &nbsp;·&nbsp; Data: ${today} &nbsp;·&nbsp; ${artigos.length} artigo(s)</div>
<table>
  <thead><tr>
    <th>Código</th><th>Descrição</th><th>Classe</th>
    <th style="text-align:right">Disponível</th>
    <th style="text-align:right">Encomendado</th>
    <th style="text-align:right">Stock Seg.</th>
    <th style="text-align:right">Défice</th>
    <th style="text-align:right">Preço Compra</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">${emp.nome} &nbsp;·&nbsp; ${emp.morada}</div>
</body></html>`;

    return html;
}

export function printSugestoes(artigos: Artigo[], empresa?: EmpresaConfig, simbolo?: string) {
    void imprimirPdf(buildSugestoesHtml(artigos, empresa, simbolo));
}
