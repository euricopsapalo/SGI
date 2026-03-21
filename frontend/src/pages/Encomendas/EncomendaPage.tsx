import React, { useState, useMemo, useEffect, useRef } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import SearchableSelect from '../../components/SearchableSelect';
import {
    useGlobal, Encomenda, EncomendaLinha, EncomendaEstado, EmpresaConfig, Artigo,
    Rececao, RececaoItem,
} from '../../contexts/GlobalContext';
import {
    Search, Plus, X, AlertCircle, Check, ShoppingCart,
    Package, Printer, ChevronDown, Archive, Download, TrendingDown, ShoppingBag,
    Ban, RotateCcw,
} from 'lucide-react';
import ExportModal, { ExportCol } from '../../components/ExportModal';

/* ══ Helpers ════════════════════════════════════════════════ */
const linhaTotal = (l: EncomendaLinha) =>
    l.qtdEncomendada * l.custoUnit * (1 - l.desconto / 100);
const encTotal = (e: Encomenda) => e.linhas.reduce((s, l) => s + linhaTotal(l), 0);

/** Cria helpers de formatação derivados da configuração da empresa (para funções de impressão fora do React). */
function makePrintFmt(empresa: EmpresaConfig, simbolo?: string) {
    const casas = empresa.casasDecimais ?? 2;
    const simb  = simbolo ?? empresa.moeda ?? '';
    const fmt      = (n: number) => n.toLocaleString('pt-PT', { minimumFractionDigits: casas, maximumFractionDigits: casas });
    const fmtMoney = (n: number, moeda?: string) => `${fmt(n)} ${moeda ? moeda : simb}`;
    const fmtDate  = (s?: string): string => {
        if (!s) return '—';
        const d = new Date(s);
        if (isNaN(d.getTime())) return '—';
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = String(d.getFullYear());
        const f = empresa.formatoData ?? 'DD/MM/YYYY';
        if (f === 'YYYY-MM-DD') return `${yyyy}-${mm}-${dd}`;
        if (f === 'MM/DD/YYYY') return `${mm}/${dd}/${yyyy}`;
        return `${dd}/${mm}/${yyyy}`;
    };
    return { fmt, fmtMoney, fmtDate };
}

const ESTADO_STYLE: Record<EncomendaEstado, { cls: string; label: string }> = {
    Aberta:    { cls: 'tbadge tbadge-campo',   label: 'Aberta' },
    Parcial:   { cls: 'tbadge tbadge-suporte', label: 'Parcial' },
    Recebida:  { cls: 'tbadge tbadge-admin',   label: 'Recebida' },
    Cancelada: { cls: 'tbadge tbadge-vendedor', label: 'Cancelada' },
};

/* ══ Receber Modal ══════════════════════════════════════════ */
interface ReceberModalProps {
    encomenda: Encomenda;
    onClose: () => void;
    onConfirm: (recebidas: { artigoId: string; qtd: number }[], armazem: string, guiaRemessa: string) => void;
}
const ReceberModal: React.FC<ReceberModalProps> = ({ encomenda, onClose, onConfirm }) => {
    const { armazens, fmt } = useGlobal();
    const armazensOpts = armazens.map(a => ({ value: a.codigo, label: `${a.codigo} — ${a.nome}` }));
    const defaultArmazem = armazens[0]?.codigo ?? '';

    const [qtds, setQtds]          = useState<Record<string, string>>(
        Object.fromEntries(
            encomenda.linhas.map(l => [l.artigoId, String(l.qtdEncomendada - l.qtdRecebida)])
        )
    );
    const [armazem,     setArmazem] = useState(defaultArmazem);
    const [guiaRemessa, setGuia]    = useState('');
    const [guiaErr,     setGuiaErr] = useState(false);

    const rececoesPrev = encomenda.rececoes.filter(r => r.estado === 'Ativa');

    const handleConfirm = () => {
        if (!guiaRemessa.trim()) { setGuiaErr(true); return; }
        const recebidas = encomenda.linhas
            .map(l => ({ artigoId: l.artigoId, qtd: Number(qtds[l.artigoId] ?? 0) }))
            .filter(r => r.qtd > 0);
        if (recebidas.length === 0) return;
        onConfirm(recebidas, armazem, guiaRemessa.trim());
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 580 }}>
                <div className="modal-header">
                    <h3 className="modal-title">Receber Encomenda — {encomenda.numero}</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body">
                    {rececoesPrev.length > 0 && (
                        <div style={{ background: 'var(--surface-alt,#f5f7fa)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: '0.78rem' }}>
                            <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-muted)' }}>Entregas anteriores ({rececoesPrev.length})</div>
                            {rececoesPrev.map(r => (
                                <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'center', paddingBottom: 3 }}>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--blue,#0D6EBF)' }}>{r.guiaRemessa}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>{new Date(r.dataHora).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>· {r.operador}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="form-row" style={{ marginBottom: 14 }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label req">Nº Guia de Remessa — Esta Entrega</label>
                            <input
                                className={`form-input${guiaErr ? ' err' : ''}`}
                                value={guiaRemessa}
                                onChange={e => { setGuia(e.target.value); setGuiaErr(false); }}
                                placeholder="Ex: GR-2026-001"
                                autoFocus
                            />
                            {guiaErr && <span className="form-error"><AlertCircle size={11} /> Obrigatório</span>}
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label req">Armazém de Destino</label>
                            <select className="form-select" value={armazem} onChange={e => setArmazem(e.target.value)}>
                                {armazensOpts.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                            </select>
                        </div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                        Indique as quantidades efectivamente recebidas nesta entrega:
                    </div>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Artigo</th>
                                <th style={{ textAlign: 'right' }}>Enc.</th>
                                <th style={{ textAlign: 'right' }}>Já rec.</th>
                                <th style={{ textAlign: 'right' }}>Pendente</th>
                                <th style={{ width: 90, textAlign: 'right' }}>Receber agora</th>
                            </tr>
                        </thead>
                        <tbody>
                            {encomenda.linhas.map(l => {
                                const pendente = l.qtdEncomendada - l.qtdRecebida;
                                return (
                                    <tr key={l.artigoId}>
                                        <td style={{ fontSize: '0.8rem' }}>
                                            <div style={{ fontWeight: 600 }}>{l.descricao}</div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.73rem' }}>{l.codigo}</div>
                                        </td>
                                        <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>{fmt(l.qtdEncomendada)}</td>
                                        <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{fmt(l.qtdRecebida)}</td>
                                        <td style={{ textAlign: 'right', fontSize: '0.8rem', color: pendente === 0 ? 'var(--green)' : 'var(--orange,#f97316)', fontWeight: 600 }}>
                                            {fmt(pendente)}
                                        </td>
                                        <td>
                                            <input type="number" min={0} max={pendente}
                                                className="form-input"
                                                style={{ textAlign: 'right', padding: '4px 8px', height: 30, fontSize: '0.8rem' }}
                                                value={qtds[l.artigoId] ?? ''}
                                                disabled={pendente === 0}
                                                onChange={e => setQtds(p => ({ ...p, [l.artigoId]: e.target.value }))}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="modal-footer">
                    <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                    <button type="button" className="abtn abtn-primary" onClick={handleConfirm}>
                        <Check size={12} /> Confirmar Recepção
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ══ Print Nota de Encomenda — abre janela A4 ══════════════ */
function printNotaEncomenda(encomenda: Encomenda, fornecedorNome: string, empresa?: EmpresaConfig, simbolo?: string) {
    const emp = empresa ?? {} as EmpresaConfig;
    const { fmt, fmtMoney, fmtDate } = makePrintFmt(emp, simbolo);
    const total = encTotal(encomenda);

    // Stamp config per estado
    const stampMap: Record<string, { label: string; color: string; bg: string; border: string }> = {
        Recebida:  { label: 'RECEBIDO',                 color: '#15803d', bg: 'rgba(21,128,61,0.08)',   border: '#15803d' },
        Parcial:   { label: 'PARCIALMENTE\nRECEBIDO',   color: '#b45309', bg: 'rgba(180,83,9,0.08)',    border: '#b45309' },
        Aberta:    { label: 'EM ABERTO',                color: '#0D6EBF', bg: 'rgba(13,110,191,0.08)',  border: '#0D6EBF' },
        Cancelada: { label: 'CANCELADA',                color: '#dc2626', bg: 'rgba(220,38,38,0.08)',   border: '#dc2626' },
    };
    const stamp = stampMap[encomenda.estado] ?? stampMap['Aberta'];
    const stampLines = stamp.label.split('\n');

    // Dates
    const dataGeracao = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const rececaoAtiva = [...(encomenda.rececoes ?? [])].filter(r => r.estado === 'Ativa').sort((a, b) => b.dataHora.localeCompare(a.dataHora));
    const dataUltimaRececao = rececaoAtiva.length > 0
        ? new Date(rececaoAtiva[0].dataHora).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } as any)
        : null;

    const linhasHtml = encomenda.linhas.map(l => `
        <tr>
            <td style="font-family:monospace">${l.codigo}</td>
            <td>${l.descricao}</td>
            <td style="text-align:center">${l.unidade}</td>
            <td style="text-align:right">${fmt(l.qtdEncomendada)}</td>
            <td style="text-align:right">${fmtMoney(l.custoUnit, encomenda.moeda)}</td>
            <td style="text-align:right">${l.desconto > 0 ? `${l.desconto}%` : '—'}</td>
            <td style="text-align:right;font-weight:600">${fmtMoney(linhaTotal(l), encomenda.moeda)}</td>
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
        <th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>${linhasHtml}</tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="6" style="text-align:right;padding-right:12px">TOTAL</td>
        <td style="text-align:right">${fmtMoney(total, encomenda.moeda)}</td>
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

    const w = window.open('', '_blank', 'width=794,height=1123');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
}

/* ══ Print Nota de Entrada — guia de recebimento A4 ════════ */
function printNotaEntrada(
    rececao: Rececao,
    encomenda: Encomenda,
    empresa?: EmpresaConfig,
    simbolo?: string,
) {
    const emp = empresa ?? {} as EmpresaConfig;
    const { fmt, fmtDate } = makePrintFmt(emp, simbolo);
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

    const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<title>Nota de Entrada — ${encomenda.numero}</title>
<style>
  @page { size: A4; margin: 18mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #1a1a1a; }
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

    const w = window.open('', '_blank', 'width=794,height=1123');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
}

/* ══ Encomenda Form Modal ═══════════════════════════════════ */
const TABS_E = [
    { id: 'cabecalho', label: 'Cabeçalho' },
    { id: 'artigos',   label: 'Artigos' },
    { id: 'recebido',  label: 'Recebido' },
] as const;
type ETab = typeof TABS_E[number]['id'];

interface EncomendaModalProps {
    encomenda?: Encomenda;
    onClose: () => void;
    onSave: (e: Omit<Encomenda, 'id' | 'numero'>) => void;
    onAnularRececao?: (rececaoId: string) => void;
}
const EncomendaModal: React.FC<EncomendaModalProps> = ({ encomenda, onClose, onSave, onAnularRececao }) => {
    const { fornecedores, artigos, currentUser, empresaConfig, fmt, fmtMoney } = useGlobal();
    const [tab, setTab] = useState<ETab>('cabecalho');

    // Cabeçalho
    const [fornecedorId,    setFornId]   = useState(encomenda?.fornecedorId          ?? '');
    const [data,            setData]     = useState(encomenda?.data                  ?? new Date().toISOString().split('T')[0]);
    const [dataEntrega,     setDataEnt]  = useState(encomenda?.dataEntrega            ?? '');
    const [condPagamento,   setCondPag]  = useState(encomenda?.condicoesPagamento     ?? '30 Dias');
    const [responsavel,     setResp]     = useState(encomenda?.responsavel            ?? currentUser?.nome ?? 'Administrador');
    const [moeda,           setMoeda]    = useState(encomenda?.moeda                  ?? 'AOA');
    const [descricao,       setDesc]     = useState(encomenda?.descricao              ?? '');
    const [observacoes,     setObs]      = useState(encomenda?.observacoes            ?? '');

    // Linhas artigos
    const [linhas, setLinhas] = useState<EncomendaLinha[]>(
        encomenda?.linhas ?? []
    );
    const [lineArtId, setLineArtId] = useState<string[]>(encomenda?.linhas.map(l => l.artigoId) ?? []);

    const fornOpts = fornecedores.map(f => ({ value: f.id, label: f.nome, sub: f.nif }));
    const artigoOpts = artigos.map(a => ({ value: a.id, label: a.descricao, sub: a.codigo }));

    const addLinha = () => {
        setLinhas(p => [...p, { artigoId: '', codigo: '', descricao: '', qtdEncomendada: 1, qtdRecebida: 0, unidade: 'UN', custoUnit: 0, desconto: 0 }]);
        setLineArtId(p => [...p, '']);
    };
    const removeLinha = (i: number) => {
        setLinhas(p => p.filter((_, j) => j !== i));
        setLineArtId(p => p.filter((_, j) => j !== i));
    };
    const updateLinha = <K extends keyof EncomendaLinha>(i: number, field: K, val: EncomendaLinha[K]) => {
        setLinhas(p => p.map((l, j) => j === i ? { ...l, [field]: val } : l));
    };
    const selectArtigo = (i: number, artigoId: string) => {
        const a = artigos.find(x => x.id === artigoId);
        if (a) {
            setLinhas(p => p.map((l, j) => j === i ? { ...l, artigoId: a.id, codigo: a.codigo, descricao: a.descricao, custoUnit: a.precoCusto || a.custoMedio || a.precoUnitario, unidade: 'UN' } : l));
        }
        setLineArtId(p => p.map((v, j) => j === i ? artigoId : v));
    };

    const [errors, setErrors] = useState<Record<string, string>>({});
    const validate = () => {
        const e: Record<string, string> = {};
        if (!fornecedorId) e.fornecedor = 'Obrigatório';
        if (!descricao.trim()) e.descricao = 'Obrigatório';
        if (linhas.length === 0) e.linhas = 'Adicione pelo menos uma linha';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSave = () => {
        if (!validate()) { setTab('cabecalho'); return; }
        const totalRec = linhas.reduce((s, l) => s + l.qtdRecebida, 0);
        const totalEnc = linhas.reduce((s, l) => s + l.qtdEncomendada, 0);
        const estado: EncomendaEstado = encomenda?.estado ?? 'Aberta';
        onSave({ fornecedorId, data, dataEntrega, condicoesPagamento: condPagamento, responsavel, moeda, descricao, observacoes, estado, linhas, rececoes: encomenda?.rececoes ?? [] });
    };

    const totalEnc  = linhas.reduce((s, l) => s + linhaTotal(l), 0);

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 760 }}>
                <div className="modal-header">
                    <h3 className="modal-title">{encomenda ? `Encomenda ${encomenda.numero}` : 'Nova Encomenda'}</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 20px' }}>
                    {TABS_E.map(t => (
                        <button key={t.id} type="button"
                            onClick={() => setTab(t.id)}
                            style={{
                                padding: '8px 14px', fontSize: '0.8rem', fontWeight: tab === t.id ? 600 : 400,
                                border: 'none', borderBottom: tab === t.id ? '2px solid var(--blue)' : '2px solid transparent',
                                background: 'none', cursor: 'pointer',
                                color: tab === t.id ? 'var(--blue)' : 'var(--text-secondary)',
                                marginBottom: -1,
                            }}>
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="modal-body">
                    {/* ── Cabeçalho ── */}
                    {tab === 'cabecalho' && (<>
                        <div className="form-row">
                            <div className="form-group" style={{ flex: 2 }}>
                                <label className="form-label req">Fornecedor</label>
                                <SearchableSelect
                                    options={fornOpts}
                                    value={fornecedorId}
                                    onChange={v => setFornId(v)}
                                    placeholder="Seleccionar fornecedor..."
                                />
                                {errors.fornecedor && <span className="form-error"><AlertCircle size={11} /> {errors.fornecedor}</span>}
                            </div>
                            <div className="form-group">
                                <label className="form-label req">Data</label>
                                <input type="date" className="form-input" value={data} onChange={e => setData(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Data Entrega</label>
                                <input type="date" className="form-input" value={dataEntrega} onChange={e => setDataEnt(e.target.value)} />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Cond. Pagamento</label>
                                <select className="form-select" value={condPagamento} onChange={e => setCondPag(e.target.value)}>
                                    <option value="Pronto Pagamento">Pronto Pagamento</option>
                                    <option value="15 Dias">15 Dias</option>
                                    <option value="30 Dias">30 Dias</option>
                                    <option value="30 - 30 Dias">30 - 30 Dias</option>
                                    <option value="60 Dias">60 Dias</option>
                                    <option value="90 Dias">90 Dias</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Responsável</label>
                                <input className="form-input" value={responsavel} readOnly style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'default' }} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Moeda</label>
                                <select className="form-select" value={moeda} onChange={e => setMoeda(e.target.value)}>
                                    <option value="AOA">AOA — Kwanza</option>
                                    <option value="USD">USD — Dólar</option>
                                    <option value="EUR">EUR — Euro</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label req">Descrição</label>
                            <input className={`form-input${errors.descricao ? ' err' : ''}`} value={descricao}
                                onChange={e => setDesc(e.target.value)} placeholder="Ex: Pedido Compra N.º 0000004" />
                            {errors.descricao && <span className="form-error"><AlertCircle size={11} /> {errors.descricao}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Observações</label>
                            <textarea className="form-input" rows={2} style={{ resize: 'vertical' }}
                                value={observacoes} onChange={e => setObs(e.target.value)}
                                placeholder="Notas internas..." />
                        </div>
                    </>)}

                    {/* ── Artigos ── */}
                    {tab === 'artigos' && (<>
                        {errors.linhas && (
                            <div style={{ color: 'var(--red,#ef4444)', fontSize: '0.8rem', marginBottom: 8 }}>
                                <AlertCircle size={11} style={{ marginRight: 4 }} />{errors.linhas}
                            </div>
                        )}
                        <table className="data-table" style={{ marginBottom: 8 }}>
                            <thead>
                                <tr>
                                    <th>Artigo</th>
                                    <th style={{ width: 50, textAlign: 'center' }}>UN</th>
                                    <th style={{ width: 70, textAlign: 'right' }}>Qtd</th>
                                    <th style={{ width: 110, textAlign: 'right' }}>Custo Unit.</th>
                                    <th style={{ width: 60, textAlign: 'right' }}>Desc%</th>
                                    <th style={{ width: 110, textAlign: 'right' }}>Total</th>
                                    <th style={{ width: 30 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {linhas.length === 0 && (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16, fontSize: '0.8rem' }}>
                                        Nenhuma linha. Clique em "Adicionar Linha".
                                    </td></tr>
                                )}
                                {linhas.map((l, i) => (
                                    <tr key={i}>
                                        <td>
                                            <SearchableSelect
                                                options={artigoOpts}
                                                value={lineArtId[i]}
                                                onChange={v => selectArtigo(i, v)}
                                                placeholder="Artigo..."
                                            />
                                            {l.codigo && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{l.codigo}</div>}
                                        </td>
                                        <td>
                                            <input className="form-input" style={{ textAlign: 'center', padding: '4px 6px', fontSize: '0.78rem' }}
                                                value={l.unidade} onChange={e => updateLinha(i, 'unidade', e.target.value)} />
                                        </td>
                                        <td>
                                            <input type="number" min={1} className="form-input"
                                                style={{ textAlign: 'right', padding: '4px 6px', fontSize: '0.78rem' }}
                                                value={l.qtdEncomendada}
                                                onChange={e => updateLinha(i, 'qtdEncomendada', Number(e.target.value))} />
                                        </td>
                                        <td>
                                            <input type="number" min={0} step="0.01" className="form-input"
                                                style={{ textAlign: 'right', padding: '4px 6px', fontSize: '0.78rem' }}
                                                value={l.custoUnit}
                                                onChange={e => updateLinha(i, 'custoUnit', Number(e.target.value))} />
                                        </td>
                                        <td>
                                            <input type="number" min={0} max={100} className="form-input"
                                                style={{ textAlign: 'right', padding: '4px 6px', fontSize: '0.78rem' }}
                                                value={l.desconto}
                                                onChange={e => updateLinha(i, 'desconto', Number(e.target.value))} />
                                        </td>
                                        <td style={{ textAlign: 'right', fontSize: '0.78rem', fontWeight: 600 }}>
                                            {fmt(Math.round(linhaTotal(l)))}
                                        </td>
                                        <td>
                                            <button type="button" className="icon-btn" title="Remover" onClick={() => removeLinha(i)}>
                                                <X size={11} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            {linhas.length > 0 && (
                                <tfoot>
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.82rem', paddingTop: 8 }}>Total Encomenda</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.88rem', color: 'var(--blue)', paddingTop: 8 }}>
                                            {fmtMoney(Math.round(totalEnc), moeda)}
                                        </td>
                                        <td />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                        <button type="button" className="abtn abtn-ghost" onClick={addLinha} style={{ fontSize: '0.78rem' }}>
                            <Plus size={12} /> Adicionar Linha
                        </button>
                    </>)}

                    {/* ── Recebido ── */}
                    {tab === 'recebido' && (
                        encomenda ? (<>
                            {/* ── Histórico de receções ── */}
                            {encomenda.rececoes.length > 0 ? (
                                <table className="data-table" style={{ marginBottom: 18 }}>
                                    <thead>
                                        <tr>
                                            <th>Data / Hora</th>
                                            <th>Guia Remessa</th>
                                            <th>Operador</th>
                                            <th>Armazém</th>
                                            <th style={{ textAlign: 'right' }}>Artigos</th>
                                            <th>Estado</th>
                                            <th style={{ textAlign: 'center' }}>Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {encomenda.rececoes.map(r => (
                                            <tr key={r.id} style={{ opacity: r.estado === 'Anulada' ? 0.5 : 1 }}>
                                                <td style={{ fontSize: '0.78rem' }}>
                                                    {new Date(r.dataHora).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem' }}>{r.guiaRemessa}</td>
                                                <td style={{ fontSize: '0.78rem' }}>{r.operador}</td>
                                                <td style={{ fontSize: '0.78rem' }}>{r.armazem}</td>
                                                <td style={{ textAlign: 'right', fontSize: '0.78rem' }}>{r.itens.length}</td>
                                                <td>
                                                    <span style={{
                                                        fontSize: '0.72rem', borderRadius: 10, padding: '2px 8px', fontWeight: 600,
                                                        background: r.estado === 'Ativa' ? '#dcfce7' : '#fee2e2',
                                                        color: r.estado === 'Ativa' ? '#16a34a' : '#dc2626',
                                                    }}>{r.estado}</span>
                                                </td>
                                                <td style={{ textAlign: 'center', display: 'flex', gap: 4, justifyContent: 'center' }}>
                                                    <button className="icon-btn" title="Reimprimir nota de entrada"
                                                        onClick={() => printNotaEntrada(r, encomenda, empresaConfig)}>
                                                        <Printer size={13} />
                                                    </button>
                                                    {r.estado === 'Ativa' && onAnularRececao && (
                                                        <button className="icon-btn" title="Anular receção" style={{ color: 'var(--red,#dc2626)' }}
                                                            onClick={() => onAnularRececao(r.id)}>
                                                            <Ban size={13} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '14px 0 18px' }}>
                                    Sem receções registadas.
                                </div>
                            )}
                            {/* ── Totais acumulados por artigo ── */}
                            <div style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                                Totais Acumulados
                            </div>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Artigo</th>
                                        <th style={{ textAlign: 'right' }}>Encomendado</th>
                                        <th style={{ textAlign: 'right' }}>Recebido</th>
                                        <th style={{ textAlign: 'right' }}>Pendente</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {linhas.map((l, i) => {
                                        const pendente = l.qtdEncomendada - l.qtdRecebida;
                                        return (
                                            <tr key={i}>
                                                <td style={{ fontSize: '0.8rem' }}>
                                                    <div style={{ fontWeight: 600 }}>{l.descricao}</div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.73rem' }}>{l.codigo}</div>
                                                </td>
                                                <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>{fmt(l.qtdEncomendada)}</td>
                                                <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--green)', fontWeight: 600 }}>{fmt(l.qtdRecebida)}</td>
                                                <td style={{ textAlign: 'right', fontSize: '0.8rem', color: pendente > 0 ? 'var(--orange,#f97316)' : 'var(--green)', fontWeight: 600 }}>{fmt(pendente)}</td>
                                                <td>
                                                    <span style={{
                                                        fontSize: '0.73rem', borderRadius: 10, padding: '2px 8px',
                                                        background: pendente === 0 ? '#dcfce7' : '#fffbeb',
                                                        color: pendente === 0 ? 'var(--green)' : 'var(--orange,#f97316)',
                                                        fontWeight: 600,
                                                    }}>
                                                        {pendente === 0 ? 'Recebido' : 'Pendente'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </>) : (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: 24 }}>
                                Guarde a encomenda para registar recepções.
                            </div>
                        )
                    )}
                </div>

                <div className="modal-footer">
                    <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                    <button type="button" className="abtn abtn-primary" onClick={handleSave}>
                        <Check size={12} /> Guardar
                    </button>
                </div>
            </div>
        </div>
    );
};

const COLS_ENC: ExportCol[] = [
    { key: 'numero',         label: 'Nº Encomenda' },
    { key: 'fornecedorNome', label: 'Fornecedor' },
    { key: 'data',           label: 'Data' },
    { key: 'dataEntrega',    label: 'Data Entrega' },
    { key: 'responsavel',    label: 'Responsável' },
    { key: 'estado',         label: 'Estado' },
    { key: 'total',          label: 'Total' },
];

/* ══ Converter em Encomenda Modal ═══════════════════════════ */
interface ConverterItem { artigoId: string; codigo: string; descricao: string; qtd: number; preco: number; }
interface ConverterModalProps {
    artigos: Artigo[];
    onClose: () => void;
    onConfirm: (fornecedorId: string, dataEntrega: string, descricao: string, items: ConverterItem[]) => void;
}
const ConverterModal: React.FC<ConverterModalProps> = ({ artigos, onClose, onConfirm }) => {
    const { fornecedores, fmt, fmtMoney } = useGlobal();
    const [fornId,      setFornId]  = useState('');
    const [dataEntrega, setDatEnt]  = useState('');
    const [descricao,   setDesc]    = useState(`Reposição de stock — ${new Date().toLocaleDateString('pt-PT')}`);
    const [err,         setErr]     = useState('');

    // One editable row per article
    type Row = { selected: boolean; qtd: string; preco: string };
    const [rows, setRows] = useState<Record<string, Row>>(() => {
        const init: Record<string, Row> = {};
        artigos.forEach(a => {
            const disp   = a.stockDisponivel ?? Math.max(0, a.existencia - a.stockReservado);
            const deficit = Math.max(1, Math.ceil(a.stockSeguranca - (disp + a.stockEncomendado)));
            const preco  = a.precoCusto || a.custoMedio || a.precoUnitario;
            init[a.id] = { selected: true, qtd: String(deficit), preco: String(preco) };
        });
        return init;
    });

    const fornOpts = fornecedores.map(f => ({ value: f.id, label: f.nome, sub: f.nif }));
    const allSelected = artigos.every(a => rows[a.id]?.selected);

    const toggleAll = () => {
        setRows(p => {
            const next = { ...p };
            artigos.forEach(a => { next[a.id] = { ...next[a.id], selected: !allSelected }; });
            return next;
        });
    };

    const setField = (id: string, field: 'selected' | 'qtd' | 'preco', val: string | boolean) =>
        setRows(p => ({ ...p, [id]: { ...p[id], [field]: val } }));

    const selectedItems = artigos.filter(a => rows[a.id]?.selected);
    const total = selectedItems.reduce((s, a) => {
        const r = rows[a.id];
        return s + (Number(r?.qtd) || 0) * (Number(r?.preco) || 0);
    }, 0);

    const handleConfirm = () => {
        if (!fornId) { setErr('Seleccione um fornecedor'); return; }
        if (!descricao.trim()) { setErr('Introduza uma descrição'); return; }
        if (selectedItems.length === 0) { setErr('Seleccione pelo menos um artigo'); return; }
        const items: ConverterItem[] = selectedItems.map(a => ({
            artigoId: a.id, codigo: a.codigo, descricao: a.descricao,
            qtd: Math.max(1, Number(rows[a.id]?.qtd) || 1),
            preco: Math.max(0, Number(rows[a.id]?.preco) || 0),
        }));
        onConfirm(fornId, dataEntrega, descricao, items);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 860 }}>
                <div className="modal-header">
                    <h3 className="modal-title">Converter em Encomenda</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                    {/* Cabeçalho encomenda */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label req">Fornecedor</label>
                            <SearchableSelect options={fornOpts} value={fornId} onChange={setFornId} placeholder="Seleccionar fornecedor..." />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label req">Descrição</label>
                            <input className="form-input" value={descricao} onChange={e => setDesc(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Data Entrega</label>
                            <input type="date" className="form-input" value={dataEntrega} onChange={e => setDatEnt(e.target.value)} />
                        </div>
                    </div>
                    {err && <div style={{ color: 'var(--red,#ef4444)', fontSize: '0.78rem', marginBottom: 10 }}><AlertCircle size={11} /> {err}</div>}

                    {/* Tabela de artigos */}
                    <table className="data-table" style={{ fontSize: '0.8rem' }}>
                        <thead>
                            <tr>
                                <th style={{ width: 32, textAlign: 'center' }}>
                                    <input type="checkbox" checked={allSelected} onChange={toggleAll} title={allSelected ? 'Desmarcar todos' : 'Seleccionar todos'} />
                                </th>
                                <th>Artigo</th>
                                <th style={{ textAlign: 'right', width: 80 }}>Défice</th>
                                <th style={{ textAlign: 'right', width: 100 }}>Qtd. Enc.</th>
                                <th style={{ textAlign: 'right', width: 130 }}>Preço Compra</th>
                                <th style={{ textAlign: 'right', width: 130 }}>Total Linha</th>
                            </tr>
                        </thead>
                        <tbody>
                            {artigos.map(a => {
                                const disp   = a.stockDisponivel ?? Math.max(0, a.existencia - a.stockReservado);
                                const deficit = Math.max(0, a.stockSeguranca - (disp + a.stockEncomendado));
                                const r = rows[a.id] ?? { selected: false, qtd: '0', preco: '0' };
                                const linhaTotal = (Number(r.qtd) || 0) * (Number(r.preco) || 0);
                                return (
                                    <tr key={a.id} style={{ opacity: r.selected ? 1 : 0.45 }}>
                                        <td style={{ textAlign: 'center' }}>
                                            <input type="checkbox" checked={r.selected}
                                                onChange={e => setField(a.id, 'selected', e.target.checked)} />
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{a.descricao}</div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'monospace' }}>{a.codigo}</div>
                                        </td>
                                        <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>{fmt(deficit)}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <input type="number" min={1} step={1}
                                                className="form-input"
                                                style={{ width: 90, textAlign: 'right', padding: '3px 6px', height: 28, fontSize: '0.8rem' }}
                                                value={r.qtd}
                                                disabled={!r.selected}
                                                onChange={e => setField(a.id, 'qtd', e.target.value)} />
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <input type="number" min={0} step={0.01}
                                                className="form-input"
                                                style={{ width: 120, textAlign: 'right', padding: '3px 6px', height: 28, fontSize: '0.8rem' }}
                                                value={r.preco}
                                                disabled={!r.selected}
                                                onChange={e => setField(a.id, 'preco', e.target.value)} />
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: r.selected ? 600 : 400 }}>
                                            {fmtMoney(linhaTotal, a.moeda)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.83rem', padding: '8px 12px', borderTop: '2px solid var(--blue)' }}>
                                    TOTAL ({selectedItems.length} artigo(s) seleccionado(s))
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.9rem', color: 'var(--blue)', padding: '8px 12px', borderTop: '2px solid var(--blue)' }}>
                                    {fmtMoney(total)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div className="modal-footer">
                    <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                    <button type="button" className="abtn abtn-primary" onClick={handleConfirm}>
                        <ShoppingBag size={12} /> Criar Encomenda ({selectedItems.length})
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ══ Print Sugestões ═════════════════════════════════════════ */
function printSugestoes(artigos: Artigo[], empresa?: EmpresaConfig, simbolo?: string) {
    const emp = empresa ?? {} as EmpresaConfig;
    const { fmt, fmtMoney, fmtDate } = makePrintFmt(emp, simbolo);
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
<title>Sugestões de Compra</title>
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
<h1>Sugestões de Compra — Rupturas de Stock</h1>
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

    const w = window.open('', '_blank', 'width=794,height=1123');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
}

/* ══ Page ════════════════════════════════════════════════════ */
const EncomendaPage: React.FC = () => {
    const { encomendas, addEncomenda, updateEncomenda, criarRececao, anularRececao, fornecedores, artigos: todosArtigos, updateArtigo, addMovimento, currentUser, empresaConfig, fmtMoney, fmtDate, fmt, simboloMoeda } = useGlobal();

    const [pageTab,   setPageTab]   = useState<'encomendas' | 'sugestoes'>('encomendas');
    const [search,    setSearch]    = useState('');
    const [filterEst, setFEst]      = useState('');
    const [modal,     setModal]     = useState<'new' | string | null>(null);
    const [receber,   setReceber]   = useState<string | null>(null);
    const [printId,   setPrintId]   = useState<string | null>(null);
    const [rececDropdown, setRececDropdown] = useState<string | null>(null);
    const [toast,      setToast]     = useState('');

    // Close dropdown when clicking outside
    useEffect(() => {
        if (!rececDropdown) return;
        const handler = () => setRececDropdown(null);
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [rececDropdown]);
    const [showExport, setShowExport] = useState(false);

    // Sugestões de Compra state
    const [sugSearch,     setSugSearch]   = useState('');
    const [sugClasse,     setSugClasse]   = useState('');
    const [sugFamilia,    setSugFamilia]  = useState('');
    const [sugCritico,    setSugCritico]  = useState(false);
    const [showConverter, setShowConverter] = useState(false);

    const artigosRuptura = useMemo(() =>
        todosArtigos.filter(a => a.emRuptura && !a.inativo),
        [todosArtigos]
    );

    const classesDisponiveis  = useMemo(() => Array.from(new Set(artigosRuptura.map(a => a.classe).filter(Boolean))).sort(), [artigosRuptura]);
    const familiasDisponiveis = useMemo(() => Array.from(new Set(artigosRuptura.map(a => a.familia).filter(Boolean))).sort(), [artigosRuptura]);

    const artigosRupturaFiltrados = useMemo(() => artigosRuptura.filter(a => {
        const q = sugSearch.toLowerCase();
        return (!q || a.codigo.toLowerCase().includes(q) || a.descricao.toLowerCase().includes(q))
            && (!sugClasse   || a.classe   === sugClasse)
            && (!sugFamilia  || a.familia  === sugFamilia)
            && (!sugCritico  || a.critico);
    }), [artigosRuptura, sugSearch, sugClasse, sugFamilia, sugCritico]);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    const getFornNome = (id: string) => fornecedores.find(f => f.id === id)?.nome ?? id;

    const filtered = encomendas.filter(e => {
        const q = search.toLowerCase();
        const matchQ = !q || e.numero.toLowerCase().includes(q) || e.descricao.toLowerCase().includes(q) || getFornNome(e.fornecedorId).toLowerCase().includes(q);
        const matchE = !filterEst || e.estado === filterEst;
        return matchQ && matchE;
    });

    const exportData = filtered.map(e => ({
        ...e,
        fornecedorNome: getFornNome(e.fornecedorId),
        data: fmtDate(e.data),
        dataEntrega: fmtDate(e.dataEntrega),
        total: Math.round(encTotal(e)),
    }));

    // Stats
    const abertas   = encomendas.filter(e => e.estado === 'Aberta').length;
    const parciais  = encomendas.filter(e => e.estado === 'Parcial').length;
    const recebidas = encomendas.filter(e => e.estado === 'Recebida').length;
    const valorAberto = encomendas.filter(e => e.estado !== 'Cancelada' && e.estado !== 'Recebida').reduce((s, e) => s + encTotal(e), 0);

    const editTarget  = typeof modal === 'string' && modal !== 'new' ? encomendas.find(e => e.id === modal) : undefined;
    const receberEnc  = receber ? encomendas.find(e => e.id === receber) : null;
    const printEnc    = printId ? encomendas.find(e => e.id === printId) : null;

    const handleSave = (data: Omit<Encomenda, 'id' | 'numero'>) => {
        if (typeof modal === 'string' && modal !== 'new') {
            updateEncomenda(modal, data);
            showToast('Encomenda actualizada.');
        } else {
            const numero = `N-${String(encomendas.length + 1).padStart(6, '0')}`;
            const e = addEncomenda({ ...data, numero });
            showToast(`Encomenda ${e.numero} criada.`);
        }
        setModal(null);
    };

    const handleReceber = async (encId: string, recebidas: { artigoId: string; qtd: number }[], armazem: string, guiaRemessa: string) => {
        try {
            const updatedEnc = await criarRececao(encId, recebidas, guiaRemessa, currentUser?.nome ?? 'Operador', armazem);
            const hoje = new Date().toISOString().split('T')[0];
            recebidas.forEach(r => {
                updateArtigo(r.artigoId, { codigoArmazem: armazem });
                addMovimento({ artigoId: r.artigoId, tipo: 'entrada', quantidade: r.qtd, armazemId: armazem, referencia: encId, usuario: currentUser?.email, observacao: `Recepção ${encId} · GR: ${guiaRemessa}`, data: hoje });
            });
            // Find the newly created rececao (most recent Ativa)
            const newRececao = [...updatedEnc.rececoes]
                .filter(r => r.estado === 'Ativa')
                .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())[0];
            if (newRececao) printNotaEntrada(newRececao, updatedEnc, empresaConfig, simboloMoeda);
            showToast(`Recepção registada → ${armazem}. Stock actualizado.`);
        } catch { showToast('Erro ao registar recepção.'); }
    };

    const handleAnularRececao = async (rececaoId: string) => {
        if (!window.confirm('Anular esta receção irá reverter o stock e os acumulados. Confirmar?')) return;
        try {
            await anularRececao(rececaoId);
            showToast('Receção anulada. Stock revertido.');
        } catch { showToast('Erro ao anular receção.'); }
    };

    const handleCancelar = (id: string) => {
        updateEncomenda(id, { estado: 'Cancelada' });
        showToast('Encomenda cancelada.');
    };

    const handleConverterEmEncomenda = (fornecedorId: string, dataEntrega: string, descricao: string, items: ConverterItem[]) => {
        const today = new Date().toISOString().split('T')[0];
        const numero = `N-${String(encomendas.length + 1).padStart(6, '0')}`;
        const linhas: EncomendaLinha[] = items.map(item => ({
            artigoId: item.artigoId, codigo: item.codigo, descricao: item.descricao,
            qtdEncomendada: item.qtd, qtdRecebida: 0,
            unidade: 'UN', custoUnit: item.preco, desconto: 0,
        }));
        addEncomenda({ numero, fornecedorId, data: today, dataEntrega, condicoesPagamento: '30 Dias', responsavel: currentUser?.nome ?? '', moeda: 'AOA', descricao, estado: 'Aberta', linhas, rececoes: [] });
        showToast(`Encomenda ${numero} criada com ${linhas.length} artigo(s).`);
        setPageTab('encomendas');
    };

    return (
        <AppLayout>
            <ActionBar title="Encomendas" breadcrumb="AQUATEX SGI · Encomendas">
                <div className="actionbar-spacer" />
                {pageTab === 'encomendas' && (
                    <button className="abtn abtn-secondary" type="button" onClick={() => setShowExport(true)}>
                        <Download size={13} /> Exportar
                    </button>
                )}
                {pageTab === 'sugestoes' && artigosRupturaFiltrados.length > 0 && (<>
                    <button className="abtn abtn-secondary" type="button" onClick={() => printSugestoes(artigosRupturaFiltrados, empresaConfig, simboloMoeda)}>
                        <Printer size={13} /> Imprimir Lista
                    </button>
                    <button className="abtn abtn-primary" type="button" onClick={() => setShowConverter(true)}>
                        <ShoppingBag size={13} /> Converter em Encomenda
                    </button>
                </>)}
                {pageTab === 'encomendas' && (
                    <button className="abtn abtn-primary" type="button" onClick={() => setModal('new')}>
                        <Plus size={13} /> Nova Encomenda
                    </button>
                )}
            </ActionBar>

            <div className="page-content">
                {/* Page-level tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
                    {([
                        { id: 'encomendas', label: 'Encomendas' },
                        { id: 'sugestoes',  label: `Sugestões de Compra${artigosRuptura.length > 0 ? ` (${artigosRuptura.length})` : ''}` },
                    ] as const).map(t => (
                        <button key={t.id} type="button" onClick={() => setPageTab(t.id)} style={{
                            padding: '8px 16px', fontSize: '0.82rem', fontWeight: pageTab === t.id ? 700 : 400,
                            border: 'none', borderBottom: pageTab === t.id ? '2px solid var(--blue)' : '2px solid transparent',
                            background: 'none', cursor: 'pointer', marginBottom: -1,
                            color: pageTab === t.id ? 'var(--blue)' : 'var(--text-secondary)',
                        }}>
                            {t.id === 'sugestoes' && artigosRuptura.length > 0 && (
                                <TrendingDown size={12} style={{ marginRight: 4, color: '#dc2626', verticalAlign: 'middle' }} />
                            )}
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* ── Encomendas Tab ── */}
                {pageTab === 'encomendas' && (<>
                {/* Stats */}
                <div className="stats-row">
                    {[
                        { label: 'Em Aberto',         value: abertas,           cls: 'blue' },
                        { label: 'Parcialmente Rec.',  value: parciais,          cls: 'orange' },
                        { label: 'Recebidas',          value: recebidas,         cls: 'green' },
                        { label: 'Valor em Aberto',    value: fmtMoney(valorAberto), cls: 'blue' },
                    ].map(s => (
                        <div key={s.label} className="stat-card">
                            <span className="stat-label">{s.label}</span>
                            <span className={`stat-value ${s.cls}`}>{s.value}</span>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="filters-bar">
                    <div className="search-wrap">
                        <Search className="search-icon" />
                        <input className="search-input" placeholder="Pesquisar por número, fornecedor ou descrição..."
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select className="filter-select" value={filterEst} onChange={e => setFEst(e.target.value)}>
                        <option value="">Todos os estados</option>
                        <option value="Aberta">Aberta</option>
                        <option value="Parcial">Parcial</option>
                        <option value="Recebida">Recebida</option>
                        <option value="Cancelada">Cancelada</option>
                    </select>
                </div>

                {/* Table */}
                <div className="table-container">
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 20 }} />
                                    <th>Nº Encomenda</th>
                                    <th>Fornecedor</th>
                                    <th>Data</th>
                                    <th>Data Entrega</th>
                                    <th>Responsável</th>
                                    <th style={{ textAlign: 'right' }}>Total</th>
                                    <th>Estado</th>
                                    <th style={{ width: 130 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr><td colSpan={9}><div className="empty-state"><ShoppingCart size={28} /><br />Nenhuma encomenda encontrada.</div></td></tr>
                                )}
                                {filtered.map(e => {
                                    const vencida = e.dataEntrega && e.estado === 'Aberta' && new Date(e.dataEntrega) < new Date();
                                    return (
                                        <tr key={e.id} style={{ opacity: e.estado === 'Cancelada' ? 0.5 : 1 }}>
                                            <td style={{ paddingLeft: 10 }}>
                                                <span className={`dot ${e.estado === 'Recebida' ? 'dot-green' : e.estado === 'Parcial' ? 'dot-orange' : e.estado === 'Cancelada' ? 'dot-gray' : vencida ? 'dot-red' : 'dot-blue'}`} />
                                            </td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 600, color: 'var(--blue)' }}>
                                                {e.numero}
                                            </td>
                                            <td style={{ fontWeight: 600, fontSize: '0.83rem' }}>{getFornNome(e.fornecedorId)}</td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fmtDate(e.data)}</td>
                                            <td style={{ fontSize: '0.78rem', color: vencida ? 'var(--red,#ef4444)' : 'var(--text-muted)', fontWeight: vencida ? 600 : 400 }}>
                                                {fmtDate(e.dataEntrega)}
                                                {vencida && ' ⚠'}
                                            </td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{e.responsavel || '—'}</td>
                                            <td style={{ textAlign: 'right', fontSize: '0.78rem', fontWeight: 600 }}>
                                                {fmtMoney(Math.round(encTotal(e)), e.moeda)}
                                            </td>
                                            <td>
                                                <span className={ESTADO_STYLE[e.estado].cls}>{ESTADO_STYLE[e.estado].label}</span>
                                            </td>
                                            <td>
                                                <div className="row-actions" style={{ gap: 4 }}>
                                                    <button className="icon-btn" title="Editar" onClick={() => setModal(e.id)}>
                                                        <Package size={12} />
                                                    </button>
                                                    {(e.estado === 'Aberta' || e.estado === 'Parcial') && (
                                                        <button className="abtn abtn-ghost" title="Receber" style={{ fontSize: '0.72rem', padding: '2px 8px', height: 24 }}
                                                            onClick={() => setReceber(e.id)}>
                                                            <Archive size={11} /> Receber
                                                        </button>
                                                    )}
                                                    <button className="icon-btn" title="Imprimir nota de encomenda" onClick={() => printNotaEncomenda(e, getFornNome(e.fornecedorId), empresaConfig, simboloMoeda)}>
                                                        <Printer size={12} />
                                                    </button>
                                                    {e.rececoes?.filter(r => r.estado === 'Ativa').length > 0 && (() => {
                                                        const ativas = [...e.rececoes.filter(r => r.estado === 'Ativa')]
                                                            .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
                                                        if (ativas.length === 1) {
                                                            return (
                                                                <button className="icon-btn" title="Reimprimir nota de entrada"
                                                                    style={{ color: '#16a34a' }}
                                                                    onClick={() => printNotaEntrada(ativas[0], e, empresaConfig, simboloMoeda)}>
                                                                    <RotateCcw size={12} />
                                                                </button>
                                                            );
                                                        }
                                                        return (
                                                            <div style={{ position: 'relative' }}>
                                                                <button className="icon-btn" title={`Reimprimir notas de entrada (${ativas.length} entregas)`}
                                                                    style={{ color: '#16a34a' }}
                                                                    onClick={ev => { ev.stopPropagation(); setRececDropdown(rececDropdown === e.id ? null : e.id); }}>
                                                                    <RotateCcw size={12} />
                                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, marginLeft: 2 }}>{ativas.length}</span>
                                                                </button>
                                                                {rececDropdown === e.id && (
                                                                    <div style={{
                                                                        position: 'absolute', right: 0, top: '100%', zIndex: 200,
                                                                        background: 'var(--surface,#fff)', border: '1px solid var(--border)',
                                                                        borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                                                                        minWidth: 220, padding: '4px 0',
                                                                    }} onClick={ev => ev.stopPropagation()}>
                                                                        <div style={{ padding: '6px 12px 4px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>
                                                                            Notas de Entrada
                                                                        </div>
                                                                        {ativas.map((r, idx) => (
                                                                            <button key={r.id} style={{
                                                                                display: 'flex', flexDirection: 'column', gap: 1,
                                                                                width: '100%', padding: '7px 12px', border: 'none',
                                                                                background: 'none', cursor: 'pointer', textAlign: 'left',
                                                                            }}
                                                                                onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--bg-hover,#f5f7fa)')}
                                                                                onMouseLeave={ev => (ev.currentTarget.style.background = 'none')}
                                                                                onClick={() => { printNotaEntrada(r, e, empresaConfig); setRececDropdown(null); }}>
                                                                                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: '#16a34a' }}>{r.guiaRemessa}</span>
                                                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                                                    {new Date(r.dataHora).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                                    {idx === 0 ? ' — última' : ''}
                                                                                </span>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="table-count">{filtered.length} encomendas</div>
                </div>
                </>)}

                {/* ── Sugestões de Compra Tab ── */}
                {pageTab === 'sugestoes' && (<>
                    {/* Stats */}
                    <div className="stats-row">
                        {[
                            { label: 'Artigos em Ruptura',   value: artigosRuptura.length,                                               cls: 'red' },
                            { label: 'Críticos em Ruptura',  value: artigosRuptura.filter(a => a.critico).length,                        cls: 'orange' },
                            { label: 'Valor Estimado Compra',value: fmtMoney(artigosRupturaFiltrados.reduce((s, a) => {
                                    const disp = a.stockDisponivel ?? Math.max(0, a.existencia - a.stockReservado);
                                    const def = Math.max(0, a.stockSeguranca - (disp + a.stockEncomendado));
                                    return s + def * (a.precoCusto || a.custoMedio || a.precoUnitario);
                                }, 0)),                                                                                                   cls: 'blue' },
                            { label: 'Filtrados',             value: artigosRupturaFiltrados.length,                                     cls: 'blue' },
                        ].map(s => (
                            <div key={s.label} className="stat-card">
                                <span className="stat-label">{s.label}</span>
                                <span className={`stat-value ${s.cls}`}>{s.value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="filters-bar">
                        <div className="search-wrap">
                            <Search className="search-icon" />
                            <input className="search-input" placeholder="Pesquisar por código ou descrição..."
                                value={sugSearch} onChange={e => setSugSearch(e.target.value)} />
                        </div>
                        <select className="filter-select" value={sugClasse} onChange={e => setSugClasse(e.target.value)}>
                            <option value="">Todas as classes</option>
                            {classesDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select className="filter-select" value={sugFamilia} onChange={e => setSugFamilia(e.target.value)}>
                            <option value="">Todas as famílias</option>
                            {familiasDisponiveis.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <input type="checkbox" checked={sugCritico} onChange={e => setSugCritico(e.target.checked)} />
                            Apenas críticos
                        </label>
                    </div>

                    {/* Table */}
                    <div className="table-container">
                        <div className="table-scroll">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Código</th>
                                        <th>Descrição</th>
                                        <th>Classe</th>
                                        <th style={{ textAlign: 'right' }}>Disponível</th>
                                        <th style={{ textAlign: 'right' }}>Encomendado</th>
                                        <th style={{ textAlign: 'right' }}>Stock Seg.</th>
                                        <th style={{ textAlign: 'right' }}>Défice</th>
                                        <th style={{ textAlign: 'right' }}>Preço Compra</th>
                                        <th style={{ textAlign: 'right' }}>Total Est.</th>
                                        <th>Crítico</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {artigosRupturaFiltrados.length === 0 && (
                                        <tr><td colSpan={10}>
                                            <div className="empty-state">
                                                <TrendingDown size={28} />
                                                <br />{artigosRuptura.length === 0
                                                    ? 'Nenhum artigo em ruptura de stock.'
                                                    : 'Nenhum artigo corresponde aos filtros.'}
                                            </div>
                                        </td></tr>
                                    )}
                                    {artigosRupturaFiltrados.map(a => {
                                        const disp   = a.stockDisponivel ?? Math.max(0, a.existencia - a.stockReservado);
                                        const deficit = Math.max(0, a.stockSeguranca - (disp + a.stockEncomendado));
                                        const preco  = a.precoCusto || a.custoMedio || a.precoUnitario;
                                        return (
                                            <tr key={a.id}>
                                                <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 600, color: 'var(--blue)' }}>{a.codigo}</td>
                                                <td style={{ fontWeight: 600, fontSize: '0.83rem' }}>{a.descricao}</td>
                                                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{a.classe}</td>
                                                <td style={{ textAlign: 'right', fontSize: '0.8rem', color: disp === 0 ? 'var(--red,#ef4444)' : 'var(--text-secondary)', fontWeight: 600 }}>{fmt(disp)}</td>
                                                <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--blue)' }}>{fmt(a.stockEncomendado)}</td>
                                                <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{fmt(a.stockSeguranca)}</td>
                                                <td style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: '#dc2626' }}>{fmt(deficit)}</td>
                                                <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>{fmtMoney(preco, a.moeda)}</td>
                                                <td style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: 'var(--orange,#f97316)' }}>{fmtMoney(deficit * preco, a.moeda)}</td>
                                                <td>{a.critico && <span style={{ fontSize: '0.72rem', background: '#fee2e2', color: '#dc2626', borderRadius: 10, padding: '2px 8px', fontWeight: 600 }}>Crítico</span>}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="table-count">{artigosRupturaFiltrados.length} artigo(s) em ruptura</div>
                    </div>
                </>)}
            </div>

            {/* Modals */}
            {modal !== null && (
                <EncomendaModal
                    encomenda={editTarget}
                    onClose={() => setModal(null)}
                    onSave={handleSave}
                    onAnularRececao={handleAnularRececao}
                />
            )}

            {receberEnc && (
                <ReceberModal
                    encomenda={receberEnc}
                    onClose={() => setReceber(null)}
                    onConfirm={(rec, arm, guia) => handleReceber(receberEnc.id, rec, arm, guia)}
                />
            )}

            {/* PrintModal replaced by printNotaEncomenda() */}

            {showConverter && (
                <ConverterModal
                    artigos={artigosRupturaFiltrados}
                    onClose={() => setShowConverter(false)}
                    onConfirm={handleConverterEmEncomenda}
                />
            )}

            {showExport && (
                <ExportModal
                    title="Encomendas"
                    columns={COLS_ENC}
                    data={exportData}
                    filename="encomendas"
                    onClose={() => setShowExport(false)}
                />
            )}

            {toast && (
                <div className="toast" role="status">
                    <Check size={14} strokeWidth={2.5} style={{ color: 'var(--green)' }} />
                    <span>{toast}</span>
                </div>
            )}
        </AppLayout>
    );
};

export default EncomendaPage;
