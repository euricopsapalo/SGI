import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom';
import AppLayout from '../../components/Layout/AppLayout';
import { showToast as notify } from '../../utils/errorHandler';
import ActionBar from '../../components/Layout/ActionBar';
import SearchableSelect from '../../components/SearchableSelect';
import {
    useGlobal, Encomenda, EncomendaLinha, EncomendaEstado, EmpresaConfig, Artigo, TaxaIva,
    Rececao, FaturaFornecedor,
    CondicaoPagamento, ModoPagamento, Fornecedor,
} from '../../contexts/GlobalContext';
import { useConfirm } from '../../components/useConfirm';
import EmptyState from '../../components/EmptyState';
import TableSkeleton from '../../components/TableSkeleton';
import {
    Search, Plus, X, AlertCircle, Check, ShoppingCart,
    Package, Printer, Archive, Download, TrendingDown, ShoppingBag,
    Ban, RotateCcw, Eye, BarChart2, Clock, AlertTriangle, CheckCircle2,
    CalendarDays, ListFilter, FileText, CreditCard, Wallet,
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
    Aberta:    { cls: 'tbadge tbadge-campo',    label: 'Aberta' },
    Aprovada:  { cls: 'tbadge tbadge-active',   label: 'Aprovada' },
    Parcial:   { cls: 'tbadge tbadge-suporte',  label: 'Parcial' },
    Recebida:  { cls: 'tbadge tbadge-admin',    label: 'Recebida' },
    Cancelada: { cls: 'tbadge tbadge-vendedor', label: 'Cancelada' },
    Faturada:  { cls: 'tbadge tbadge-vendedor', label: 'Faturada' },
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
                    <button className="modal-close" aria-label="Fechar" type="button" onClick={onClose}><X size={13} /></button>
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
function buildNotaEncomendaHtml(encomenda: Encomenda, fornecedorNome: string, empresa?: EmpresaConfig, simbolo?: string, artigos?: Artigo[], taxasIva?: TaxaIva[]): string {
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

function printNotaEncomenda(encomenda: Encomenda, fornecedorNome: string, empresa?: EmpresaConfig, simbolo?: string, artigos?: Artigo[], taxasIva?: TaxaIva[]) {
    const html = buildNotaEncomendaHtml(encomenda, fornecedorNome, empresa, simbolo, artigos, taxasIva);
    const w = window.open('', '_blank', 'width=794,height=1123');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
}

/* ══ Print Nota de Entrada — guia de recebimento A4 ════════ */
function buildNotaEntradaHtml(
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

function printNotaEntrada(
    rececao: Rececao,
    encomenda: Encomenda,
    empresa?: EmpresaConfig,
    simbolo?: string,
) {
    const html = buildNotaEntradaHtml(rececao, encomenda, empresa, simbolo);
    const w = window.open('', '_blank', 'width=794,height=1123');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
}

/* ══ Print Fatura Fornecedor (VFA / VFR) ════════════════════ */
function buildFaturaFornecedorHtml(
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
function buildVNCHtml(
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

function printDocFornecedor(html: string) {
    const w = window.open('', '_blank', 'width=794,height=1123');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
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
    const { fornecedores, artigos, taxasIva, currentUser, empresaConfig, fmt, fmtMoney } = useGlobal();
    const [tab, setTab] = useState<ETab>('cabecalho');

    // Cabeçalho
    const [fornecedorId,    setFornId]   = useState(encomenda?.fornecedorId          ?? '');
    const [data,            setData]     = useState(encomenda?.data                  ?? new Date().toISOString().split('T')[0]);
    const [dataEntrega,     setDataEnt]  = useState(encomenda?.dataEntrega            ?? '');
    const [condPagamento,   setCondPag]  = useState(encomenda?.condicoesPagamento     ?? '30 Dias');
    const [responsavel]                  = useState(encomenda?.responsavel            ?? currentUser?.nome ?? 'Administrador');
    const [moeda,           setMoeda]    = useState(encomenda?.moeda                  ?? 'AOA');
    const [descricao,       setDesc]     = useState(encomenda?.descricao              ?? '');
    const [observacoes,     setObs]      = useState(encomenda?.observacoes            ?? '');

    // Linhas artigos — fallback: derivar taxaIva do artigo se não estiver persistido
    const [linhas, setLinhas] = useState<EncomendaLinha[]>(() =>
        (encomenda?.linhas ?? []).map(l => {
            if ((l.taxaIva ?? 0) !== 0) return l;
            const art = artigos.find(a => a.id === l.artigoId);
            if (!art?.codigoIva) return l;
            const taxa = taxasIva.find(t => t.codigo === art.codigoIva)?.taxa ?? 0;
            return { ...l, codigoIva: art.codigoIva, taxaIva: taxa };
        })
    );
    const [lineArtId, setLineArtId] = useState<string[]>(encomenda?.linhas.map(l => l.artigoId) ?? []);

    const fornOpts = fornecedores.map(f => ({ value: f.id, label: f.nome, sub: f.nif }));
    const artigosFornecedor = fornecedorId
        ? artigos.filter(a => a.refFornecedor === fornecedorId)
        : artigos;
    const artigoOpts = artigosFornecedor.map(a => ({ value: a.id, label: a.descricao, sub: a.codigo }));

    const addLinha = () => {
        setLinhas(p => [...p, { artigoId: '', codigo: '', descricao: '', qtdEncomendada: 1, qtdRecebida: 0, unidade: 'UN', custoUnit: 0, desconto: 0, taxaIva: 0 }]);
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
            const taxaIva = a.codigoIva ? (taxasIva.find(t => t.codigo === a.codigoIva)?.taxa ?? 0) : 0;
            setLinhas(p => p.map((l, j) => j === i ? {
                ...l, artigoId: a.id, codigo: a.codigo, descricao: a.descricao,
                custoUnit: a.precoCusto || a.custoMedio || a.precoUnitario,
                unidade: a.unidadeMedida || 'UN',
                codigoIva: a.codigoIva || undefined, taxaIva,
            } : l));
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
        const estado: EncomendaEstado = encomenda?.estado ?? 'Aberta';
        onSave({ fornecedorId, data, dataEntrega, condicoesPagamento: condPagamento, responsavel, moeda, descricao, observacoes, estado, linhas, rececoes: encomenda?.rececoes ?? [] });
    };

    const subtotalEnc = linhas.reduce((s, l) => s + linhaTotal(l), 0);
    const totalIvaEnc = linhas.reduce((s, l) => s + linhaTotal(l) * ((l.taxaIva ?? 0) / 100), 0);
    const totalEnc    = subtotalEnc + totalIvaEnc;

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 760 }}>
                <div className="modal-header">
                    <h3 className="modal-title">{encomenda ? `Encomenda ${encomenda.numero}` : 'Nova Encomenda'}</h3>
                    <button className="modal-close" aria-label="Fechar" type="button" onClick={onClose}><X size={13} /></button>
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
                        {/* Grupo: Entidade */}
                        <div style={{ background: 'var(--bg-subtle,#f8fafc)', borderRadius: 8, padding: '14px 14px 6px', marginBottom: 12 }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Entidade</div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label req">Fornecedor</label>
                                <SearchableSelect
                                    options={fornOpts}
                                    value={fornecedorId}
                                    onChange={v => {
                                        setFornId(v);
                                        if (!encomenda) { setLinhas([]); setLineArtId([]); }
                                    }}
                                    placeholder="Seleccionar fornecedor..."
                                />
                                {errors.fornecedor && <span className="form-error"><AlertCircle size={11} /> {errors.fornecedor}</span>}
                            </div>
                            <div className="form-row" style={{ margin: '10px 0 0' }}>
                                <div className="form-group">
                                    <label className="form-label">Responsável</label>
                                    <input className="form-input" value={responsavel} readOnly
                                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'default' }} />
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
                        </div>
                        {/* Grupo: Datas e Condições */}
                        <div style={{ background: 'var(--bg-subtle,#f8fafc)', borderRadius: 8, padding: '14px 14px 6px', marginBottom: 12 }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Datas e Condições</div>
                            <div className="form-row" style={{ margin: 0 }}>
                                <div className="form-group">
                                    <label className="form-label req">Data do Pedido</label>
                                    <input type="date" className="form-input" value={data} onChange={e => setData(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Data de Entrega</label>
                                    <input type="date" className="form-input" value={dataEntrega} onChange={e => setDataEnt(e.target.value)} />
                                </div>
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
                            </div>
                        </div>
                        {/* Grupo: Descrição e Notas */}
                        <div className="form-group">
                            <label className="form-label req">Descrição</label>
                            <input className={`form-input${errors.descricao ? ' err' : ''}`} value={descricao}
                                onChange={e => setDesc(e.target.value)} placeholder="Ex: Pedido Compra N.º 0000004" />
                            {errors.descricao && <span className="form-error"><AlertCircle size={11} /> {errors.descricao}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Observações</label>
                            <textarea className="form-input" rows={3} style={{ resize: 'vertical', lineHeight: 1.6 }}
                                value={observacoes} onChange={e => setObs(e.target.value)}
                                placeholder="Notas internas sobre esta encomenda..." />
                        </div>
                    </>)}

                    {/* ── Artigos ── */}
                    {tab === 'artigos' && (<>
                        {errors.linhas && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--red,#ef4444)', fontSize: '0.8rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', marginBottom: 10 }}>
                                <AlertCircle size={13} />{errors.linhas}
                            </div>
                        )}
                        {linhas.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '32px 0 24px', color: 'var(--text-muted)' }}>
                                <Package size={32} style={{ marginBottom: 10, opacity: 0.35 }} />
                                <div style={{ fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Nenhum artigo adicionado</div>
                                <div style={{ fontSize: '0.78rem', marginBottom: 16 }}>Clique no botão abaixo para adicionar artigos à encomenda.</div>
                                <button type="button" className="abtn abtn-secondary" onClick={addLinha}>
                                    <Plus size={12} /> Adicionar primeiro artigo
                                </button>
                            </div>
                        ) : (<>
                            <table className="data-table" style={{ marginBottom: 0 }}>
                                <thead>
                                    <tr>
                                        <th>Artigo</th>
                                        <th style={{ width: 44, textAlign: 'center' }}>UN</th>
                                        <th style={{ width: 65, textAlign: 'right' }}>Qtd</th>
                                        <th style={{ width: 105, textAlign: 'right' }}>Custo Unit.</th>
                                        <th style={{ width: 52, textAlign: 'right' }}>Desc%</th>
                                        <th style={{ width: 52, textAlign: 'right' }}>IVA%</th>
                                        <th style={{ width: 105, textAlign: 'right' }}>Total c/ IVA</th>
                                        <th style={{ width: 28 }} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {linhas.map((l, i) => (
                                        <tr key={i}>
                                            <td>
                                                <SearchableSelect
                                                    options={artigoOpts}
                                                    value={lineArtId[i]}
                                                    onChange={v => selectArtigo(i, v)}
                                                    placeholder="Seleccionar artigo..."
                                                />
                                                {l.codigo && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{l.codigo}</div>}
                                            </td>
                                            <td style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                                {l.unidade || 'UN'}
                                            </td>
                                            <td>
                                                <input type="number" min={1} className="form-input"
                                                    style={{ textAlign: 'right', padding: '4px 6px', fontSize: '0.78rem' }}
                                                    value={l.qtdEncomendada}
                                                    onChange={e => updateLinha(i, 'qtdEncomendada', Number(e.target.value))} />
                                            </td>
                                            <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-primary)', paddingRight: 8 }}>
                                                {fmt(l.custoUnit)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontSize: '0.8rem', color: l.desconto > 0 ? 'var(--orange,#f97316)' : 'var(--text-muted)', paddingRight: 8 }}>
                                                {l.desconto > 0 ? `${l.desconto}%` : '—'}
                                            </td>
                                            <td style={{ textAlign: 'right', fontSize: '0.8rem', paddingRight: 8 }}>
                                                {(l.taxaIva ?? 0) > 0
                                                    ? <span style={{ color: 'var(--blue)', fontWeight: 600 }}>{l.taxaIva}%</span>
                                                    : <span style={{ color: 'var(--text-muted)' }}>—</span>
                                                }
                                            </td>
                                            <td style={{ textAlign: 'right', fontSize: '0.78rem', fontWeight: 600 }}>
                                                <div>{fmt(Math.round(linhaTotal(l) * (1 + (l.taxaIva ?? 0) / 100)))}</div>
                                                {(l.taxaIva ?? 0) > 0 && (
                                                    <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                                        IVA: {fmt(Math.round(linhaTotal(l) * (l.taxaIva! / 100)))}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <button type="button" className="icon-btn" title="Remover linha" onClick={() => removeLinha(i)}>
                                                    <X size={11} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {/* Summary + Add */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 2 }}>
                                <button type="button" className="abtn abtn-ghost" onClick={addLinha} style={{ fontSize: '0.78rem' }}>
                                    <Plus size={12} /> Adicionar Linha
                                </button>
                                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Subtotal s/ IVA</div>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{fmtMoney(Math.round(subtotalEnc), moeda)}</div>
                                    </div>
                                    {totalIvaEnc > 0 && (
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>IVA</div>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--blue)' }}>{fmtMoney(Math.round(totalIvaEnc), moeda)}</div>
                                        </div>
                                    )}
                                    <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border)', paddingLeft: 20 }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total Encomenda</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--blue)' }}>{fmtMoney(Math.round(totalEnc), moeda)}</div>
                                    </div>
                                </div>
                            </div>
                        </>)}
                    </>)}

                    {/* ── Recebido ── */}
                    {tab === 'recebido' && (
                        encomenda ? (<>
                            {/* ── Progresso por artigo ── */}
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                                    Progresso de Recepção
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {linhas.map((l, i) => {
                                        const pct = l.qtdEncomendada > 0 ? Math.min(100, (l.qtdRecebida / l.qtdEncomendada) * 100) : 0;
                                        const pendente = l.qtdEncomendada - l.qtdRecebida;
                                        const completo = pendente <= 0;
                                        return (
                                            <div key={i} style={{ background: 'var(--bg-subtle,#f8fafc)', borderRadius: 8, padding: '10px 14px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                                    <div>
                                                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{l.descricao}</span>
                                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 6 }}>{l.codigo}</span>
                                                    </div>
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, borderRadius: 10, padding: '2px 8px', flexShrink: 0,
                                                        background: completo ? '#dcfce7' : '#fffbeb',
                                                        color: completo ? '#15803d' : '#b45309' }}>
                                                        {completo ? 'Completo' : `Pendente: ${fmt(pendente)} ${l.unidade}`}
                                                    </span>
                                                </div>
                                                <div style={{ height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`,
                                                        background: completo ? 'var(--green,#22c55e)' : 'var(--blue)', transition: 'width 0.4s' }} />
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                                    <span>Recebido: <strong style={{ color: 'var(--green,#22c55e)' }}>{fmt(l.qtdRecebida)}</strong></span>
                                                    <span>Total: {fmt(l.qtdEncomendada)} {l.unidade}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            {/* ── Histórico de receções ── */}
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                                Histórico de Entregas
                            </div>
                            {encomenda.rececoes.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                    Nenhuma entrega registada ainda.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {[...encomenda.rececoes].sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime()).map((r, idx, arr) => (
                                        <div key={r.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            background: r.estado === 'Anulada' ? 'transparent' : 'var(--bg-subtle,#f8fafc)',
                                            border: `1px solid ${r.estado === 'Anulada' ? 'var(--border)' : 'transparent'}`,
                                            borderRadius: 8, padding: '10px 14px',
                                            opacity: r.estado === 'Anulada' ? 0.55 : 1,
                                        }}>
                                            <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: r.estado === 'Anulada' ? '#fee2e2' : idx === 0 ? '#dcfce7' : 'var(--bg-secondary)',
                                                color: r.estado === 'Anulada' ? '#dc2626' : idx === 0 ? '#15803d' : 'var(--text-muted)' }}>
                                                {r.estado === 'Anulada' ? <Ban size={15} /> : <RotateCcw size={15} />}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.84rem', color: r.estado === 'Anulada' ? 'var(--red,#dc2626)' : 'var(--text-primary)' }}>
                                                        {r.guiaRemessa}
                                                    </span>
                                                    {idx === 0 && r.estado === 'Ativa' && (
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 600, background: '#dcfce7', color: '#15803d', borderRadius: 4, padding: '1px 6px' }}>mais recente</span>
                                                    )}
                                                    {r.estado === 'Anulada' && (
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 600, background: '#fee2e2', color: '#dc2626', borderRadius: 4, padding: '1px 6px' }}>Anulada</span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                    {new Date(r.dataHora).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    {' · '}{r.operador}{' · '}{r.armazem}
                                                    {' · '}{r.itens.length} artigo{r.itens.length !== 1 ? 's' : ''}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
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
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>) : (
                            <div style={{ textAlign: 'center', padding: '32px 0 24px', color: 'var(--text-muted)' }}>
                                <Package size={32} style={{ marginBottom: 10, opacity: 0.3 }} />
                                <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>Guarde a encomenda para registar recepções.</div>
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

/* ══ Converter Nota de Entrada → Fatura Fornecedor ══════════ */
interface ConvertFaturaModalProps {
    encomenda: Encomenda;
    onClose: () => void;
    onConfirm: (data: {
        tipoDocumento: string; numFaturaExterno: string;
        dataEmissao: string; dataVencimento: string;
        linhas: { artigoId: string; descricao: string; quantidade: number; unidadeVenda: string; precoUnitarioNet: number; taxaIva: number; valorIva: number; valorTotalLinha: number; }[];
        totalLiquido: number; totalIva: number; totalRetencao: number; totalFinal: number;
        moeda: string; taxaCambio: number; observacoes: string;
    }) => void;
}
const ConvertFaturaModal: React.FC<ConvertFaturaModalProps> = ({ encomenda, onClose, onConfirm }) => {
    const { documentosCompra, artigos, taxasIva, fmt, fmtMoney } = useGlobal();
    const docOpts = documentosCompra.filter(d => d.codigo !== 'VNC');

    const [tipoDoc,     setTipoDoc]  = useState(docOpts[0]?.codigo ?? 'VFA');
    const [numFatura,   setNumFat]   = useState('');
    const [dataEmissao, setDataEm]   = useState(new Date().toISOString().split('T')[0]);
    const [dataVenc,    setDataVenc] = useState('');
    const [taxaRet,     setTaxaRet]  = useState(0);
    const [obs,         setObs]      = useState('');
    const [numErr,      setNumErr]   = useState(false);

    type LinhaEdit = {
        artigoId: string; descricao: string; codigo: string;
        qtdEnc: number; qtdRec: number; unidade: string;
        preco: number; taxaIva: number;
    };
    const [linhas, setLinhas] = useState<LinhaEdit[]>(() =>
        encomenda.linhas.map(l => {
            // Fallback: derive taxaIva from artigo when not yet persisted
            let taxa = l.taxaIva ?? 0;
            if (taxa === 0) {
                const art = artigos.find(a => a.id === l.artigoId);
                if (art?.codigoIva) taxa = taxasIva.find(t => t.codigo === art.codigoIva)?.taxa ?? 0;
            }
            return {
                artigoId: l.artigoId, descricao: l.descricao, codigo: l.codigo,
                qtdEnc: l.qtdEncomendada, qtdRec: l.qtdRecebida,
                unidade: l.unidade, preco: l.custoUnit,
                taxaIva: taxa,
            };
        })
    );

    const updateLinha = (i: number, field: 'preco' | 'taxaIva', val: number) =>
        setLinhas(p => p.map((l, j) => j === i ? { ...l, [field]: val } : l));

    const calcLinhas = linhas.map(l => {
        const base = l.qtdRec * l.preco;
        const iva  = Math.round(base * l.taxaIva / 100 * 100) / 100;
        return { ...l, base, iva, total: base + iva };
    });
    const totalLiq = calcLinhas.reduce((s, l) => s + l.base, 0);
    const totalIva = calcLinhas.reduce((s, l) => s + l.iva, 0);
    const retencao = Math.round(totalLiq * taxaRet / 100 * 100) / 100;
    const totalFin = totalLiq + totalIva - retencao;

    const qtdOk = encomenda.linhas.every(l => l.qtdRecebida >= l.qtdEncomendada);

    const handleConfirm = () => {
        if (!numFatura.trim()) { setNumErr(true); return; }
        onConfirm({
            tipoDocumento: tipoDoc, numFaturaExterno: numFatura.trim(),
            dataEmissao, dataVencimento: dataVenc, observacoes: obs,
            moeda: encomenda.moeda, taxaCambio: 1,
            totalLiquido: Math.round(totalLiq * 100) / 100,
            totalIva: Math.round(totalIva * 100) / 100,
            totalRetencao: retencao, totalFinal: Math.round(totalFin * 100) / 100,
            linhas: calcLinhas.map(l => ({
                artigoId: l.artigoId, descricao: l.descricao,
                quantidade: l.qtdRec, unidadeVenda: l.unidade,
                precoUnitarioNet: l.preco, taxaIva: l.taxaIva,
                valorIva: l.iva, valorTotalLinha: l.total,
            })),
        });
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 780 }}>
                <div className="modal-header">
                    <h3 className="modal-title">
                        <FileText size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                        Converter em Fatura Fornecedor — {encomenda.numero}
                    </h3>
                    <button className="modal-close" aria-label="Fechar" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                    {/* Verification */}
                    {!qtdOk && (
                        <div style={{ display: 'flex', gap: 8, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '10px 14px', marginBottom: 14 }}>
                            <AlertCircle size={14} style={{ color: '#b45309', flexShrink: 0, marginTop: 1 }} />
                            <div style={{ fontSize: '0.8rem', color: '#92400e' }}>
                                <strong>Atenção:</strong> Alguns artigos têm quantidade recebida inferior à encomendada. A fatura será gerada com base nas quantidades recebidas.
                            </div>
                        </div>
                    )}

                    {/* Doc info */}
                    <div style={{ background: 'var(--bg-subtle,#f8fafc)', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Dados do Documento</div>
                        <div className="form-row" style={{ margin: 0 }}>
                            <div className="form-group" style={{ margin: 0, flex: '0 0 160px' }}>
                                <label className="form-label req">Tipo de Documento</label>
                                <select className="form-select" value={tipoDoc} onChange={e => setTipoDoc(e.target.value)}>
                                    {docOpts.map(d => <option key={d.id} value={d.codigo}>{d.codigo} — {d.descricao}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label req">Nº da Fatura Física (do Fornecedor)</label>
                                <input className={`form-input${numErr ? ' err' : ''}`} value={numFatura}
                                    onChange={e => { setNumFat(e.target.value); setNumErr(false); }}
                                    placeholder="Ex: FAT-2026-00123" autoFocus />
                                {numErr && <span className="form-error"><AlertCircle size={11} /> Obrigatório</span>}
                            </div>
                        </div>
                        <div className="form-row" style={{ margin: '10px 0 0' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label req">Data de Emissão</label>
                                <input type="date" className="form-input" value={dataEmissao} onChange={e => setDataEm(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Data de Vencimento</label>
                                <input type="date" className="form-input" value={dataVenc} onChange={e => setDataVenc(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ margin: 0, flex: '0 0 120px' }}>
                                <label className="form-label">Retenção %</label>
                                <input type="number" min={0} max={100} step={0.5} className="form-input" value={taxaRet}
                                    onChange={e => setTaxaRet(Number(e.target.value))} />
                            </div>
                        </div>
                    </div>

                    {/* Linhas */}
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                        Artigos — Confirmar / Ajustar
                    </div>
                    <table className="data-table" style={{ marginBottom: 0 }}>
                        <thead>
                            <tr>
                                <th>Artigo</th>
                                <th style={{ textAlign: 'right', width: 70 }}>Enc.</th>
                                <th style={{ textAlign: 'right', width: 70 }}>Rec.</th>
                                <th style={{ textAlign: 'right', width: 60 }}>UN</th>
                                <th style={{ textAlign: 'right', width: 120 }}>Preço Unit.</th>
                                <th style={{ textAlign: 'right', width: 80 }}>IVA %</th>
                                <th style={{ textAlign: 'right', width: 100 }}>Total c/ IVA</th>
                            </tr>
                        </thead>
                        <tbody>
                            {calcLinhas.map((l, i) => (
                                <tr key={i} style={{ background: l.qtdRec < l.qtdEnc ? '#fffbeb' : undefined }}>
                                    <td>
                                        <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{l.descricao}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{l.codigo}</div>
                                    </td>
                                    <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{fmt(l.qtdEnc)}</td>
                                    <td style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 700,
                                        color: l.qtdRec < l.qtdEnc ? '#b45309' : '#15803d' }}>
                                        {fmt(l.qtdRec)}
                                    </td>
                                    <td style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.unidade}</td>
                                    <td>
                                        <input type="number" min={0} step={0.01} className="form-input"
                                            style={{ textAlign: 'right', padding: '3px 6px', height: 28, fontSize: '0.78rem' }}
                                            value={l.preco}
                                            onChange={e => updateLinha(i, 'preco', Number(e.target.value))} />
                                    </td>
                                    <td>
                                        <input type="number" min={0} max={100} step={0.5} className="form-input"
                                            style={{ textAlign: 'right', padding: '3px 6px', height: 28, fontSize: '0.78rem' }}
                                            value={l.taxaIva}
                                            onChange={e => updateLinha(i, 'taxaIva', Number(e.target.value))} />
                                    </td>
                                    <td style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 600 }}>
                                        <div>{fmtMoney(l.total, encomenda.moeda)}</div>
                                        {l.taxaIva > 0 && <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', fontWeight: 400 }}>IVA: {fmtMoney(l.iva)}</div>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {/* Totals */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 20, borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Subtotal s/ IVA</div>
                            <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{fmtMoney(totalLiq, encomenda.moeda)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>IVA</div>
                            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--blue)' }}>{fmtMoney(totalIva)}</div>
                        </div>
                        {taxaRet > 0 && (
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Retenção ({taxaRet}%)</div>
                                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#dc2626' }}>-{fmtMoney(retencao)}</div>
                            </div>
                        )}
                        <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border)', paddingLeft: 20 }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total a Pagar</div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--blue)' }}>{fmtMoney(totalFin, encomenda.moeda)}</div>
                        </div>
                    </div>
                    {/* Obs */}
                    <div className="form-group" style={{ marginTop: 12 }}>
                        <label className="form-label">Observações</label>
                        <textarea className="form-input" rows={2} style={{ resize: 'vertical' }} value={obs} onChange={e => setObs(e.target.value)} />
                    </div>
                </div>
                <div className="modal-footer">
                    <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                    <button type="button" className="abtn abtn-primary" onClick={handleConfirm}>
                        <FileText size={12} /> Gravar Fatura
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ══ VNC Estado Badge ═══════════════════════════════════════ */
const VNC_ESTADO_COLORS: Record<string, { bg: string; color: string }> = {
    Rascunho:         { bg: '#f3f4f6', color: '#374151' },
    AguardaAprovacao: { bg: '#fefce8', color: '#b45309' },
    Validado:         { bg: '#dcfce7', color: '#15803d' },
};
const VNC_TRANSITIONS: Record<string, { label: string; next: string } | null> = {
    Rascunho:         { label: 'Enviar p/ Aprovação', next: 'AguardaAprovacao' },
    AguardaAprovacao: { label: 'Validar',             next: 'Validado' },
    Validado:         null,
};
interface VNCEstadoBadgeProps { fatura: FaturaFornecedor; onTransition: (novoEstado: string) => void; }
const VNCEstadoBadge: React.FC<VNCEstadoBadgeProps> = ({ fatura, onTransition }) => {
    const estado  = fatura.estadoDocumento;
    const style   = VNC_ESTADO_COLORS[estado] ?? { bg: '#f3f4f6', color: '#374151' };
    const action  = VNC_TRANSITIONS[estado];
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, borderRadius: 10, padding: '2px 8px', background: style.bg, color: style.color, whiteSpace: 'nowrap' }}>
                {estado === 'AguardaAprovacao' ? 'Aguarda Apr.' : estado}
            </span>
            {action && (
                <button
                    className="abtn abtn-ghost"
                    style={{ fontSize: '0.68rem', padding: '1px 6px', height: 22 }}
                    onClick={() => onTransition(action.next)}
                >
                    {action.label}
                </button>
            )}
        </div>
    );
};

/* ══ Compra Direta Modal ════════════════════════════════════ */
interface CompraDiretaModalProps {
    onClose: () => void;
    onSave: (f: Omit<FaturaFornecedor, 'id'> & { faturasAssociadasIds?: string[] }) => void;
}
const CompraDiretaModal: React.FC<CompraDiretaModalProps> = ({ onClose, onSave }) => {
    const { fornecedores, artigos, documentosCompra, taxasIva, fmtMoney, condicoesPagamento, modosPagamento, faturasFornecedor } = useGlobal();

    const [modalTab,    setModalTab]= useState<'documento' | 'condicoes'>('documento');
    const [fornId,      setFornId]  = useState('');
    const [tipoDoc,     setTipoDoc] = useState(documentosCompra[0]?.codigo ?? 'VFA');
    const [numFatura,   setNumFat]  = useState('');
    const [dataEm,      setDataEm]  = useState(new Date().toISOString().split('T')[0]);
    const [dataVenc,    setDataVenc]= useState('');
    const [desc,        setDesc]    = useState('');
    const [obs,         setObs]     = useState('');
    const [moeda,       setMoeda]   = useState('AOA');
    const [taxaRet,     setTaxaRet] = useState(0);
    const [condicaoPagId, setCondId]= useState('');
    const [modoPagId,   setModoId]  = useState('');

    // VNC-specific state
    const isVNC = tipoDoc === 'VNC';
    const [tipoNC,          setTipoNC]         = useState<'Devolucao' | 'AcertoPreco' | ''>('');
    const [faturasAssocIds, setFaturasAssocIds] = useState<string[]>([]);

    type Linha = {
        produtoId: string; descricaoCustomizada: string;
        quantidade: string; unidadeVenda: string;
        precoUnitarioNet: string; taxaIva: number;
        valorIva: number; codigoIsencao: string; valorTotalLinha: number;
    };
    const emptyLinha = (): Linha => ({
        produtoId: '', descricaoCustomizada: '', quantidade: '1',
        unidadeVenda: 'UN', precoUnitarioNet: '0', taxaIva: 0,
        valorIva: 0, codigoIsencao: '', valorTotalLinha: 0,
    });
    const [linhas, setLinhas] = useState<Linha[]>([emptyLinha()]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Auto-fill payment conditions from selected supplier
    React.useEffect(() => {
        const forn = fornecedores.find(f => f.id === fornId);
        if (forn) {
            if (forn.condicaoPagamentoId) setCondId(String(forn.condicaoPagamentoId));
            if (forn.modoPagamentoId)     setModoId(String(forn.modoPagamentoId));
        }
    }, [fornId, fornecedores]);

    // Reset VNC fields when document type changes
    React.useEffect(() => {
        if (tipoDoc !== 'VNC') { setTipoNC(''); setFaturasAssocIds([]); }
    }, [tipoDoc]);

    // Pre-populate article lines from associated invoices (Devolução mode)
    React.useEffect(() => {
        if (tipoDoc !== 'VNC' || tipoNC !== 'Devolucao' || faturasAssocIds.length === 0) return;
        const novasLinhas: typeof linhas = [];
        for (const fatId of faturasAssocIds) {
            const fat = faturasFornecedor.find(f => f.id === fatId);
            if (!fat) continue;
            for (const l of fat.linhas) {
                novasLinhas.push({
                    produtoId: l.produtoId ?? '', descricaoCustomizada: l.descricaoCustomizada ?? '',
                    quantidade: String(l.quantidade), unidadeVenda: l.unidadeVenda,
                    precoUnitarioNet: String(l.precoUnitarioNet), taxaIva: l.taxaIva,
                    valorIva: l.valorIva, codigoIsencao: l.codigoIsencao ?? '',
                    valorTotalLinha: l.valorTotalLinha,
                });
            }
        }
        if (novasLinhas.length > 0) setLinhas(novasLinhas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [faturasAssocIds, tipoNC, tipoDoc]);

    const fornOpts = fornecedores.map(f => ({ value: f.id, label: f.nome, sub: f.nif }));
    // refFornecedor stores the supplier ID — filter artigos by selected supplier
    const artigoOpts = artigos
        .filter(a => !fornId || !a.refFornecedor || a.refFornecedor === fornId)
        .map(a => ({ value: a.id, label: a.descricao, sub: a.codigo }));

    const selectArtigo = (i: number, artigoId: string) => {
        const a = artigos.find(x => x.id === artigoId);
        if (!a) return;
        // Auto-fill supplier when article is selected first
        if (!fornId && a.refFornecedor) setFornId(a.refFornecedor);
        const taxaIva = a.codigoIva ? (taxasIva.find(t => t.codigo === a.codigoIva)?.taxa ?? 0) : 0;
        const preco = a.precoCusto || a.custoMedio || 0;
        setLinhas(p => p.map((l, j) => j === i ? {
            ...l, produtoId: artigoId, descricaoCustomizada: a.descricao,
            unidadeVenda: a.unidadeMedida || 'UN', precoUnitarioNet: String(preco), taxaIva,
        } : l));
    };
    const updateLinha = <K extends keyof Linha>(i: number, field: K, val: Linha[K]) =>
        setLinhas(p => p.map((l, j) => j === i ? { ...l, [field]: val } : l));
    const recalcLinha = (l: Linha): Linha => {
        const qtd  = Number(l.quantidade) || 0;
        const preco = Number(l.precoUnitarioNet) || 0;
        const base = qtd * preco;
        const iva  = Math.round(base * l.taxaIva / 100 * 100) / 100;
        return { ...l, valorIva: iva, valorTotalLinha: base + iva };
    };

    const linhasCalc = linhas.map(recalcLinha);
    const totalLiq = linhasCalc.reduce((s, l) => s + (Number(l.quantidade) || 0) * (Number(l.precoUnitarioNet) || 0), 0);
    const totalIva = linhasCalc.reduce((s, l) => s + l.valorIva, 0);
    const retencao = Math.round(totalLiq * taxaRet / 100 * 100) / 100;
    const totalFin = totalLiq + totalIva - retencao;

    const validate = () => {
        const e: Record<string, string> = {};
        if (!fornId) e.fornecedor = 'Obrigatório';
        if (!numFatura.trim()) e.numFatura = 'Obrigatório';
        if (isVNC && !tipoNC) e.tipoNC = 'Seleccione o tipo de nota de crédito';
        if (!isVNC && linhasCalc.length === 0) e.linhas = 'Adicione pelo menos uma linha';
        if (isVNC && tipoNC === 'AcertoPreco' && (!linhas[0]?.descricaoCustomizada?.trim() || !(Number(linhas[0]?.precoUnitarioNet) > 0)))
            e.linhas = 'Indique a descrição e o valor do acerto';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSave = () => {
        if (!validate()) return;
        onSave({
            fornecedorId: fornId, tipoDocumento: tipoDoc,
            numFaturaExterno: numFatura.trim(), dataEmissao: dataEm,
            dataVencimento: dataVenc || undefined, moeda, taxaCambio: 1,
            totalLiquido: Math.round(totalLiq * 100) / 100,
            totalIva: Math.round(totalIva * 100) / 100,
            totalRetencao: retencao,
            totalFinal: Math.round(totalFin * 100) / 100,
            estadoPagamento: 'Pendente', observacoes: obs || undefined,
            descricao: desc || undefined,
            condicaoPagamentoId: condicaoPagId || undefined,
            modoPagamentoId: modoPagId || undefined,
            tipoNotaCredito: isVNC ? (tipoNC as 'Devolucao' | 'AcertoPreco') || null : null,
            estadoDocumento: isVNC ? 'Rascunho' : 'NA',
            faturasAssociadasIds: isVNC ? faturasAssocIds : [],
            linhas: linhasCalc.map(l => ({
                produtoId: l.produtoId || undefined, descricaoCustomizada: l.descricaoCustomizada,
                quantidade: Number(l.quantidade) || 0, unidadeVenda: l.unidadeVenda,
                precoUnitarioNet: Number(l.precoUnitarioNet) || 0,
                taxaIva: l.taxaIva, valorIva: l.valorIva,
                codigoIsencao: l.codigoIsencao || undefined, valorTotalLinha: l.valorTotalLinha,
            })),
        });
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 820 }}>
                <div className="modal-header">
                    <h3 className="modal-title">
                        <CreditCard size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                        Compra
                    </h3>
                    <button className="modal-close" aria-label="Fechar" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
                    {(['documento', 'condicoes'] as const).map(t => (
                        <button key={t} type="button" onClick={() => setModalTab(t)}
                            style={{ padding: '8px 14px', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer', borderBottom: modalTab === t ? '2px solid var(--primary)' : '2px solid transparent', color: modalTab === t ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: modalTab === t ? 600 : 400 }}>
                            {t === 'documento' ? 'Documento' : 'Condições'}
                            {t === 'condicoes' && (condicaoPagId || modoPagId) && (
                                <span style={{ marginLeft: 5, width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block', verticalAlign: 'middle' }} />
                            )}
                        </button>
                    ))}
                </div>
                <div className="modal-body" style={{ maxHeight: '74vh', overflowY: 'auto' }}>
                {modalTab === 'condicoes' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ background: 'var(--bg-subtle,#f8fafc)', borderRadius: 8, padding: '12px 14px' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Condições Comerciais</div>
                            <div className="form-group">
                                <label className="form-label">Condição de Pagamento</label>
                                <select className="form-select" value={condicaoPagId} onChange={e => setCondId(e.target.value)}>
                                    <option value="">Seleccionar...</option>
                                    {condicoesPagamento.map(c => <option key={c.id} value={c.id}>{c.descricao}{c.numDias > 0 ? ` (${c.numDias} dias)` : ''}</option>)}
                                </select>
                                {condicaoPagId && (() => {
                                    const c = condicoesPagamento.find(x => x.id === condicaoPagId);
                                    return c ? (
                                        <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: 4, padding: '6px 10px', display: 'flex', gap: 16 }}>
                                            <span><strong>Prazo:</strong> {c.numDias === 0 ? 'Pronto pagamento' : `${c.numDias} dias`}</span>
                                            {c.desconto > 0 && <span><strong>Desconto:</strong> {c.desconto}%</span>}
                                        </div>
                                    ) : null;
                                })()}
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Modo de Pagamento</label>
                                <select className="form-select" value={modoPagId} onChange={e => setModoId(e.target.value)}>
                                    <option value="">Seleccionar...</option>
                                    {modosPagamento.map(m => <option key={m.id} value={m.id}>{m.movimento} — {m.descricao}</option>)}
                                </select>
                            </div>
                        </div>
                        {!fornId && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                                Seleccione um fornecedor no separador Documento para pré-preencher automaticamente.
                            </div>
                        )}
                    </div>
                )}
                {modalTab === 'documento' && <>
                    {/* Cabeçalho */}
                    <div style={{ background: 'var(--bg-subtle,#f8fafc)', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Dados do Documento</div>
                        <div className="form-row" style={{ margin: 0 }}>
                            <div className="form-group" style={{ margin: 0, flex: 2 }}>
                                <label className="form-label req">Fornecedor</label>
                                <SearchableSelect options={fornOpts} value={fornId} onChange={setFornId} placeholder="Seleccionar fornecedor..." />
                                {errors.fornecedor && <span className="form-error"><AlertCircle size={11} /> {errors.fornecedor}</span>}
                            </div>
                            <div className="form-group" style={{ margin: 0, flex: '0 0 160px' }}>
                                <label className="form-label req">Tipo Documento</label>
                                <select className="form-select" value={tipoDoc} onChange={e => setTipoDoc(e.target.value)}>
                                    {documentosCompra.map(d => <option key={d.id} value={d.codigo}>{d.codigo} — {d.descricao}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label req">Nº Fatura Física</label>
                                <input className={`form-input${errors.numFatura ? ' err' : ''}`} value={numFatura}
                                    onChange={e => { setNumFat(e.target.value); setErrors(p => ({ ...p, numFatura: '' })); }}
                                    placeholder={isVNC ? 'Ex: NC/2026/001' : 'Ex: FAT-2026-00123'} />
                                {errors.numFatura && <span className="form-error"><AlertCircle size={11} /> {errors.numFatura}</span>}
                            </div>
                        </div>
                        {/* VNC: Tipo de Nota de Crédito + Faturas Associadas */}
                        {isVNC && (
                            <>
                                <div className="form-row" style={{ margin: '10px 0 0' }}>
                                    <div className="form-group" style={{ margin: 0, flex: 1 }}>
                                        <label className="form-label req">Tipo de Nota de Crédito</label>
                                        <select className="form-select" value={tipoNC} onChange={e => setTipoNC(e.target.value as any)}>
                                            <option value="">Seleccionar tipo...</option>
                                            <option value="Devolucao">Devolução (Impacto Logístico + Financeiro)</option>
                                            <option value="AcertoPreco">Acerto de Preço (Impacto Financeiro apenas)</option>
                                        </select>
                                        {errors.tipoNC && <span className="form-error"><AlertCircle size={11} /> {errors.tipoNC}</span>}
                                    </div>
                                </div>
                                <div className="form-row" style={{ margin: '10px 0 0' }}>
                                    <div className="form-group" style={{ margin: 0, flex: 1 }}>
                                        <label className="form-label">Faturas Associadas (VFA/VFR do mesmo fornecedor)</label>
                                        <div style={{ border: '1px solid var(--border)', borderRadius: 4, maxHeight: 130, overflowY: 'auto', padding: '4px 0', background: '#fff' }}>
                                            {(() => {
                                                const elegiveis = faturasFornecedor.filter(f =>
                                                    (f.tipoDocumento === 'VFA' || f.tipoDocumento === 'VFR') &&
                                                    (!fornId || f.fornecedorId === fornId)
                                                );
                                                if (elegiveis.length === 0) return (
                                                    <div style={{ padding: '6px 10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                        {fornId ? 'Nenhuma fatura VFA/VFR deste fornecedor.' : 'Seleccione um fornecedor para filtrar.'}
                                                    </div>
                                                );
                                                return elegiveis.map(f => (
                                                    <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', cursor: 'pointer', fontSize: '0.8rem' }}>
                                                        <input type="checkbox" checked={faturasAssocIds.includes(f.id)}
                                                            onChange={e => setFaturasAssocIds(prev => e.target.checked ? [...prev, f.id] : prev.filter(x => x !== f.id))} />
                                                        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', background: '#eff6ff', color: '#1d4ed8', borderRadius: 3, padding: '1px 5px' }}>{f.tipoDocumento}</span>
                                                        <span style={{ fontWeight: 600 }}>{f.numFaturaExterno}</span>
                                                        <span style={{ color: 'var(--text-muted)' }}>({f.dataEmissao})</span>
                                                    </label>
                                                ));
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                        <div className="form-row" style={{ margin: '10px 0 0' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label req">Data de Emissão</label>
                                <input type="date" className="form-input" value={dataEm} onChange={e => setDataEm(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Data de Vencimento</label>
                                <input type="date" className="form-input" value={dataVenc} onChange={e => setDataVenc(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ margin: 0, flex: '0 0 100px' }}>
                                <label className="form-label">Retenção %</label>
                                <input type="number" min={0} max={100} step={0.5} className="form-input" value={taxaRet} onChange={e => setTaxaRet(Number(e.target.value))} />
                            </div>
                            <div className="form-group" style={{ margin: 0, flex: '0 0 90px' }}>
                                <label className="form-label">Moeda</label>
                                <select className="form-select" value={moeda} onChange={e => setMoeda(e.target.value)}>
                                    <option value="AOA">AOA</option><option value="USD">USD</option><option value="EUR">EUR</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-row" style={{ margin: '10px 0 0' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Descrição</label>
                                <input className="form-input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descrição da compra..." />
                            </div>
                        </div>
                    </div>

                    {/* Linhas */}
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                        {isVNC && tipoNC === 'AcertoPreco' ? 'Acerto / Serviço' : 'Artigos'}
                    </div>
                    {errors.linhas && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--red,#ef4444)', marginBottom: 8 }}><AlertCircle size={11} /> {errors.linhas}</div>
                    )}

                    {/* AcertoPreco: simplified single-line form */}
                    {isVNC && tipoNC === 'AcertoPreco' ? (
                        <div style={{ background: 'var(--bg-subtle,#f8fafc)', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
                            <div className="form-row" style={{ margin: 0 }}>
                                <div className="form-group" style={{ margin: 0, flex: 3 }}>
                                    <label className="form-label req">Descrição do Acerto</label>
                                    <input className="form-input" placeholder="Ex: Acerto de preço factura VFA-2026-001..."
                                        value={linhas[0]?.descricaoCustomizada ?? ''}
                                        onChange={e => setLinhas([{ ...emptyLinha(), descricaoCustomizada: e.target.value, produtoId: '' }])} />
                                </div>
                                <div className="form-group" style={{ margin: 0, flex: 1 }}>
                                    <label className="form-label req">Valor (sem IVA)</label>
                                    <input type="number" min={0} step={0.01} className="form-input"
                                        value={linhas[0]?.precoUnitarioNet ?? '0'}
                                        onChange={e => setLinhas([{ ...emptyLinha(), descricaoCustomizada: linhas[0]?.descricaoCustomizada ?? '', produtoId: '', precoUnitarioNet: e.target.value, quantidade: '1' }])} />
                                </div>
                                <div className="form-group" style={{ margin: 0, flex: '0 0 80px' }}>
                                    <label className="form-label">IVA %</label>
                                    <input type="number" min={0} max={100} step={0.5} className="form-input"
                                        value={linhas[0]?.taxaIva ?? 0}
                                        onChange={e => setLinhas(p => p.map((l, i) => i === 0 ? { ...l, taxaIva: Number(e.target.value) } : l))} />
                                </div>
                            </div>
                            <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                Acerto de Preço: sem impacto em stock. Só financeiro.
                            </div>
                        </div>
                    ) : (
                    <>
                    <table className="data-table" style={{ marginBottom: 0 }}>
                        <thead>
                            <tr>
                                <th>Artigo / Descrição</th>
                                <th style={{ width: 70, textAlign: 'right' }}>Qtd</th>
                                <th style={{ width: 55, textAlign: 'center' }}>UN</th>
                                <th style={{ width: 110, textAlign: 'right' }}>Preço Unit.</th>
                                <th style={{ width: 75, textAlign: 'right' }}>IVA %</th>
                                <th style={{ width: 110, textAlign: 'right' }}>Total</th>
                                <th style={{ width: 28 }} />
                            </tr>
                        </thead>
                        <tbody>
                            {linhas.map((l, i) => {
                                const calc = linhasCalc[i];
                                return (
                                    <tr key={i}>
                                        <td>
                                            <SearchableSelect options={artigoOpts} value={l.produtoId} onChange={v => selectArtigo(i, v)} placeholder="Seleccionar artigo..." />
                                        </td>
                                        <td>
                                            <input type="number" min={0} step={0.001} className="form-input"
                                                style={{ textAlign: 'right', padding: '3px 6px', height: 28, fontSize: '0.78rem' }}
                                                value={l.quantidade} onChange={e => updateLinha(i, 'quantidade', e.target.value)} />
                                        </td>
                                        <td>
                                            <input className="form-input"
                                                style={{ textAlign: 'center', padding: '3px 4px', height: 28, fontSize: '0.75rem' }}
                                                value={l.unidadeVenda} onChange={e => updateLinha(i, 'unidadeVenda', e.target.value)} />
                                        </td>
                                        <td>
                                            <input type="number" min={0} step={0.01} className="form-input"
                                                style={{ textAlign: 'right', padding: '3px 6px', height: 28, fontSize: '0.78rem' }}
                                                value={l.precoUnitarioNet} onChange={e => updateLinha(i, 'precoUnitarioNet', e.target.value)} />
                                        </td>
                                        <td>
                                            <input type="number" min={0} max={100} step={0.5} className="form-input"
                                                style={{ textAlign: 'right', padding: '3px 6px', height: 28, fontSize: '0.78rem' }}
                                                value={l.taxaIva} onChange={e => updateLinha(i, 'taxaIva', Number(e.target.value))} />
                                        </td>
                                        <td style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 600 }}>
                                            <div>{fmtMoney(calc.valorTotalLinha, moeda)}</div>
                                            {calc.valorIva > 0 && <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', fontWeight: 400 }}>IVA: {fmtMoney(calc.valorIva)}</div>}
                                        </td>
                                        <td>
                                            <button type="button" className="icon-btn" onClick={() => setLinhas(p => p.filter((_, j) => j !== i))}><X size={11} /></button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 2 }}>
                        <button type="button" className="abtn abtn-ghost" onClick={() => setLinhas(p => [...p, emptyLinha()])} style={{ fontSize: '0.78rem' }}>
                            <Plus size={12} /> Adicionar Linha
                        </button>
                        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Subtotal</div>
                                <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{fmtMoney(totalLiq, moeda)}</div>
                            </div>
                            {totalIva > 0 && (
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>IVA</div>
                                    <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--blue)' }}>{fmtMoney(totalIva)}</div>
                                </div>
                            )}
                            {retencao > 0 && (
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Retenção</div>
                                    <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#dc2626' }}>-{fmtMoney(retencao)}</div>
                                </div>
                            )}
                            <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border)', paddingLeft: 20 }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total a Pagar</div>
                                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--blue)' }}>{fmtMoney(totalFin, moeda)}</div>
                            </div>
                        </div>
                    </div>
                    </>
                    )}
                    {/* Totals summary for AcertoPreco */}
                    {isVNC && tipoNC === 'AcertoPreco' && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 20, borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 2 }}>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total a Pagar</div>
                                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--blue)' }}>{fmtMoney(totalFin, moeda)}</div>
                            </div>
                        </div>
                    )}
                    <div className="form-group" style={{ marginTop: 12 }}>
                        <label className="form-label">Observações</label>
                        <textarea className="form-input" rows={2} style={{ resize: 'vertical' }} value={obs} onChange={e => setObs(e.target.value)} />
                    </div>
                </>}
                </div>
                <div className="modal-footer">
                    <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                    <button type="button" className="abtn abtn-primary" onClick={handleSave}>
                        <Check size={12} /> {isVNC ? 'Criar VNC (Rascunho)' : 'Registar Compra'}
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
                    <button className="modal-close" aria-label="Fechar" type="button" onClick={onClose}><X size={13} /></button>
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
function buildSugestoesHtml(artigos: Artigo[], empresa?: EmpresaConfig, simbolo?: string): string {
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

function printSugestoes(artigos: Artigo[], empresa?: EmpresaConfig, simbolo?: string) {
    const html = buildSugestoesHtml(artigos, empresa, simbolo);
    const w = window.open('', '_blank', 'width=794,height=1123');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
}

/* ══ Page ════════════════════════════════════════════════════ */
const EncomendaPage: React.FC = () => {
    const { encomendas, addEncomenda, updateEncomenda, criarRececao, anularRececao, fornecedores, artigos: todosArtigos, taxasIva, updateArtigo, addMovimento, currentUser, empresaConfig, fmtMoney, fmtDate, fmt, simboloMoeda, faturasFornecedor, addFaturaFornecedor, updateFaturaFornecedor, updateEstadoVNC, condicoesPagamento, modosPagamento, loadingData } = useGlobal();
    const confirm = useConfirm();

    const [pageTab,   setPageTab]   = useState<'encomendas' | 'sugestoes' | 'compras' | 'relatorios'>('encomendas');
    const [search,    setSearch]    = useState('');
    const [filterEst, setFEst]      = useState('');
    const [modal,     setModal]     = useState<'new' | string | null>(null);
    const [receber,   setReceber]   = useState<string | null>(null);
    const [rececDropdown, setRececDropdown] = useState<string | null>(null);
    const [rececDropdownPos, setRececDropdownPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
    const [previewHtml, setPreviewHtml] = useState('');

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
    const [showConverter,    setShowConverter]    = useState(false);
    const [convertFatId,    setConvertFatId]     = useState<string | null>(null);
    const [showCompraDireta, setShowCompraDireta] = useState(false);
    const [pagarModalId,    setPagarModalId]     = useState<string | null>(null);
    const [pagarData,       setPagarData]        = useState('');
    const [pagarModoId,     setPagarModoId]      = useState('');
    const [pagarRef,        setPagarRef]         = useState('');

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

    const showToast = (msg: string) => notify(msg, 'success');

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

    // ── Reports data ─────────────────────────────────────────
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    const weekAgo  = new Date(today); weekAgo.setDate(today.getDate() - 6);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    const encEmAberto = encomendas.filter(e => e.estado === 'Aberta' || e.estado === 'Aprovada' || e.estado === 'Parcial');
    const encEmAtraso = encomendas.filter(e =>
        (e.estado === 'Aberta' || e.estado === 'Aprovada' || e.estado === 'Parcial') &&
        e.dataEntrega && e.dataEntrega < todayStr
    );
    const encHoje   = encomendas.filter(e => e.data === todayStr);
    const encSemana = encomendas.filter(e => e.data >= weekAgoStr && e.data <= todayStr);

    // By-status for chart
    const statusCounts: Record<string, number> = {
        Aberta:    encomendas.filter(e => e.estado === 'Aberta').length,
        Aprovada:  encomendas.filter(e => e.estado === 'Aprovada').length,
        Parcial:   encomendas.filter(e => e.estado === 'Parcial').length,
        Recebida:  encomendas.filter(e => e.estado === 'Recebida').length,
        Cancelada: encomendas.filter(e => e.estado === 'Cancelada').length,
    };

    // Last 7 days daily volume
    const dailyVolume = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today); d.setDate(today.getDate() - (6 - i));
        const ds = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit' });
        return { label, date: ds, count: encomendas.filter(e => e.data === ds).length };
    });
    const maxDaily = Math.max(...dailyVolume.map(d => d.count), 1);

    const editTarget  = typeof modal === 'string' && modal !== 'new' ? encomendas.find(e => e.id === modal) : undefined;
    const receberEnc  = receber ? encomendas.find(e => e.id === receber) : null;

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
        } catch { /* erro já apresentado pelo interceptor global (api.ts) */ }
    };

    const handleAnularRececao = async (rececaoId: string) => {
        if (!(await confirm({
            title: 'Anular receção',
            message: 'Anular esta receção irá reverter o stock e os acumulados. Confirmar?',
            confirmLabel: 'Anular',
            variant: 'danger',
        }))) return;
        try {
            await anularRececao(rececaoId);
            showToast('Receção anulada. Stock revertido.');
        } catch { /* erro já apresentado pelo interceptor global (api.ts) */ }
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

    const convertFatEncomenda = encomendas.find(e => e.id === convertFatId) ?? null;

    const handleConvertToFatura = async (encId: string, data: Parameters<typeof addFaturaFornecedor>[0] extends { fornecedorId: string } ? any : any) => {
        const enc = encomendas.find(e => e.id === encId);
        if (!enc) return;
        try {
            await addFaturaFornecedor({
                ...data,
                fornecedorId: enc.fornecedorId,
                idEncomenda: encId,
                linhas: data.linhas.map((l: any) => ({
                    ...l,
                    produtoId: l.artigoId,
                    descricaoCustomizada: l.descricaoCustomizada || l.descricao || '',
                })),
            });
            updateEncomenda(encId, { estado: 'Faturada' });
            showToast(`Fatura criada. Encomenda ${enc.numero} marcada como Faturada.`);
        } catch { /* erro já apresentado pelo interceptor global (api.ts) */ }
    };

    const handleVNCTransition = async (id: string, novoEstado: string) => {
        const fatura = faturasFornecedor.find(f => f.id === id);
        if (!fatura) return;
        if (novoEstado === 'Validado' && fatura.tipoNotaCredito === 'Devolucao') {
            if (!(await confirm({
                title: 'Validar nota de crédito',
                message: 'Validar esta VNC irá reduzir o stock dos artigos. Confirma?',
                confirmLabel: 'Validar',
                variant: 'info',
            }))) return;
        }
        try {
            await updateEstadoVNC(id, novoEstado, currentUser?.nome);
            showToast(novoEstado === 'Validado'
                ? 'VNC validada. Stock e movimentos actualizados.'
                : `Estado actualizado para: ${novoEstado}`);
        } catch (e: any) {
            showToast(e?.response?.data?.message ?? 'Erro ao actualizar estado.');
        }
    };

    const openPagarModal = (id: string) => {
        setPagarModalId(id);
        setPagarData(new Date().toISOString().split('T')[0]);
        setPagarModoId('');
        setPagarRef('');
    };

    const handleConfirmarPagamento = async () => {
        if (!pagarModalId) return;
        try {
            await updateFaturaFornecedor(pagarModalId, {
                estadoPagamento: 'Paga',
                dataPagamento: pagarData || new Date().toISOString().split('T')[0],
                referenciaPagamento: pagarRef || null,
                modoPagamentoId: pagarModoId || undefined,
            });
            showToast('Pagamento registado com sucesso.');
        } catch { /* erro já apresentado pelo interceptor global (api.ts) */ }
        setPagarModalId(null);
    };

    const handleCompraDireta = async (f: Omit<FaturaFornecedor, 'id'> & { faturasAssociadasIds?: string[] }) => {
        try {
            await addFaturaFornecedor(f);
            const isVNC = f.tipoDocumento === 'VNC';
            showToast(isVNC
                ? 'VNC criada em estado Rascunho. Sem impacto em stock até validação.'
                : 'Compra direta registada. Stock actualizado.');
        } catch { /* erro já apresentado pelo interceptor global (api.ts) */ }
    };

    return (
        <AppLayout>
            <ActionBar title="Compra" breadcrumb="AQUATEX SGI · Compra">
                <div className="actionbar-spacer" />
                {pageTab === 'encomendas' && (
                    <button className="abtn abtn-secondary" type="button" onClick={() => setShowExport(true)}>
                        <Download size={13} /> Exportar
                    </button>
                )}
                {pageTab === 'sugestoes' && artigosRupturaFiltrados.length > 0 && (<>
                    <button className="abtn abtn-secondary" type="button" onClick={() => setPreviewHtml(buildSugestoesHtml(artigosRupturaFiltrados, empresaConfig, simboloMoeda))} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Eye size={13} /> Pré-visualizar
                    </button>
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
                {pageTab === 'compras' && (
                    <button className="abtn abtn-primary" type="button" onClick={() => setShowCompraDireta(true)}>
                        <Plus size={13} /> Nova Compra Direta
                    </button>
                )}
                {pageTab === 'relatorios' && (
                    <button className="abtn abtn-secondary" type="button"
                        onClick={() => window.print()}
                        style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Printer size={13} /> Imprimir
                    </button>
                )}
            </ActionBar>

            <div className="page-content">
                {/* Page-level tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
                    {([
                        { id: 'encomendas', label: 'Encomendas' },
                        { id: 'sugestoes',  label: `Sugestões de Encomenda${artigosRuptura.length > 0 ? ` (${artigosRuptura.length})` : ''}` },
                        { id: 'compras',    label: `Compras${faturasFornecedor.length > 0 ? ` (${faturasFornecedor.length})` : ''}` },
                        { id: 'relatorios', label: 'Relatórios' },
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
                        <option value="Aprovada">Aprovada</option>
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
                                {loadingData && <TableSkeleton cols={9} />}
                                {!loadingData && filtered.length === 0 && (
                                    <tr><td colSpan={9}><EmptyState icon={<ShoppingCart size={28} />} title="Nenhuma encomenda encontrada" description="Crie encomendas a fornecedores para repor stock e registar receções." /></td></tr>
                                )}
                                {!loadingData && filtered.map(e => {
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
                                                    {e.estado === 'Aberta' && (
                                                        <button className="icon-btn" title="Editar" onClick={() => setModal(e.id)}>
                                                            <Package size={12} />
                                                        </button>
                                                    )}
                                                    {e.estado === 'Aberta' && (
                                                        <button className="abtn abtn-ghost" title="Aprovar encomenda"
                                                            style={{ fontSize: '0.72rem', padding: '2px 8px', height: 24, color: '#15803d' }}
                                                            onClick={() => updateEncomenda(e.id, { estado: 'Aprovada' })}>
                                                            <CheckCircle2 size={11} /> Aprovar
                                                        </button>
                                                    )}
                                                    {(e.estado === 'Aprovada' || e.estado === 'Parcial') && (
                                                        <button className="abtn abtn-ghost" title="Receber" style={{ fontSize: '0.72rem', padding: '2px 8px', height: 24 }}
                                                            onClick={() => setReceber(e.id)}>
                                                            <Archive size={11} /> Receber
                                                        </button>
                                                    )}
                                                    {e.estado !== 'Aberta' && (
                                                        <button className="icon-btn" title="Pré-visualizar nota de encomenda" onClick={() => setPreviewHtml(buildNotaEncomendaHtml(e, getFornNome(e.fornecedorId), empresaConfig, simboloMoeda, todosArtigos, taxasIva))}>
                                                            <Eye size={12} />
                                                        </button>
                                                    )}
                                                    {e.estado !== 'Aberta' && (
                                                        <button className="icon-btn" title="Imprimir nota de encomenda" onClick={() => printNotaEncomenda(e, getFornNome(e.fornecedorId), empresaConfig, simboloMoeda, todosArtigos, taxasIva)}>
                                                            <Printer size={12} />
                                                        </button>
                                                    )}
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
                                                                    onClick={ev => {
                                                                        ev.stopPropagation();
                                                                        const rect = ev.currentTarget.getBoundingClientRect();
                                                                        setRececDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                                                        setRececDropdown(rececDropdown === e.id ? null : e.id);
                                                                    }}>
                                                                    <RotateCcw size={12} />
                                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, marginLeft: 2 }}>{ativas.length}</span>
                                                                </button>
                                                                {rececDropdown === e.id && ReactDOM.createPortal(
                                                                    <div style={{
                                                                        position: 'fixed', top: rececDropdownPos.top, right: rececDropdownPos.right, zIndex: 9999,
                                                                        background: 'var(--surface,#fff)', border: '1px solid var(--border)',
                                                                        borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.13)',
                                                                        minWidth: 260,
                                                                    }} onClick={ev => ev.stopPropagation()}>
                                                                        {/* Header */}
                                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 8px', borderBottom: '1px solid var(--border)' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                                <RotateCcw size={12} style={{ color: '#16a34a' }} />
                                                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Notas de Entrada</span>
                                                                            </div>
                                                                            <span style={{ fontSize: '0.7rem', fontWeight: 600, background: '#dcfce7', color: '#15803d', borderRadius: 10, padding: '1px 8px' }}>
                                                                                {ativas.length} entrega{ativas.length !== 1 ? 's' : ''}
                                                                            </span>
                                                                        </div>
                                                                        {/* Items */}
                                                                        <div style={{ padding: '6px 0' }}>
                                                                            {ativas.map((r, idx) => (
                                                                                <button key={r.id} style={{
                                                                                    display: 'flex', alignItems: 'center', gap: 10,
                                                                                    width: '100%', padding: '8px 14px', border: 'none',
                                                                                    background: 'none', cursor: 'pointer', textAlign: 'left',
                                                                                    borderLeft: idx === 0 ? '3px solid #16a34a' : '3px solid transparent',
                                                                                }}
                                                                                    onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--bg-hover,#f5f7fa)')}
                                                                                    onMouseLeave={ev => (ev.currentTarget.style.background = 'none')}
                                                                                    onClick={() => { printNotaEntrada(r, e, empresaConfig); setRececDropdown(null); }}
                                                                                    title="Clique para reimprimir">
                                                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                                                                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem', color: '#16a34a' }}>{r.guiaRemessa}</span>
                                                                                            {idx === 0 && (
                                                                                                <span style={{ fontSize: '0.62rem', fontWeight: 600, background: '#dcfce7', color: '#15803d', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>
                                                                                                    mais recente
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                                                            {new Date(r.dataHora).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                                        </div>
                                                                                    </div>
                                                                                    <Printer size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>,
                                                                    document.body
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                    {e.rececoes?.filter(r => r.estado === 'Ativa').length > 0 && e.estado !== 'Faturada' && e.estado !== 'Cancelada' && (
                                                        <button className="abtn abtn-ghost" title="Converter em Fatura Fornecedor"
                                                            style={{ fontSize: '0.72rem', padding: '2px 8px', height: 24, color: '#7c3aed' }}
                                                            onClick={() => setConvertFatId(e.id)}>
                                                            <FileText size={11} /> Faturar
                                                        </button>
                                                    )}
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

                {/* ── Compras Tab ── */}
                {pageTab === 'compras' && (<>
                    <div className="stats-row">
                        {(() => {
                            const naoVNC    = faturasFornecedor.filter(f => f.tipoDocumento !== 'VNC');
                            const pendentes = naoVNC.filter(f => f.estadoPagamento === 'Pendente');
                            const vencidas  = pendentes.filter(f => f.dataVencimento && f.dataVencimento < todayStr);
                            const valorPago = naoVNC.filter(f => f.estadoPagamento === 'Paga').reduce((s, f) => s + Number(f.totalFinal), 0);
                            return [
                                { label: 'Total Faturas',  value: faturasFornecedor.length,                                          cls: 'blue' },
                                { label: 'Pendentes',       value: pendentes.length,                                                  cls: 'orange' },
                                { label: 'Vencidas',        value: vencidas.length,                                                   cls: vencidas.length > 0 ? 'red' : 'green' },
                                { label: 'Pagas',           value: naoVNC.filter(f => f.estadoPagamento === 'Paga').length,           cls: 'green' },
                                { label: 'Valor Pago',      value: fmtMoney(valorPago),                                               cls: 'green' },
                                { label: 'Valor Pendente',  value: fmtMoney(pendentes.reduce((s, f) => s + Number(f.totalFinal), 0)), cls: pendentes.length > 0 ? 'orange' : 'blue' },
                            ];
                        })().map(s => (
                            <div key={s.label} className="stat-card">
                                <span className="stat-label">{s.label}</span>
                                <span className={`stat-value ${s.cls}`}>{s.value}</span>
                            </div>
                        ))}
                    </div>
                    <div className="table-container">
                        <div className="table-scroll">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Tipo</th>
                                        <th>Nº Fatura</th>
                                        <th>Fornecedor</th>
                                        <th>Encomenda</th>
                                        <th>Data Emissão</th>
                                        <th>Vencimento</th>
                                        <th style={{ textAlign: 'right' }}>Total Líquido</th>
                                        <th style={{ textAlign: 'right' }}>IVA</th>
                                        <th style={{ textAlign: 'right' }}>Total Final</th>
                                        <th>Estado Pgto</th>
                                        <th>Estado Doc.</th>
                                        <th style={{ width: 90 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {faturasFornecedor.length === 0 && (
                                        <tr><td colSpan={11}>
                                            <div className="empty-state">
                                                <Wallet size={28} />
                                                <br />Nenhuma fatura de fornecedor registada.
                                                <br />
                                                <button type="button" className="abtn abtn-primary" style={{ marginTop: 12 }} onClick={() => setShowCompraDireta(true)}>
                                                    <Plus size={12} /> Nova Compra Direta
                                                </button>
                                            </div>
                                        </td></tr>
                                    )}
                                    {faturasFornecedor.map(f => {
                                        const enc = encomendas.find(e => e.id === f.idEncomenda);
                                        const vencida = f.tipoDocumento !== 'VNC' && f.dataVencimento && f.dataVencimento < todayStr && f.estadoPagamento === 'Pendente';
                                        return (
                                            <tr key={f.id} style={{ background: vencida ? '#fff5f5' : undefined }}>
                                                <td>
                                                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem',
                                                        background: '#f3e8ff', color: '#7c3aed', borderRadius: 4, padding: '2px 6px' }}>
                                                        {f.tipoDocumento}
                                                    </span>
                                                </td>
                                                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 600, color: 'var(--blue)' }}>
                                                    {f.numFaturaExterno}
                                                </td>
                                                <td style={{ fontWeight: 600, fontSize: '0.83rem' }}>{getFornNome(f.fornecedorId)}</td>
                                                <td style={{ fontSize: '0.78rem', color: 'var(--blue)' }}>
                                                    {enc ? enc.numero : f.idEncomenda ? `#${f.idEncomenda}` : <span style={{ color: 'var(--text-muted)' }}>Compra direta</span>}
                                                </td>
                                                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fmtDate(f.dataEmissao)}</td>
                                                <td style={{ fontSize: '0.78rem', color: vencida ? '#dc2626' : 'var(--text-muted)', fontWeight: vencida ? 700 : 400 }}>
                                                    {f.tipoDocumento === 'VNC' ? '—' : (f.dataVencimento ? fmtDate(f.dataVencimento) : '—')}
                                                    {vencida && ' ⚠'}
                                                </td>
                                                <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>{fmtMoney(f.totalLiquido, f.moeda)}</td>
                                                <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--blue)' }}>{fmtMoney(f.totalIva, f.moeda)}</td>
                                                <td style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 700 }}>{fmtMoney(f.totalFinal, f.moeda)}</td>
                                                <td>
                                                    {f.tipoDocumento === 'VNC' ? (
                                                        <span style={{ fontSize: '0.72rem', fontWeight: 600, borderRadius: 10, padding: '2px 8px', background: '#f3f4f6', color: '#6b7280' }}>
                                                            N/A
                                                        </span>
                                                    ) : (
                                                        <span style={{
                                                            fontSize: '0.72rem', fontWeight: 600, borderRadius: 10, padding: '2px 8px',
                                                            background: f.estadoPagamento === 'Paga' ? '#dcfce7' : f.estadoPagamento === 'Anulada' ? '#f3f4f6' : vencida ? '#fee2e2' : '#fefce8',
                                                            color: f.estadoPagamento === 'Paga' ? '#15803d' : f.estadoPagamento === 'Anulada' ? '#6b7280' : vencida ? '#dc2626' : '#b45309',
                                                        }}>
                                                            {f.estadoPagamento}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    {f.tipoDocumento === 'VNC' ? (
                                                        <VNCEstadoBadge
                                                            fatura={{ ...f, estadoDocumento: (f.estadoDocumento === 'NA' || !f.estadoDocumento) ? 'Rascunho' : f.estadoDocumento }}
                                                            onTransition={(est) => handleVNCTransition(f.id, est)}
                                                        />
                                                    ) : (
                                                        <span style={{ fontSize: '0.72rem', fontWeight: 600, borderRadius: 10, padding: '2px 8px', background: '#f3f4f6', color: '#6b7280' }}>
                                                            N/A
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                                                        <button className="icon-btn" title="Pré-visualizar"
                                                            onClick={() => {
                                                                const forn = fornecedores.find(x => x.id === f.fornecedorId);
                                                                const html = f.tipoDocumento === 'VNC'
                                                                    ? buildVNCHtml(f, forn, empresaConfig, simboloMoeda, todosArtigos, condicoesPagamento, modosPagamento, currentUser?.nome)
                                                                    : buildFaturaFornecedorHtml(f, forn, empresaConfig, simboloMoeda, todosArtigos, condicoesPagamento, modosPagamento, currentUser?.nome);
                                                                setPreviewHtml(html);
                                                            }}>
                                                            <Eye size={14} />
                                                        </button>
                                                        <button className="icon-btn" title="Imprimir"
                                                            onClick={() => {
                                                                const forn = fornecedores.find(x => x.id === f.fornecedorId);
                                                                const html = f.tipoDocumento === 'VNC'
                                                                    ? buildVNCHtml(f, forn, empresaConfig, simboloMoeda, todosArtigos, condicoesPagamento, modosPagamento, currentUser?.nome)
                                                                    : buildFaturaFornecedorHtml(f, forn, empresaConfig, simboloMoeda, todosArtigos, condicoesPagamento, modosPagamento, currentUser?.nome);
                                                                printDocFornecedor(html);
                                                            }}>
                                                            <Printer size={14} />
                                                        </button>
                                                        {f.tipoDocumento !== 'VNC' && f.estadoPagamento === 'Pendente' && (
                                                            <button
                                                                className="abtn abtn-success"
                                                                style={{ fontSize: '0.7rem', padding: '2px 8px', height: 26 }}
                                                                title="Marcar como Paga"
                                                                onClick={() => openPagarModal(f.id)}>
                                                                <Check size={11} /> Paga
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="table-count">{faturasFornecedor.length} fatura(s) de fornecedor</div>
                    </div>
                </>)}

                {/* ── Relatórios Tab ── */}
                {pageTab === 'relatorios' && (<>

                    {/* KPI row */}
                    <div className="stats-row">
                        {[
                            { label: 'Em Aberto',     value: encEmAberto.length,  cls: 'blue',   icon: <ShoppingCart size={16} /> },
                            { label: 'Em Atraso',     value: encEmAtraso.length,  cls: encEmAtraso.length > 0 ? 'red' : 'green', icon: <Clock size={16} /> },
                            { label: 'Hoje',          value: encHoje.length,      cls: 'blue',   icon: <CalendarDays size={16} /> },
                            { label: 'Esta Semana',   value: encSemana.length,    cls: 'blue',   icon: <BarChart2 size={16} /> },
                        ].map(s => (
                            <div key={s.label} className="stat-card">
                                <span className="stat-label">{s.label}</span>
                                <span className={`stat-value ${s.cls}`}>{s.value}</span>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

                        {/* ── Estado das Encomendas ── */}
                        <div className="settings-section" style={{ margin: 0 }}>
                            <div className="settings-section-hdr">
                                <div className="settings-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <ListFilter size={14} /> Estado das Encomendas
                                </div>
                                <div className="settings-section-desc">Visão geral por status</div>
                            </div>
                            <div className="settings-section-body">
                                {([
                                    { estado: 'Aberta',    label: 'Abertas',    color: '#3b82f6', bg: '#eff6ff' },
                                    { estado: 'Parcial',   label: 'Parciais',   color: '#f97316', bg: '#fff7ed' },
                                    { estado: 'Recebida',  label: 'Recebidas',  color: '#16a34a', bg: '#f0fdf4' },
                                    { estado: 'Cancelada', label: 'Canceladas', color: '#9ca3af', bg: '#f9fafb' },
                                ] as const).map(s => {
                                    const count = statusCounts[s.estado] ?? 0;
                                    const pct = encomendas.length > 0 ? Math.round(count / encomendas.length * 100) : 0;
                                    return (
                                        <div key={s.estado} style={{ marginBottom: 12 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: s.color }}>{s.label}</span>
                                                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                                                    {count} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({pct}%)</span>
                                                </span>
                                            </div>
                                            <div style={{ height: 8, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${pct}%`, background: s.color, borderRadius: 4, transition: 'width 0.3s' }} />
                                            </div>
                                        </div>
                                    );
                                })}
                                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Total</span>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{encomendas.length}</span>
                                </div>
                            </div>
                        </div>

                        {/* ── Volume Diário (7 dias) ── */}
                        <div className="settings-section" style={{ margin: 0 }}>
                            <div className="settings-section-hdr">
                                <div className="settings-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <BarChart2 size={14} /> Volume — Últimos 7 Dias
                                </div>
                                <div className="settings-section-desc">{encSemana.length} encomenda(s) esta semana</div>
                            </div>
                            <div className="settings-section-body">
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
                                    {dailyVolume.map(d => (
                                        <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: d.count > 0 ? 'var(--blue)' : 'var(--text-muted)' }}>
                                                {d.count > 0 ? d.count : ''}
                                            </span>
                                            <div style={{
                                                width: '100%', background: d.count > 0 ? 'var(--blue)' : 'var(--bg-secondary)',
                                                borderRadius: '4px 4px 0 0',
                                                height: d.count > 0 ? `${Math.round((d.count / maxDaily) * 88)}px` : '4px',
                                                minHeight: 4, transition: 'height 0.3s',
                                                opacity: d.date === todayStr ? 1 : 0.7,
                                            }} />
                                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.2 }}>
                                                {d.label.split(',')[0]}<br />{d.label.split(',')[1]?.trim()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Encomendas em Aberto ── */}
                    <div className="settings-section" style={{ margin: '0 0 16px' }}>
                        <div className="settings-section-hdr">
                            <div className="settings-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <ShoppingCart size={14} style={{ color: '#3b82f6' }} /> Encomendas em Aberto
                            </div>
                            <div className="settings-section-desc">Encomendas pendentes de recepção completa</div>
                        </div>
                        <div className="settings-section-body" style={{ padding: 0 }}>
                            {encEmAberto.length === 0 ? (
                                <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.83rem' }}>
                                    <CheckCircle2 size={28} style={{ margin: '0 auto 8px', display: 'block', color: '#16a34a' }} />
                                    Sem encomendas em aberto
                                </div>
                            ) : (
                                <div className="table-wrap">
                                    <table className="data-table">
                                        <thead><tr>
                                            <th>Número</th><th>Fornecedor</th><th>Data</th>
                                            <th>Entrega Prevista</th><th>Estado</th>
                                            <th style={{ textAlign: 'right' }}>Valor</th>
                                            <th style={{ textAlign: 'right' }}>% Recebido</th>
                                        </tr></thead>
                                        <tbody>
                                            {encEmAberto.map(e => {
                                                const totalQtd  = e.linhas.reduce((s, l) => s + l.qtdEncomendada, 0);
                                                const recQtd    = e.linhas.reduce((s, l) => s + l.qtdRecebida, 0);
                                                const pctRec    = totalQtd > 0 ? Math.round(recQtd / totalQtd * 100) : 0;
                                                const atrasada  = e.dataEntrega && e.dataEntrega < todayStr;
                                                const es = ESTADO_STYLE[e.estado];
                                                return (
                                                    <tr key={e.id} style={atrasada ? { background: '#fff5f5' } : {}}>
                                                        <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: 'var(--blue)' }}>{e.numero}</td>
                                                        <td style={{ fontSize: '0.83rem', fontWeight: 600 }}>{getFornNome(e.fornecedorId)}</td>
                                                        <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{fmtDate(e.data)}</td>
                                                        <td style={{ fontSize: '0.78rem', color: atrasada ? '#dc2626' : 'var(--text-secondary)', fontWeight: atrasada ? 700 : 400 }}>
                                                            {atrasada && <AlertTriangle size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                                                            {fmtDate(e.dataEntrega)}
                                                        </td>
                                                        <td><span className={es.cls}>{es.label}</span></td>
                                                        <td style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 600 }}>{fmtMoney(encTotal(e))}</td>
                                                        <td style={{ textAlign: 'right', fontSize: '0.78rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                                                                <div style={{ width: 48, height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                                                                    <div style={{ height: '100%', width: `${pctRec}%`, background: '#16a34a', borderRadius: 3 }} />
                                                                </div>
                                                                <span style={{ minWidth: 28 }}>{pctRec}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Encomendas em Atraso ── */}
                    <div className="settings-section" style={{ margin: 0 }}>
                        <div className="settings-section-hdr">
                            <div className="settings-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <AlertTriangle size={14} style={{ color: '#dc2626' }} /> Encomendas em Atraso
                            </div>
                            <div className="settings-section-desc">Pedidos que ultrapassaram o prazo previsto de entrega</div>
                        </div>
                        <div className="settings-section-body" style={{ padding: 0 }}>
                            {encEmAtraso.length === 0 ? (
                                <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.83rem' }}>
                                    <CheckCircle2 size={28} style={{ margin: '0 auto 8px', display: 'block', color: '#16a34a' }} />
                                    Nenhuma encomenda em atraso
                                </div>
                            ) : (
                                <div className="table-wrap">
                                    <table className="data-table">
                                        <thead><tr>
                                            <th>Número</th><th>Fornecedor</th><th>Entrega Prevista</th>
                                            <th style={{ textAlign: 'right' }}>Dias Atraso</th>
                                            <th>Estado</th>
                                            <th style={{ textAlign: 'right' }}>Valor</th>
                                        </tr></thead>
                                        <tbody>
                                            {encEmAtraso
                                                .slice()
                                                .sort((a, b) => (a.dataEntrega ?? '').localeCompare(b.dataEntrega ?? ''))
                                                .map(e => {
                                                    const dias = e.dataEntrega
                                                        ? Math.floor((today.getTime() - new Date(e.dataEntrega).getTime()) / 86400000)
                                                        : 0;
                                                    const es = ESTADO_STYLE[e.estado];
                                                    return (
                                                        <tr key={e.id} style={{ background: '#fff5f5' }}>
                                                            <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: '#dc2626' }}>{e.numero}</td>
                                                            <td style={{ fontSize: '0.83rem', fontWeight: 600 }}>{getFornNome(e.fornecedorId)}</td>
                                                            <td style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600 }}>{fmtDate(e.dataEntrega)}</td>
                                                            <td style={{ textAlign: 'right' }}>
                                                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#dc2626', background: '#fee2e2', borderRadius: 10, padding: '2px 8px' }}>
                                                                    +{dias}d
                                                                </span>
                                                            </td>
                                                            <td><span className={es.cls}>{es.label}</span></td>
                                                            <td style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 600 }}>{fmtMoney(encTotal(e))}</td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
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

            {convertFatEncomenda && (
                <ConvertFaturaModal
                    encomenda={convertFatEncomenda}
                    onClose={() => setConvertFatId(null)}
                    onConfirm={data => handleConvertToFatura(convertFatEncomenda.id, data)}
                />
            )}

            {showCompraDireta && (
                <CompraDiretaModal
                    onClose={() => setShowCompraDireta(false)}
                    onSave={handleCompraDireta}
                />
            )}

            {pagarModalId && ReactDOM.createPortal(
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#ffffff', borderRadius: 10, padding: 24, width: 400, boxShadow: '0 8px 40px rgba(0,0,0,0.32)', border: '1px solid #e5e7eb' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <CreditCard size={16} style={{ color: '#16a34a' }} /> Registar Pagamento
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                Data de Pagamento
                                <input type="date" className="form-input" value={pagarData} onChange={e => setPagarData(e.target.value)} style={{ marginTop: 4 }} />
                            </label>
                            <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                Modo de Pagamento
                                <select className="form-input" value={pagarModoId} onChange={e => setPagarModoId(e.target.value)} style={{ marginTop: 4 }}>
                                    <option value="">— Seleccionar —</option>
                                    {modosPagamento.map(m => <option key={m.id} value={m.id}>{m.descricao}</option>)}
                                </select>
                            </label>
                            <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                Referência da Transacção
                                <input type="text" className="form-input" placeholder="Nº transferência, cheque, etc." value={pagarRef} onChange={e => setPagarRef(e.target.value)} style={{ marginTop: 4 }} />
                            </label>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
                            <button type="button" className="abtn abtn-secondary" onClick={() => setPagarModalId(null)}>Cancelar</button>
                            <button type="button" className="abtn abtn-success" onClick={handleConfirmarPagamento}>
                                <Check size={13} /> Confirmar Pagamento
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
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

            {previewHtml && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, fontWeight: 700, fontSize: '0.85rem' }}>Pré-visualização</span>
                        <button type="button" className="abtn abtn-secondary" onClick={() => setPreviewHtml('')}>
                            <X size={13} /> Fechar
                        </button>
                    </div>
                    <iframe srcDoc={previewHtml} title="Pré-visualização" style={{ flex: 1, border: 'none', background: '#fff' }} />
                </div>
            )}
        </AppLayout>
    );
};

export default EncomendaPage;
