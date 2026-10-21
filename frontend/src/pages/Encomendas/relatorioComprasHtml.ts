/**
 * #217 — Relatório de Compras (separador "Relatórios" das Compras) em HTML para o
 * `imprimirPdf()` (#182): o servidor gera o PDF com "Pág. x/y" (`comPaginacao`, #180),
 * em vez de `window.print()` sobre o ecrã.
 */

export interface LinhaEmAberto {
    numero: string; fornecedor: string; data: string; entrega: string;
    estado: string; valor: string; pctRecebido: number; atrasada: boolean;
}
export interface LinhaEmAtraso {
    numero: string; fornecedor: string; entrega: string; diasAtraso: number; estado: string; valor: string;
}
export interface RelatorioComprasDados {
    empresa: { nome: string; nif?: string; morada?: string };
    geradoEm: string;
    kpis: { emAberto: number; emAtraso: number; hoje: number; semana: number };
    porEstado: { label: string; count: number }[];
    ultimos7Dias: { label: string; count: number }[];
    emAberto: LinhaEmAberto[];
    emAtraso: LinhaEmAtraso[];
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function buildRelatorioComprasHtml(d: RelatorioComprasDados): string {
    const total = d.porEstado.reduce((s, e) => s + e.count, 0);
    const porEstado = d.porEstado.map(e =>
        `<tr><td>${esc(e.label)}</td><td class="n">${e.count}</td><td class="n">${total > 0 ? Math.round(e.count / total * 100) : 0}%</td></tr>`).join('');
    const dias = d.ultimos7Dias.map(v => `<tr><td>${esc(v.label)}</td><td class="n">${v.count}</td></tr>`).join('');
    const emAberto = d.emAberto.length === 0
        ? '<p class="vazio">Sem encomendas em aberto.</p>'
        : `<table><thead><tr><th>Número</th><th>Fornecedor</th><th>Data</th><th>Entrega prevista</th><th>Estado</th><th class="n">Valor</th><th class="n">% Recebido</th></tr></thead><tbody>${
            d.emAberto.map(e => `<tr${e.atrasada ? ' class="atraso"' : ''}><td class="mono">${esc(e.numero)}</td><td>${esc(e.fornecedor)}</td><td>${esc(e.data)}</td><td>${esc(e.entrega)}${e.atrasada ? ' (atrasada)' : ''}</td><td>${esc(e.estado)}</td><td class="n">${esc(e.valor)}</td><td class="n">${e.pctRecebido}%</td></tr>`).join('')
        }</tbody></table>`;
    const emAtraso = d.emAtraso.length === 0
        ? '<p class="vazio">Nenhuma encomenda em atraso.</p>'
        : `<table><thead><tr><th>Número</th><th>Fornecedor</th><th>Entrega prevista</th><th class="n">Dias de atraso</th><th>Estado</th><th class="n">Valor</th></tr></thead><tbody>${
            d.emAtraso.map(e => `<tr class="atraso"><td class="mono">${esc(e.numero)}</td><td>${esc(e.fornecedor)}</td><td>${esc(e.entrega)}</td><td class="n">+${e.diasAtraso}d</td><td>${esc(e.estado)}</td><td class="n">${esc(e.valor)}</td></tr>`).join('')
        }</tbody></table>`;

    return `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"><title>Relatório de Compras</title><style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:9.5pt;color:#1a1a1a}
  h1{font-size:14pt;font-weight:800;color:#0D6EBF;margin-bottom:4px}
  h2{font-size:10.5pt;font-weight:700;color:#0D6EBF;margin:16px 0 6px}
  .meta{font-size:8pt;color:#666;margin-bottom:12px}
  .kpis{display:flex;gap:8px;margin-bottom:4px}
  .kpi{flex:1;border:1px solid #e0e0e0;border-radius:4px;padding:6px 8px}
  .kpi span{display:block;font-size:7.5pt;color:#666;text-transform:uppercase}
  .kpi strong{font-size:13pt}
  .lado{display:flex;gap:16px}.lado>div{flex:1}
  table{width:100%;border-collapse:collapse;font-size:8.5pt}
  thead tr{background:#0D6EBF;color:#fff}
  thead th{padding:5px 7px;text-align:left;font-weight:600}
  tbody td{padding:4px 7px;border-bottom:1px solid #e8e8e8}
  tbody tr:nth-child(even){background:#f5f8ff}
  tr.atraso td{color:#b91c1c}
  .n{text-align:right}.mono{font-family:monospace;font-weight:700}
  .vazio{color:#666;font-style:italic;padding:6px 0}
  thead{display:table-header-group}tr{page-break-inside:avoid}
  .footer{margin-top:20px;font-size:7.5pt;color:#aaa;text-align:center;border-top:1px solid #e0e0e0;padding-top:6px}
</style></head><body>
<h1>Relatório de Compras</h1>
<div class="meta">${esc(d.empresa.nome)}${d.empresa.nif ? ` &nbsp;·&nbsp; NIF: ${esc(d.empresa.nif)}` : ''} &nbsp;·&nbsp; Gerado em ${esc(d.geradoEm)}</div>
<div class="kpis">
  <div class="kpi"><span>Em aberto</span><strong>${d.kpis.emAberto}</strong></div>
  <div class="kpi"><span>Em atraso</span><strong>${d.kpis.emAtraso}</strong></div>
  <div class="kpi"><span>Hoje</span><strong>${d.kpis.hoje}</strong></div>
  <div class="kpi"><span>Esta semana</span><strong>${d.kpis.semana}</strong></div>
</div>
<div class="lado">
  <div><h2>Estado das encomendas</h2><table><thead><tr><th>Estado</th><th class="n">Encomendas</th><th class="n">%</th></tr></thead><tbody>${porEstado}</tbody></table></div>
  <div><h2>Volume — últimos 7 dias</h2><table><thead><tr><th>Dia</th><th class="n">Encomendas</th></tr></thead><tbody>${dias}</tbody></table></div>
</div>
<h2>Encomendas em aberto</h2>
${emAberto}
<h2>Encomendas em atraso</h2>
${emAtraso}
<div class="footer">${esc(d.empresa.nome)}${d.empresa.morada ? ` &nbsp;·&nbsp; ${esc(d.empresa.morada)}` : ''}</div>
</body></html>`;
}
