import React, { useState, useMemo, useEffect, useCallback } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import { showToast as notify } from '../../utils/errorHandler';
import ActionBar from '../../components/Layout/ActionBar';
import SearchableSelect from '../../components/SearchableSelect';
import api from '../../services/api';
import OtAnexosSection from './OtAnexosSection';
import {
    useGlobal, OrdemTrabalho, OTEstado, OTTipo, OTMaoObra, OTArtigo,
    EquipInstalado, ModeloEquipamento, Cliente,
    NaturezaIntervencao, OTPrioridade, NATUREZAS_INTERVENCAO, OT_PRIORIDADES,
} from '../../contexts/GlobalContext';
import {
    Search, Plus, Filter, Eye, X, AlertCircle, Check, Printer,
    Clock, PlayCircle, CheckCircle, Archive,
    Trash2, Download, Package, ClipboardList,
} from 'lucide-react';
import ExportModal, { ExportCol } from '../../components/ExportModal';
import EmptyState from '../../components/EmptyState';
import TableSkeleton from '../../components/TableSkeleton';
import { imprimirPdf } from '../../utils/imprimirPdf';

/* ── Constants ───────────────────────────────────────── */
const ESTADO_CONFIG: Record<OTEstado, { dot: string; label: string; icon: React.ReactNode }> = {
    'Registada':   { dot: 'dot-gray',   label: 'Registada',   icon: <Clock      size={13} /> },
    'Programada':  { dot: 'dot-blue',   label: 'Programada',  icon: <Clock      size={13} /> },
    'Adiada':      { dot: 'dot-orange', label: 'Adiada',      icon: <AlertCircle size={13} /> },
    'Confirmada':  { dot: 'dot-purple', label: 'Confirmada',  icon: <CheckCircle size={13} /> },
    'Em execução': { dot: 'dot-yellow', label: 'Em execução', icon: <PlayCircle size={13} /> },
    'Finalizada':  { dot: 'dot-green',  label: 'Finalizada',  icon: <Archive    size={13} /> },
};
const PERIOD_OPTIONS = ['Mensal', 'Trimestral', 'Semestral', 'Anual', 'Única'];

/** fmtDate para uso em printOT (fora do React) — recebe formatoData da empresa */
function makePrintDate(formatoData?: string) {
    return (d?: string): string => {
        if (!d) return '—';
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return '—';
        const dd = String(dt.getDate()).padStart(2, '0');
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const yyyy = String(dt.getFullYear());
        if (formatoData === 'YYYY-MM-DD') return `${yyyy}-${mm}-${dd}`;
        if (formatoData === 'MM/DD/YYYY') return `${mm}/${dd}/${yyyy}`;
        return `${dd}/${mm}/${yyyy}`;
    };
}
const today = () => new Date().toISOString().split('T')[0];

const COLS_OT: ExportCol[] = [
    { key: 'id',             label: 'Nº OT' },
    { key: 'tipo',           label: 'Tipo' },
    { key: 'equipamento',    label: 'Equipamento' },
    { key: 'clienteNome',    label: 'Cliente' },
    { key: 'responsavel',    label: 'Responsável' },
    { key: 'dataAgendada',   label: 'Data Agendada' },
    { key: 'estado',         label: 'Estado' },
    { key: 'naturezaIntervencao', label: 'Natureza' },
];

/* ── Intervenções print helpers ── */
const isCorretivo = (ot: OrdemTrabalho) =>
    ot.naturezaIntervencao === 'Reparação de avaria';

const INTERV_CSS = `
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
  body   { font-family: Arial, sans-serif; font-size: 11px; padding: 12mm 18mm; color: #1a1a1a; }
  h1     { font-size: 1rem; margin: 0; }
  .sub   { font-size: 0.68rem; color: #888; margin: 2px 0 14px; }
  .hrow  { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 0.68rem; font-weight: 700; border: 1.5px solid #555; color: #333; background: #f5f5f5; }
  .sec   { font-size: 0.8rem; font-weight: 700; color: #2B2B2B; border-bottom: 1.5px solid #2B2B2B; padding-bottom: 3px; margin: 14px 0 5px; }
  table  { width: 100%; border-collapse: collapse; margin-bottom: 4px; page-break-inside: auto; }
  thead  { display: table-header-group; }
  th     { background: #2B2B2B; color: #fff; padding: 5px 8px; font-size: 0.7rem; font-weight: 700; border: 1px solid #444; text-align: left; }
  td     { padding: 4px 8px; border: 1px solid #ddd; font-size: 0.75rem; vertical-align: top; }
  tr:nth-child(even) td { background: #f9f9f9; }
  tr:nth-child(odd)  td { background: #fff; }
  .corr  { color: #f97316; font-weight: 700; }
  .eq-group { margin-bottom: 18px; page-break-inside: avoid; }
  .footer { margin-top: 18px; font-size: 0.62rem; color: #bbb; text-align: center; border-top: 1px solid #eee; padding-top: 5px; }
  @page { size: A4 landscape; margin: 0; }
`;

function fDInterv(d?: string) { return d ? new Date(d).toLocaleDateString('pt-PT') : '—'; }

function otEstadoCor(estado: string) {
    if (estado === 'Finalizada')  return '#16a34a';
    if (estado === 'Em execução') return '#eab308';
    if (estado === 'Adiada')      return '#f97316';
    if (estado === 'Confirmada')  return '#7c3aed';
    if (estado === 'Registada')   return '#6b7280';
    return '#2563eb';
}

function openPrintI(html: string, title: string) {
    void imprimirPdf(html, title);
}

function buildHistoricoGeralHtml(
    ots: OrdemTrabalho[],
    equipInstalados: EquipInstalado[],
    clientes: Cliente[],
    modelosEquipamento: ModeloEquipamento[],
    dateFrom: string,
    dateTo: string,
    equipIds: string[],
    empresa: string,
): string {
    const refDate = (o: OrdemTrabalho) => o.dataAgendada || '';
    const filtrado = ots.filter(o => {
        const d = refDate(o);
        const equipMatch = equipIds.length === 0 || equipIds.includes(String(o.equipInstaladoId));
        return equipMatch && (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
    }).sort((a, b) => refDate(a).localeCompare(refDate(b)));

    const grupos = new Map<string, OrdemTrabalho[]>();
    for (const o of filtrado as OrdemTrabalho[]) {
        const key = String(o.equipInstaladoId);
        if (!grupos.has(key)) grupos.set(key, []);
        grupos.get(key)!.push(o);
    }

    let body = '';
    for (const [eqId, eqOts] of Array.from(grupos.entries())) {
        const eq  = equipInstalados.find(e => String(e.id) === eqId);
        const cli = clientes.find(c => String(c.id) === String(eq?.clienteId));
        const mod = modelosEquipamento.find(m => String(m.id) === String(eq?.modeloId));
        const rows = eqOts.map(o => `<tr>
            <td style="font-family:monospace">${o.id}</td>
            <td>${o.tipo === 'pontual' ? 'Pontual' : 'Programada'}</td>
            <td>${o.naturezaIntervencao ?? '—'}${isCorretivo(o) ? ' <span class="corr">●</span>' : ''}</td>
            <td style="color:${otEstadoCor(o.estado)};font-weight:600">${o.estado}</td>
            <td>${fDInterv(refDate(o))}</td>
            <td>${fDInterv(o.dataFim)}</td>
            <td>${o.descricao || '—'}</td>
        </tr>`).join('');
        body += `<div class="eq-group">
  <div class="sec">Equip. ${eqId} — ${mod?.nome ?? '—'} &nbsp;|&nbsp; Cliente: ${cli?.nome ?? '—'} &nbsp;|&nbsp; Série: ${eq?.nrSerie ?? '—'}</div>
  <table>
    <thead><tr><th>ID OT</th><th>Tipo OT</th><th>Tipo Trabalho</th><th>Estado</th><th>Agendada</th><th>Data Fim</th><th>Descrição</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
    }

    const periodo = dateFrom || dateTo
        ? `Período: ${dateFrom ? fDInterv(dateFrom) : '—'} a ${dateTo ? fDInterv(dateTo) : '—'}`
        : 'Todos os períodos';

    return `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>Relatório de Intervenções</title>
<style>${INTERV_CSS}</style></head><body>
<div class="hrow">
  <div><h1>${empresa} — Relatório de Intervenções</h1>
  <div class="sub">${periodo} &nbsp;|&nbsp; Impresso em ${new Date().toLocaleString('pt-PT')}</div></div>
  <span class="badge">${filtrado.length} intervenção(ões)</span>
</div>
${body || '<p style="color:#999;text-align:center">Nenhuma intervenção encontrada no período seleccionado.</p>'}
<div class="footer">${empresa} &nbsp;&bull;&nbsp; Sistema de Gestão de Intervenções</div>
</body></html>`;
}

function printHistoricoGeral(
    ots: OrdemTrabalho[],
    equipInstalados: EquipInstalado[],
    clientes: Cliente[],
    modelosEquipamento: ModeloEquipamento[],
    dateFrom: string,
    dateTo: string,
    equipIds: string[],
    empresa: string,
) {
    openPrintI(buildHistoricoGeralHtml(ots, equipInstalados, clientes, modelosEquipamento, dateFrom, dateTo, equipIds, empresa), 'Relatório de Intervenções');
}

/* ── Relatório de Intervenções Modal ── */
const RelatorioIntervModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { equipInstalados, clientes, modelosEquipamento, ordens, empresaConfig } = useGlobal();
    const [dateFrom,   setDateFrom]   = useState('');
    const [dateTo,     setDateTo]     = useState('');
    const [equipIds,   setEquipIds]   = useState<string[]>([]);
    const [equipSearch, setEquipSearch] = useState('');
    const [previewHtml, setPreviewHtml] = useState('');

    const allEquips = equipInstalados.map(e => {
        const cli = clientes.find(c => String(c.id) === String(e.clienteId))?.nome ?? '—';
        const mod = modelosEquipamento.find(m => String(m.id) === String(e.modeloId))?.nome ?? '—';
        return { id: e.id, label: `${e.id} — ${mod}`, sub: cli };
    });

    const visibleEquips = equipSearch.trim()
        ? allEquips.filter(e => `${e.label} ${e.sub}`.toLowerCase().includes(equipSearch.toLowerCase()))
        : allEquips;

    const toggle = (id: string) =>
        setEquipIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const selectAll  = () => setEquipIds(allEquips.map(e => e.id));
    const clearAll   = () => setEquipIds([]);

    const selLabel = equipIds.length === 0
        ? 'Todos os equipamentos'
        : `${equipIds.length} equipamento(s) seleccionado(s)`;

    const buildHtml = () => buildHistoricoGeralHtml(ordens, equipInstalados, clientes, modelosEquipamento, dateFrom, dateTo, equipIds, empresaConfig?.nome || 'AQUATEX');
    const handlePreview = () => setPreviewHtml(buildHtml());
    const handlePrint   = () => printHistoricoGeral(ordens, equipInstalados, clientes, modelosEquipamento, dateFrom, dateTo, equipIds, empresaConfig?.nome || 'AQUATEX');

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            {previewHtml && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, fontWeight: 700, fontSize: '0.85rem' }}>Pré-visualização</span>
                        <button type="button" className="abtn abtn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Printer size={13} /> Imprimir
                        </button>
                        <button type="button" className="abtn abtn-secondary" onClick={() => setPreviewHtml('')}>
                            <X size={13} /> Fechar
                        </button>
                    </div>
                    <iframe srcDoc={previewHtml} title="Pré-visualização" style={{ flex: 1, border: 'none', background: '#fff' }} />
                </div>
            )}
            <div className="modal" style={{ maxWidth: 520 }}>
                <div className="modal-header">
                    <h3 className="modal-title">Relatório de Intervenções</h3>
                    <button className="modal-close" aria-label="Fechar" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body">
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Data Início</label>
                            <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Data Fim</label>
                            <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                        </div>
                    </div>

                    <div className="form-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <label className="form-label" style={{ margin: 0 }}>
                                Equipamentos &nbsp;<span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({selLabel})</span>
                            </label>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button type="button" className="abtn abtn-secondary" style={{ padding: '2px 8px', fontSize: '0.72rem' }} onClick={selectAll}>Todos</button>
                                <button type="button" className="abtn abtn-secondary" style={{ padding: '2px 8px', fontSize: '0.72rem' }} onClick={clearAll}>Nenhum</button>
                            </div>
                        </div>
                        <div style={{ position: 'relative', marginBottom: 6 }}>
                            <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                className="form-input"
                                style={{ paddingLeft: 26, fontSize: '0.8rem' }}
                                placeholder="Pesquisar equipamento..."
                                value={equipSearch}
                                onChange={e => setEquipSearch(e.target.value)}
                            />
                        </div>
                        <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 3 }}>
                            {visibleEquips.length === 0 ? (
                                <div style={{ padding: '10px 12px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Nenhum equipamento encontrado.</div>
                            ) : visibleEquips.map(e => (
                                <label key={e.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                                    cursor: 'pointer', borderBottom: '1px solid var(--border)',
                                    background: equipIds.includes(e.id) ? 'rgba(37,99,235,0.05)' : undefined,
                                    fontSize: '0.8rem',
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={equipIds.includes(e.id)}
                                        onChange={() => toggle(e.id)}
                                        style={{ accentColor: 'var(--blue)', flexShrink: 0 }}
                                    />
                                    <span style={{ flex: 1 }}>
                                        <span style={{ fontWeight: 600 }}>{e.label}</span>
                                        <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: '0.74rem' }}>{e.sub}</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="abtn abtn-secondary" type="button" onClick={onClose}>Cancelar</button>
                    <button className="abtn abtn-secondary" type="button" onClick={handlePreview} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Eye size={12} /> Pré-visualizar
                    </button>
                    <button className="abtn abtn-primary" type="button" onClick={handlePrint}>
                        <Printer size={12} /> Imprimir Relatório
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ── Standalone print helper (used by modal & context menu) ── */
const OT_CSS = `
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
  body   { font-family: Arial, sans-serif; font-size: 12px; padding: 15mm 20mm; color: #1a1a1a; max-width: 760px; margin: 0 auto; }
  .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
  h1     { font-size: 1rem; margin: 0; }
  .sub   { font-size: 0.7rem; color: #888; margin: 2px 0 16px; }
  .badge { display: inline-block; padding: 3px 12px; border-radius: 12px; font-size: 0.7rem; font-weight: 700; border: 1.5px solid #555; color: #333; background: #f5f5f5; }
  .sec-title { font-size: 0.82rem; margin: 16px 0 5px; border-bottom: 1.5px solid #2B2B2B; padding-bottom: 3px; color: #2B2B2B; }
  table  { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  thead tr { background: #2B2B2B; }
  th     { background: #2B2B2B; color: #fff; padding: 6px 9px; font-size: 0.72rem; font-weight: 700; letter-spacing: .04em; border: 1px solid #444; text-align: left; }
  td     { padding: 5px 9px; border: 1px solid #ddd; font-size: 0.78rem; vertical-align: top; }
  .info-table td:first-child { width: 30%; background: #f5f5f5; font-weight: 600; color: #444; }
  tr:nth-child(even) td { background: #f9f9f9; }
  tr:nth-child(odd)  td { background: #fff; }
  .info-table tr:nth-child(even) td:first-child,
  .info-table tr:nth-child(odd)  td:first-child { background: #f5f5f5; }
  .summary-row td { background: #f0f4ff !important; font-size: 0.76rem; color: #444; border-top: 1px solid #ccc; }
  .summary-total td { background: #2B2B2B !important; color: #fff !important; font-weight: 700; font-size: 0.8rem; border-top: 2px solid #000; }
  .sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 28px; }
  .sign-box  { border: 1px solid #bbb; border-radius: 4px; padding: 12px 16px; }
  .sign-lbl  { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #555; margin-bottom: 6px; }
  .sign-name { font-size: 0.76rem; color: #555; margin-bottom: 4px; }
  .sign-line { border-top: 1px solid #555; margin-top: 46px; padding-top: 4px; font-size: 0.65rem; color: #888; }
  .footer    { margin-top: 20px; font-size: 0.65rem; color: #bbb; text-align: center; border-top: 1px solid #eee; padding-top: 6px; }
  @page { size: A4; margin: 0; }
`;

function buildOTHtml(
    ot: OrdemTrabalho,
    equipInstalados: EquipInstalado[],
    modelosEquipamento: ModeloEquipamento[],
    clientes: Cliente[],
    empresa?: import('../../contexts/GlobalContext').EmpresaConfig,
    simbolo?: string,
    assinaturaDataUrl?: string,   // #47 — assinatura do cliente embebida na ficha
): string {
    const fmtDate = makePrintDate(empresa?.formatoData);
    const equip = equipInstalados.find(e => e.id === ot.equipInstaladoId);
    const mod   = modelosEquipamento.find(m => m.id === equip?.modeloId)?.nome ?? '—';
    const cli   = clientes.find(c => c.id === ot.clienteId)?.nome ?? '—';
    const empresaNome = empresa?.nome || 'AQUATEX';

    const artsHtml = (() => {
        if ((ot.artigos?.length ?? 0) === 0) return '';
        const sim = simbolo ?? 'Kz';
        const rows = ot.artigos.map(a =>
            `<tr><td>${a.descricao}</td><td style="text-align:center">${a.quantidade}</td><td style="text-align:right">${a.preco.toLocaleString('pt-PT')}</td><td style="text-align:right">${(a.quantidade * a.preco).toLocaleString('pt-PT')}</td></tr>`
        ).join('');
        const subtotal = ot.artigos.reduce((s, a) => s + a.quantidade * a.preco, 0);
        // Group IVA by rate (only articles with codigoIva/taxaIva > 0)
        const ivaMap: Record<string, { label: string; valor: number }> = {};
        for (const a of ot.artigos) {
            if (!a.codigoIva || !a.taxaIva || a.taxaIva <= 0) continue;
            const key = a.codigoIva;
            if (!ivaMap[key]) ivaMap[key] = { label: `IVA ${a.codigoIva} (${a.taxaIva}%)`, valor: 0 };
            ivaMap[key].valor += a.quantidade * a.preco * (a.taxaIva / 100);
        }
        const ivaEntries = Object.values(ivaMap);
        const totalIva = ivaEntries.reduce((s, x) => s + x.valor, 0);
        const total = subtotal + totalIva;
        const ivaRows = ivaEntries.map(iv =>
            `<tr class="summary-row"><td colspan="3" style="text-align:right;font-style:italic">${iv.label}</td><td style="text-align:right">${iv.valor.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</td></tr>`
        ).join('');
        const summaryRows = `
<tr class="summary-row"><td colspan="3" style="text-align:right">Subtotal</td><td style="text-align:right">${subtotal.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} ${sim}</td></tr>
${ivaRows}
<tr class="summary-total"><td colspan="3" style="text-align:right">Total</td><td style="text-align:right">${total.toLocaleString('pt-PT', { minimumFractionDigits: 2 })} ${sim}</td></tr>`;
        return `<h3 class="sec-title">Artigos / Consumíveis</h3>
<table><thead><tr><th>Descrição</th><th style="text-align:center">Qtd</th><th style="text-align:right">Preço Unit. (${sim})</th><th style="text-align:right">Total (${sim})</th></tr></thead><tbody>
${rows}${summaryRows}
</tbody></table>`;
    })();

    const diagHtml = ot.orgao
        ? `<h3 class="sec-title">Diagnóstico</h3>
<table class="info-table">
<tr><td>Órgão</td><td>${ot.orgao}</td></tr>
<tr><td>Sintoma</td><td>${ot.sintoma ?? '—'}</td></tr>
<tr><td>Causa</td><td>${ot.causa ?? '—'}</td></tr>
</table>` : '';

    return `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>OT ${ot.id}</title>
<style>${OT_CSS}</style></head><body>
<div class="header-row">
  <div>
    <h1>${empresaNome} — Ordem de Trabalho</h1>
    <div class="sub">Nº: <strong>${ot.id}</strong> &nbsp;|&nbsp; Impresso em ${new Date().toLocaleString('pt-PT')}</div>
  </div>
  <span class="badge">${ot.estado}</span>
</div>
<h3 class="sec-title">Identificação</h3>
<table class="info-table">
<tr><td>Tipo</td><td>${ot.tipo === 'periodica' ? 'Programada' : 'Pontual'} — ${ot.naturezaIntervencao ?? '—'}</td></tr>
<tr><td>Equipamento</td><td>${equip?.id ?? '—'} — ${mod} <span style="color:#888">(${equip?.nrSerie ?? '—'})</span></td></tr>
<tr><td>Cliente</td><td>${cli}</td></tr>
<tr><td>Responsável</td><td>${ot.responsavel}</td></tr>
<tr><td>Descrição</td><td>${ot.descricao}</td></tr>
${ot.periodicidade ? `<tr><td>Periodicidade</td><td>${ot.periodicidade}</td></tr>` : ''}
${ot.previsaoTempo  ? `<tr><td>Previsão Tempo</td><td>${ot.previsaoTempo}h</td></tr>` : ''}
</table>
<h3 class="sec-title">Datas</h3>
<table class="info-table">
${ot.dataAgendada    ? `<tr><td>Data Agendada</td><td>${fmtDate(ot.dataAgendada)}</td></tr>` : ''}
${ot.dataExecucao    ? `<tr><td>Data de Execução</td><td>${fmtDate(ot.dataExecucao)}</td></tr>` : ''}
${ot.dataInicio      ? `<tr><td>Início Efectivo</td><td>${fmtDate(ot.dataInicio)}</td></tr>` : ''}
${ot.dataFim         ? `<tr><td>Fim Efectivo</td><td>${fmtDate(ot.dataFim)}</td></tr>` : ''}
</table>
${artsHtml}${diagHtml}
<div class="sign-grid">
  <div class="sign-box">
    <div class="sign-lbl">Técnico de Campo</div>
    <div class="sign-name">${ot.responsavel ?? '—'}</div>
    <div class="sign-line">Assinatura &amp; Data</div>
  </div>
  <div class="sign-box">
    <div class="sign-lbl">Cliente / Responsável</div>
    <div class="sign-name">${cli}</div>
    ${assinaturaDataUrl ? `<img src="${assinaturaDataUrl}" alt="Assinatura do cliente" style="max-height:60px;max-width:100%;display:block;margin:2px auto 0" />` : ''}
    <div class="sign-line">Assinatura &amp; Data</div>
  </div>
</div>
<div class="footer">${empresaNome} &nbsp;&bull;&nbsp; Sistema de Gestão de Intervenções</div>
</body></html>`;
}

/** #47 — busca a assinatura da OT (se existir) como data URL PNG para embeber na ficha. */
async function fetchAssinaturaDataUrl(otId: number | string): Promise<string | undefined> {
    try {
        const { data } = await api.get<{ id: number; tipo: string }[]>(`/ordens/${otId}/anexos`);
        const ass = data.find(a => a.tipo === 'assinatura');
        if (!ass) return undefined;
        const resp = await api.get(`/ordens/${otId}/anexos/${ass.id}/ficheiro`, { responseType: 'blob' });
        return await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onloadend = () => resolve(r.result as string);
            r.onerror = reject;
            r.readAsDataURL(resp.data);
        });
    } catch {
        return undefined;   // sem assinatura ou erro → imprime sem imagem
    }
}

async function printOT(
    ot: OrdemTrabalho,
    equipInstalados: EquipInstalado[],
    modelosEquipamento: ModeloEquipamento[],
    clientes: Cliente[],
    empresa?: import('../../contexts/GlobalContext').EmpresaConfig,
    simbolo?: string,
) {
    // #182 — a janela abre já (no clique); a assinatura é obtida enquanto mostra "A gerar o PDF…".
    await imprimirPdf(async () => {
        const assinatura = await fetchAssinaturaDataUrl(ot.id);
        return buildOTHtml(ot, equipInstalados, modelosEquipamento, clientes, empresa, simbolo, assinatura);
    }, ot.numero ?? `OT ${ot.id}`);
}

/* ══ OT Form Modal ═══════════════════════════════════════ */
interface OTFormProps {
    ot?: OrdemTrabalho;
    onClose: () => void;
    onSave: (o: Omit<OrdemTrabalho, 'id'>) => void;
    acoes?: { label: string; target: string; run: () => void }[];
    readOnly?: boolean;
}

const OTForm: React.FC<OTFormProps> = ({ ot, onClose, onSave, acoes, readOnly }) => {
    const { equipInstalados, clientes, modelosEquipamento, planos, funcoesTecnico, artigos: catalog, tecnicos, currentUser, taxasIva, fmtMoney, simboloMoeda, empresaConfig } = useGlobal();
    const isTecnicoCampo = currentUser?.role === 'Técnico de Campo';
    // Issue #71 — 5 abas semânticas alinhadas com o ciclo de vida da OT.
    type TabId = 'identificacao' | 'cliente' | 'agendamento' | 'execucao' | 'gestao';
    const [tab, setTab] = useState<TabId>('identificacao');

    // Origem
    const [tipo, setTipo]           = useState<OTTipo>(ot?.tipo ?? 'pontual');
    const [equipId, setEquipId]     = useState(ot?.equipInstaladoId ?? '');
    const [clienteId, setClienteId] = useState(ot?.clienteId ?? '');
    const [descricao, setDesc]      = useState(ot?.descricao ?? '');
    const [previsao, setPrevisao]   = useState(String(ot?.previsaoTempo ?? ''));
    const [periodo, setPeriodo]     = useState(ot?.periodicidade ?? 'Mensal');
    const [planoId, setPlanoId]     = useState(ot?.planoId ?? '');
    // RF-OT-002 §3.1 — novos campos da marcação
    const [naturezaIntervencao, setNatureza] = useState<NaturezaIntervencao | ''>((ot?.naturezaIntervencao ?? '') as any);
    const [prioridade, setPrioridade]        = useState<OTPrioridade>(ot?.prioridade ?? 'Normal');
    // Técnico executante (FK) — fonte única do "responsável" (issue #76). Auto-atribui
    // ao próprio quando um técnico de campo cria a OT.
    const [executadoPorId, setExecutadoPorId] = useState(ot?.executadoPorId ?? (!ot && isTecnicoCampo ? (currentUser?.tecnicoId ?? '') : ''));

    // Mão de obra
    const [maos, setMaos] = useState<OTMaoObra[]>(ot?.maosDeObra ?? []);

    // Artigos
    const [arts, setArts] = useState<OTArtigo[]>(ot?.artigos ?? []);

    // Auto-load from plano when OT is Programado with planoId but has no mão de obra/artigos
    useEffect(() => {
        if (!ot || ot.estado === 'Em execução' || ot.estado === 'Finalizada') return;
        if (!ot.planoId) return;
        if ((ot.maosDeObra?.length ?? 0) > 0 || (ot.artigos?.length ?? 0) > 0) return;
        const plano = planos.find(p => p.id === ot.planoId);
        if (!plano) return;
        setMaos(plano.maosDeObra.map(m => {
            const f = funcoesTecnico.find(x => x.id === m.funcaoId);
            return { funcao: f?.descricao ?? m.funcaoId, custo: m.custo, hora: '08:00' };
        }));
        setArts(plano.artigos.map(a => {
            const art = catalog.find(x => x.id === a.artigoId);
            return { artigoId: a.artigoId, descricao: art?.descricao ?? '—', quantidade: a.quantidade, preco: a.preco };
        }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Diagnóstico
    const [orgao, setOrgao]   = useState(ot?.orgao   ?? '');
    const [sintoma, setSin]   = useState(ot?.sintoma  ?? '');
    const [causa, setCausa]   = useState(ot?.causa    ?? '');

    // Gestão
    const [dpI, setDpI] = useState(ot?.dataAgendada   ?? '');
    const [dIn, setDIn] = useState(ot?.dataInicio     ?? '');
    const [dFi, setDFi] = useState(ot?.dataFim        ?? '');


    const [errors, setErrors] = useState<Record<string, string>>({});

    // Derived
    // RF-OT-002 §6 CA: máquinas filtradas pelo cliente seleccionado
    const equipOpts = equipInstalados
        .filter(e => !clienteId || String(e.clienteId) === String(clienteId))
        .map(e => {
            const cli = clientes.find(c => c.id === e.clienteId)?.nome ?? '—';
            const mod = modelosEquipamento.find(m => m.id === e.modeloId)?.nome ?? '—';
            return { value: e.id, label: `${e.id} — ${mod}`, sub: `${cli} · ${e.nrSerie}` };
        });
    const clienteOpts = clientes.map(c => ({ value: c.id, label: c.nome, sub: c.nif }));
    const tecCampoFkOpts = tecnicos.filter(t => t.ativo).map(t => ({ value: t.id, label: t.nome, sub: funcoesTecnico.find(f => f.id === t.funcaoId)?.descricao }));
    const planoOpts = planos.filter(p => p.equipInstaladoId === equipId).map(p => ({ value: p.id, label: p.descricao, sub: `${p.periodicidade} · ${p.previsaoTempo}h` }));
    const catalogOpts = catalog.filter(a => !a.inativo).map(a => {
        const disponivel = a.existencia - a.stockReservado;
        return {
            value: a.id,
            label: a.descricao,
            sub: `${a.codigo} · ${disponivel <= 0 ? `⚠ Disp: ${disponivel}` : `Disp: ${disponivel}`}${a.stockReservado > 0 ? ` (Res: ${a.stockReservado})` : ''} · ${a.precoUnitario.toLocaleString('pt-PT')} Kz`,
        };
    });

    const onEquipChange = (id: string) => {
        setEquipId(id);
        const eq = equipInstalados.find(e => e.id === id);
        if (eq) setClienteId(eq.clienteId);
        setPlanoId('');
    };

    const loadPlano = (pid: string) => {
        const p = planos.find(x => x.id === pid);
        if (!p) return;
        setPlanoId(pid);
        setDesc(p.descricao);
        setPrevisao(String(p.previsaoTempo));
        setPeriodo(p.periodicidade);
        setMaos(p.maosDeObra.map(m => {
            const f = funcoesTecnico.find(x => x.id === m.funcaoId);
            return { funcao: f?.descricao ?? m.funcaoId, custo: m.custo, hora: '08:00' };
        }));
        setArts(p.artigos.map(a => {
            const art = catalog.find(x => x.id === a.artigoId);
            return { artigoId: a.artigoId, descricao: art?.descricao ?? '—', quantidade: a.quantidade, preco: a.preco };
        }));
    };

    // Auto-fill mão de obra quando o técnico executante é selecionado (nova OT)
    const handleExecutadoChange = (id: string) => {
        setExecutadoPorId(id);
        if (ot) return; // editing — don't override
        const tec = tecnicos.find(t => t.id === id);
        if (!tec) return;
        const funcao = funcoesTecnico.find(f => f.id === String(tec.funcaoId));
        if (funcao) setMaos([{ funcao: funcao.descricao, custo: funcao.custo, hora: '08:00' }]);
    };

    // Mão de obra ops
    const addMao = () => setMaos(p => [...p, { funcao: '', custo: 0, hora: '08:00' }]);
    const removeMao = (i: number) => setMaos(p => p.filter((_, idx) => idx !== i));
    const updateMaoFuncao = (i: number, funcaoDesc: string) => {
        const f = funcoesTecnico.find(x => x.descricao === funcaoDesc);
        setMaos(p => p.map((m, idx) => idx !== i ? m : { ...m, funcao: funcaoDesc, custo: f?.custo ?? m.custo }));
    };
    const updateMaoHora = (i: number, v: string) => setMaos(p => p.map((m, idx) => idx !== i ? m : { ...m, hora: v }));

    // Artigo ops
    const addArt = () => setArts(p => [...p, { artigoId: '', descricao: '', quantidade: 1, preco: 0 }]);
    const removeArt = (i: number) => setArts(p => p.filter((_, idx) => idx !== i));
    const updateArtId = (i: number, id: string) => {
        const a = catalog.find(x => x.id === id);
        const taxaIva = a?.codigoIva ? (taxasIva.find(t => t.codigo === a.codigoIva)?.taxa ?? undefined) : undefined;
        setArts(p => p.map((x, idx) => idx !== i ? x : { artigoId: id, descricao: a?.descricao ?? '', quantidade: x.quantidade, preco: a?.precoUnitario ?? 0, codigoIva: a?.codigoIva ?? undefined, taxaIva }));
    };
    const updateArtQtd = (i: number, v: string) => setArts(p => p.map((x, idx) => idx !== i ? x : { ...x, quantidade: Math.max(1, Number(v) || 1) }));

    // Issue #71 — devolve as keys com erro para o caller saltar para a aba certa.
    const validate = (): string[] => {
        const e: Record<string, string> = {};
        if (!naturezaIntervencao) e.natureza = 'Obrigatório';
        if (!equipId)          e.equip  = 'Obrigatório';
        if (!descricao.trim()) e.desc   = 'Obrigatório';
        setErrors(e);
        return Object.keys(e);
    };

    const buildOT = (): Omit<OrdemTrabalho, 'id'> => ({
        tipo, equipInstaladoId: equipId, clienteId,
        descricao, previsaoTempo: Number(previsao) || 0, periodicidade: tipo === 'periodica' ? periodo : undefined,
        planoId: planoId || undefined,
        maosDeObra: maos, artigos: arts,
        orgao: orgao || undefined, sintoma: sintoma || undefined, causa: causa || undefined,
        dataAgendada: dpI || undefined,
        dataInicio: dIn || undefined, dataFim: dFi || undefined,
        estado: ot?.estado ?? 'Registada',
        reprogramacoes: [],
        // RF-OT-002 §3.1
        naturezaIntervencao: naturezaIntervencao || undefined,
        prioridade,
        executadoPorId: executadoPorId || undefined,
    });

    // Issue #71 — mapeia cada campo validado à sua aba para podermos saltar para
    // a primeira aba que tenha erro depois de submeter.
    const FIELD_TAB: Record<string, TabId> = {
        natureza: 'identificacao',
        desc:     'identificacao',
        equip:    'cliente',
        resp:     'agendamento',
    };

    const handleOk = (ev: React.FormEvent) => {
        ev.preventDefault();
        const errKeys = validate();
        if (errKeys.length > 0) {
            const order: TabId[] = ['identificacao', 'cliente', 'agendamento', 'execucao', 'gestao'];
            const firstTab = order.find(t => errKeys.some(k => FIELD_TAB[k] === t)) ?? 'identificacao';
            setTab(firstTab);
            return;
        }
        onSave(buildOT());
    };

    const TABS: { id: TabId; label: string }[] = [
        { id: 'identificacao', label: 'Identificação'      },
        { id: 'cliente',       label: 'Cliente e Máquina'  },
        { id: 'agendamento',   label: 'Agendamento'        },
        { id: 'execucao',      label: 'Execução'           },
        { id: 'gestao',        label: 'Gestão'             },
    ];

    const [previewHtml, setPreviewHtml] = useState('');

    const handlePrint = () => {
        if (ot) printOT(ot, equipInstalados, modelosEquipamento, clientes, empresaConfig, simboloMoeda);
    };
    const handlePreview = () => {
        if (ot) setPreviewHtml(buildOTHtml(ot, equipInstalados, modelosEquipamento, clientes, empresaConfig, simboloMoeda));
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            {previewHtml && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, fontWeight: 700, fontSize: '0.85rem' }}>Pré-visualização</span>
                        <button type="button" className="abtn abtn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Printer size={13} /> Imprimir
                        </button>
                        <button type="button" className="abtn abtn-secondary" onClick={() => setPreviewHtml('')}>
                            <X size={13} /> Fechar
                        </button>
                    </div>
                    <iframe srcDoc={previewHtml} title="Pré-visualização" style={{ flex: 1, border: 'none', background: '#fff' }} />
                </div>
            )}
            <div className="modal" style={{ maxWidth: 700 }}>
                <div className="modal-header">
                    <div>
                        <h3 className="modal-title">{ot ? `${ot.id} — Ordem de Trabalho` : 'Nova Ordem de Trabalho'}</h3>
                        {ot && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                <span className={`dot ${ESTADO_CONFIG[ot.estado].dot}`} />
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{ot.estado}</span>
                                <span className="tbadge tbadge-admin">{ot.tipo === 'periodica' ? 'Programada' : 'Pontual'}</span>
                            </div>
                        )}
                    </div>
                    <button className="modal-close" aria-label="Fechar" type="button" onClick={onClose}><X size={13} /></button>
                </div>

                {/* Tab bar */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', padding: '0 16px' }}>
                    {TABS.map(t => (
                        <button key={t.id} type="button" onClick={() => setTab(t.id)}
                            style={{ padding: '8px 14px', fontSize: '0.8rem', fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? 'var(--blue)' : 'var(--text-secondary)', border: 'none', background: 'none', borderBottom: tab === t.id ? '2px solid var(--blue)' : '2px solid transparent', cursor: 'pointer', marginBottom: -1 }}>
                            {t.label}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleOk} noValidate>
                    <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>

                        {/* ── 1. IDENTIFICAÇÃO ── */}
                        {tab === 'identificacao' && (
                            <>
                                <div className="form-row">
                                    {ot?.numero && (
                                        <div className="form-group">
                                            <label className="form-label" style={{ color: 'var(--text-muted)' }}>Nº da Ordem</label>
                                            <input type="text" className="form-input" value={ot.numero} disabled />
                                        </div>
                                    )}
                                    <div className="form-group">
                                        <label className="form-label req">Tipo de OT</label>
                                        <select className="form-select" value={tipo} onChange={e => setTipo(e.target.value as OTTipo)}>
                                            <option value="pontual">Pontual</option>
                                            <option value="periodica">Periódica</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label req">Natureza da Intervenção</label>
                                        <select className={`form-select${errors.natureza ? ' err' : ''}`} value={naturezaIntervencao} onChange={e => setNatureza(e.target.value as any)}>
                                            <option value="">Seleccionar...</option>
                                            {NATUREZAS_INTERVENCAO.map(n => <option key={n} value={n}>{n}</option>)}
                                        </select>
                                        {errors.natureza && <span className="form-error"><AlertCircle size={11} /> {errors.natureza}</span>}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Prioridade</label>
                                        <select className="form-select" value={prioridade} onChange={e => setPrioridade(e.target.value as OTPrioridade)}>
                                            {OT_PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group" style={{ marginTop: 8 }}>
                                    <label className="form-label req">Descrição</label>
                                    <textarea className={`form-textarea${errors.desc ? ' err' : ''}`} value={descricao}
                                        onChange={e => setDesc(e.target.value)} placeholder="Descreva o trabalho a realizar..." style={{ minHeight: 70 }} />
                                    {errors.desc && <span className="form-error"><AlertCircle size={11} /> {errors.desc}</span>}
                                </div>
                            </>
                        )}

                        {/* ── 2. CLIENTE E MÁQUINA ── */}
                        {tab === 'cliente' && (
                            <>
                                <div className="form-group">
                                    <label className="form-label">Cliente</label>
                                    <SearchableSelect options={clienteOpts} value={clienteId} onChange={(v) => { setClienteId(v); setEquipId(''); }} placeholder="Seleccionar cliente..." />
                                </div>
                                <div className="form-group">
                                    <label className="form-label req">Equipamento (filtrado pelo cliente)</label>
                                    <SearchableSelect options={equipOpts} value={equipId} onChange={onEquipChange} placeholder="Seleccionar equipamento..." />
                                    {errors.equip && <span className="form-error"><AlertCircle size={11} /> {errors.equip}</span>}
                                </div>
                                {tipo === 'periodica' && equipId && planoOpts.length > 0 && (
                                    <div className="form-group" style={{ padding: '8px 12px', background: 'var(--blue-light,#eff6ff)', border: '1px solid #BFDBFE', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontSize: '0.8rem', flex: 1 }}>Carregar a partir de um plano de manutenção:</span>
                                        <select className="form-select" style={{ width: 'auto', flex: 2 }} value={planoId} onChange={e => loadPlano(e.target.value)}>
                                            <option value="">Seleccionar plano...</option>
                                            {planoOpts.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                        </select>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── 3. AGENDAMENTO ── */}
                        {tab === 'agendamento' && (
                            <>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Técnico de Campo (executante)</label>
                                        <SearchableSelect options={tecCampoFkOpts} value={executadoPorId} onChange={handleExecutadoChange} placeholder="Por atribuir..." />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Previsão de Tempo (h)</label>
                                        <input type="number" min={0.5} step={0.5} className="form-input"
                                            value={previsao} onChange={e => setPrevisao(e.target.value)} />
                                    </div>
                                    {tipo === 'periodica' && (
                                        <div className="form-group">
                                            <label className="form-label">Periodicidade</label>
                                            <select className="form-select" value={periodo} onChange={e => setPeriodo(e.target.value)}>
                                                {PERIOD_OPTIONS.map(p => <option key={p}>{p}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                                {tipo === 'periodica' && (
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Data Agendada</label>
                                            <input type="date" className="form-input" value={dpI} onChange={e => setDpI(e.target.value)} />
                                        </div>
                                    </div>
                                )}
                                {tipo === 'pontual' && (
                                    <div className="form-group">
                                        <label className="form-label">Data Programada</label>
                                        <input type="date" className="form-input" value={dpI} onChange={e => setDpI(e.target.value)} />
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── 4. EXECUÇÃO (Mão de Obra · Artigos · Diagnóstico) ── */}
                        {tab === 'execucao' && (
                            <>
                                {/* — Mão de Obra — */}
                                <div style={{ marginBottom: 18 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
                                        <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Mão de Obra</h4>
                                        <button type="button" className="abtn abtn-secondary" style={{ fontSize: '0.75rem', padding: '3px 8px' }} onClick={addMao}><Plus size={11} /> Adicionar</button>
                                    </div>
                                    {maos.length === 0 ? (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sem mão de obra definida.</div>
                                    ) : maos.map((m, i) => (
                                        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 110px 90px 28px', gap: 6, marginBottom: 6, alignItems: 'start', minWidth: 320, overflowX: 'auto' }}>
                                            <select className="form-select" value={m.funcao} onChange={e => updateMaoFuncao(i, e.target.value)}>
                                                <option value="">Seleccionar função...</option>
                                                {funcoesTecnico.map(f => <option key={f.id}>{f.descricao}</option>)}
                                            </select>
                                            <div className="form-input" style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)', fontSize: '0.78rem' }}>
                                                {m.custo.toLocaleString('pt-PT')} Kz/h
                                            </div>
                                            <input type="time" className="form-input" value={m.hora} onChange={e => updateMaoHora(i, e.target.value)} />
                                            <button type="button" className="icon-btn" style={{ color: 'var(--red)', marginTop: 3 }} onClick={() => removeMao(i)}><Trash2 size={12} /></button>
                                        </div>
                                    ))}
                                </div>

                                {/* — Artigos — */}
                                <div style={{ marginBottom: 18 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
                                        <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Artigos</h4>
                                        <button type="button" className="abtn abtn-secondary" style={{ fontSize: '0.75rem', padding: '3px 8px' }} onClick={addArt}><Plus size={11} /> Adicionar</button>
                                    </div>
                                    {arts.length === 0 ? (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sem artigos definidos.</div>
                                    ) : arts.map((a, i) => {
                                    const catItem = catalog.find(x => x.id === a.artigoId);
                                    const semStock = catItem && catItem.existencia <= 0;
                                    return (
                                        <div key={i} style={{ marginBottom: 6 }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 70px 110px 28px', gap: 6, alignItems: 'start', minWidth: 320, overflowX: 'auto' }}>
                                                <SearchableSelect options={catalogOpts} value={a.artigoId} onChange={v => updateArtId(i, v)} placeholder="Seleccionar artigo..." />
                                                <input type="number" min={1} className="form-input" value={a.quantidade} onChange={e => updateArtQtd(i, e.target.value)} placeholder="Qtd" />
                                                <div className="form-input" style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)', fontSize: '0.78rem' }}>
                                                    {a.preco.toLocaleString('pt-PT')} Kz
                                                </div>
                                                <button type="button" className="icon-btn" style={{ color: 'var(--red)', marginTop: 3 }} onClick={() => removeArt(i)}><Trash2 size={12} /></button>
                                            </div>
                                            {semStock && (
                                                <div style={{ fontSize: '0.72rem', color: 'var(--orange,#f97316)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <AlertCircle size={10} /> Sem stock disponível — será registado stock negativo
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                    {arts.length > 0 && (() => {
                                        const subtotal = arts.reduce((s, a) => s + a.quantidade * a.preco, 0);

                                        // IVA breakdown: group by rate — only articles with a codigoIva contribute
                                        const ivaMap: Record<string, { label: string; valor: number }> = {};
                                        arts.forEach(a => {
                                            if (!a.codigoIva || a.taxaIva == null) return;
                                            const descIva = taxasIva.find(t => t.codigo === a.codigoIva)?.descricao ?? a.codigoIva;
                                            const label = descIva;
                                            if (!ivaMap[label]) ivaMap[label] = { label, valor: 0 };
                                            ivaMap[label].valor += a.quantidade * a.preco * (a.taxaIva / 100);
                                        });
                                        const totalIva = Object.values(ivaMap).reduce((s, x) => s + x.valor, 0);
                                        const total = subtotal + totalIva;
                                        return (
                                            <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 3, fontSize: '0.8rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: 3 }}>
                                                    <span>Subtotal</span>
                                                    <span>{fmtMoney(subtotal)}</span>
                                                </div>
                                                {Object.values(ivaMap).map(iv => (
                                                    <div key={iv.label} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: 3 }}>
                                                        <span>{iv.label}</span>
                                                        <span>{fmtMoney(iv.valor)}</span>
                                                    </div>
                                                ))}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.85rem', borderTop: '1px solid var(--border)', paddingTop: 5 }}>
                                                    <span>Total</span>
                                                    <strong>{fmtMoney(total)}</strong>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* — Diagnóstico — */}
                                <div>
                                    <div style={{ marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid var(--border)' }}>
                                        <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Diagnóstico</h4>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Órgão</label>
                                        <input className="form-input" value={orgao} onChange={e => setOrgao(e.target.value)} placeholder="Ex: Bomba de Alta Pressão" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Sintoma</label>
                                        <input className="form-input" value={sintoma} onChange={e => setSin(e.target.value)} placeholder="Ex: Baixa pressão" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Causa</label>
                                        <input className="form-input" value={causa} onChange={e => setCausa(e.target.value)} placeholder="Ex: Desgaste da bomba" />
                                    </div>
                                </div>

                                {/* — Fotos & Assinatura (#47) — só para OTs já criadas — */}
                                {ot?.id ? (
                                    <div style={{ marginTop: 18 }}>
                                        <OtAnexosSection otId={ot.id} />
                                    </div>
                                ) : (
                                    <div style={{ marginTop: 18, fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                        Guarde a OT para adicionar fotos e a assinatura do cliente.
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── 5. GESTÃO ── */}
                        {tab === 'gestao' && (
                            <>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label" style={{ color: 'var(--text-muted)' }}>Início</label>
                                        <input type="date" className="form-input" value={dIn} onChange={e => setDIn(e.target.value)} disabled={!ot || (ot.estado !== 'Em execução' && ot.estado !== 'Finalizada')} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ color: 'var(--text-muted)' }}>Fim</label>
                                        <input type="date" className="form-input" value={dFi} onChange={e => setDFi(e.target.value)} disabled={!ot || ot.estado !== 'Finalizada'} />
                                    </div>
                                </div>

                                {/* Ações da máquina de estados (RF-OT-001) — dinâmicas por transicoesPossiveis */}
                                {ot && acoes && acoes.length > 0 && (
                                    <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4 }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 8 }}>
                                            Transições disponíveis — estado actual: <strong>{ot.estado}</strong>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            {acoes.map(a => (
                                                <button key={a.target} type="button" className="abtn abtn-primary"
                                                    style={{ background: otEstadoCor(a.target), borderColor: otEstadoCor(a.target) }}
                                                    onClick={a.run}>
                                                    {a.label} → {a.target}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Reprogramações History */}
                                {ot && ot.reprogramacoes && ot.reprogramacoes.length > 0 && (
                                    <div style={{ marginTop: 16 }}>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                                            Histórico de Reprogramações ({ot.reprogramacoes.length})
                                        </div>
                                        <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                                            {ot.reprogramacoes.map((r, i) => (
                                                <div key={r.id ?? i} style={{ display: 'flex', gap: 10, padding: '6px 10px', fontSize: '0.77rem', borderBottom: i < ot.reprogramacoes.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg)' }}>
                                                    <span style={{ color: 'var(--text-muted)', minWidth: 85 }}>{r.dataAnterior || '—'} → {r.novaData || '—'}</span>
                                                    <span style={{ flex: 1, color: 'var(--text-primary)' }}>{r.motivo}</span>
                                                    <span style={{ color: 'var(--text-muted)' }}>{r.usuario}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                        {ot && (
                            <button type="button" className="abtn abtn-secondary" onClick={handlePreview} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Eye size={12} /> Pré-visualizar</button>
                        )}
                        {ot && (
                            <button type="button" className="abtn abtn-secondary" onClick={handlePrint}><Printer size={12} /> Imprimir</button>
                        )}
                        {!readOnly && <button type="submit" className="abtn abtn-primary"><Check size={12} /> Guardar</button>}
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ══ Main Page ═══════════════════════════════════════════ */
const OrdensPage: React.FC = () => {
    const { ordens, addOrdem, updateOrdem, agendarOT, confirmarOT, adiarOT, iniciarOT, registarConsumoOT, finalizarOT, equipInstalados, clientes, modelosEquipamento, currentUser, fmtDate, empresaConfig, simboloMoeda, tecnicos, artigos: artigosStock, loadingData } = useGlobal();
    const isTecnicoCampo = currentUser?.role === 'Técnico de Campo';

    const [search, setSearch]         = useState('');
    const [filterEstado, setFiltEst]  = useState('');
    const [filterTipo, setFiltTipo]   = useState('');
    const [modal, setModal]           = useState<'new' | string | null>(null);
    const [showExport, setShowExport]       = useState(false);
    const [showRelatorio, setShowRelatorio] = useState(false);
    const [ctx, setCtx]               = useState<{ id: string; x: number; y: number } | null>(null);
    // RF-OT-003 — modal partilhada para Confirmar/Adiar com input de data + motivo + aprovação
    const [transicaoModal, setTransicaoModal] = useState<{ tipo: 'confirmar' | 'adiar'; ot: OrdemTrabalho } | null>(null);
    const [consumoOt, setConsumoOt] = useState<OrdemTrabalho | null>(null);
    const [finalizarOt, setFinalizarOt] = useState<OrdemTrabalho | null>(null);

    const showToast = (msg: string) => notify(msg, 'success');

    const getLabel = useCallback((ot: OrdemTrabalho) => {
        const eq  = equipInstalados.find(e => e.id === ot.equipInstaladoId);
        const mod = modelosEquipamento.find(m => m.id === eq?.modeloId)?.nome ?? '—';
        const cli = clientes.find(c => c.id === ot.clienteId)?.nome ?? '—';
        return { equip: `${ot.equipInstaladoId} — ${mod}`, cliente: cli };
    }, [equipInstalados, modelosEquipamento, clientes]);

    const filtered = useMemo(() => ordens.filter(o => {
        const q = search.toLowerCase();
        const { equip, cliente } = getLabel(o);
        return (!q || o.id.toLowerCase().includes(q) || equip.toLowerCase().includes(q) || cliente.toLowerCase().includes(q) || o.descricao.toLowerCase().includes(q))
            && (!filterEstado || o.estado === filterEstado)
            && (!filterTipo   || o.naturezaIntervencao === filterTipo)
            && (!isTecnicoCampo || o.responsavel === (currentUser?.tecnicoNome ?? currentUser?.nome));
    }), [ordens, search, filterEstado, filterTipo, isTecnicoCampo, currentUser, getLabel]);

    // Base scoped to current user (ignores search/estado/tipo filters, but respects role)
    const baseOrdens = useMemo(() =>
        isTecnicoCampo ? ordens.filter(o => o.responsavel === (currentUser?.tecnicoNome ?? currentUser?.nome)) : ordens,
    [ordens, isTecnicoCampo, currentUser]);

    const stats = useMemo(() => ({
        programados: baseOrdens.filter(o => o.estado === 'Registada' || o.estado === 'Programada' || o.estado === 'Adiada' || o.estado === 'Confirmada').length,
        emCurso:     baseOrdens.filter(o => o.estado === 'Em execução').length,
        terminados:  baseOrdens.filter(o => o.estado === 'Finalizada').length,
        encerrados:  baseOrdens.filter(o => o.estado === 'Finalizada').length,
    }), [baseOrdens]);

    const exportData = filtered.map(o => {
        const { equip, cliente } = getLabel(o);
        return { ...o, equipamento: equip, clienteNome: cliente, dataAgendada: fmtDate(o.dataAgendada) };
    });

    const editOT = typeof modal === 'string' && modal !== 'new' ? ordens.find(o => o.id === modal) : undefined;

    const handleSave = async (data: Omit<OrdemTrabalho, 'id'>) => {
        try {
            if (typeof modal === 'string' && modal !== 'new') {
                await updateOrdem(modal, data);
                showToast('OT actualizada.');
            } else {
                const ot = await addOrdem(data);
                showToast(`OT ${ot.id} criada.`);
            }
            setModal(null);
        } catch {
            /* erro já apresentado pelo interceptor global (api.ts) */
        }
    };

    /** Ações da máquina de estados RF-OT-001 — uma entrada por transição possível.
     *  RF-OT-003: Confirmar e Adiar abrem modal para recolher dados extra
     *  (data execução + técnico em Confirmar; nova data + motivo + aprovação em Adiar).
     */
    type TransicaoAcao = { target: OTEstado; label: string; run: (ot: OrdemTrabalho) => void | Promise<void> };
    const ACOES_POR_ESTADO: Record<OTEstado, TransicaoAcao[]> = {
        'Registada':   [{ target: 'Programada',  label: 'Agendar',   run: ot => agendarOT(ot.id, today()) }],
        'Programada':  [
            { target: 'Confirmada', label: 'Confirmar', run: ot => setTransicaoModal({ tipo: 'confirmar', ot }) },
            { target: 'Adiada',     label: 'Adiar',     run: ot => setTransicaoModal({ tipo: 'adiar', ot }) },
        ],
        'Adiada':      [{ target: 'Programada',  label: 'Reagendar', run: ot => agendarOT(ot.id, today()) }],
        'Confirmada':  [
            { target: 'Em execução', label: 'Iniciar', run: ot => iniciarOT(ot.id, today()) },
            { target: 'Adiada',      label: 'Adiar',   run: ot => setTransicaoModal({ tipo: 'adiar', ot }) },
        ],
        'Em execução': [{ target: 'Finalizada',  label: 'Finalizar', run: ot => setFinalizarOt(ot) }],
        'Finalizada':  [],
    };

    const acoesDisponiveis = (ot: OrdemTrabalho): TransicaoAcao[] => {
        const permitidas = ot.transicoesPossiveis ?? [];
        return (ACOES_POR_ESTADO[ot.estado] ?? []).filter(a => permitidas.includes(a.target));
    };

    const executarTransicao = async (ot: OrdemTrabalho, acao: TransicaoAcao) => {
        try {
            const result = acao.run(ot);
            // Acções com modal (confirmar/adiar) retornam void; outras retornam Promise.
            if (result instanceof Promise) {
                await result;
                setModal(null);
                showToast(`OT ${ot.id}: ${acao.label} → ${acao.target}.`);
            }
        } catch {
            /* erro já apresentado pelo interceptor global (api.ts) */
        }
        setCtx(null);
    };

    return (
        <AppLayout>
            <ActionBar title="Ordens de Trabalho" breadcrumb="AQUATEX SGI · Ordens">
                <div className="actionbar-spacer" />
                <button className="abtn abtn-secondary" type="button" onClick={() => setShowRelatorio(true)}>
                    <Printer size={13} /> Relatório de Intervenções
                </button>
                <button className="abtn abtn-secondary" type="button" onClick={() => setShowExport(true)}>
                    <Download size={13} /> Exportar
                </button>
                {!isTecnicoCampo && (
                    <button className="abtn abtn-primary" type="button" onClick={() => setModal('new')}>
                        <Plus size={13} /> Nova OT
                    </button>
                )}
            </ActionBar>

            <div className="page-content" onClick={() => setCtx(null)}>
                <div className="stats-row">
                    {[
                        { label: 'Programadas', value: stats.programados, cls: 'blue'   },
                        { label: 'Em curso',    value: stats.emCurso,     cls: 'orange' },
                        { label: 'Terminadas',  value: stats.terminados,  cls: 'green'  },
                        { label: 'Encerradas',  value: stats.encerrados,  cls: 'muted'  },
                    ].map(s => (
                        <div key={s.label} className="stat-card">
                            <span className="stat-label">{s.label}</span>
                            <span className={`stat-value ${s.cls}`}>{s.value}</span>
                        </div>
                    ))}
                </div>

                <div className="filters-bar">
                    <div className="search-wrap">
                        <Search className="search-icon" />
                        <input className="search-input" placeholder="Pesquisar OT, equipamento, cliente..."
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select className="filter-select" value={filterEstado} onChange={e => setFiltEst(e.target.value)}>
                        <option value="">Todos os estados</option>
                        <option value="Programado">Programado</option>
                        <option value="Em curso">Em curso</option>
                        <option value="Terminado">Terminado</option>
                        <option value="Encerrado">Encerrado</option>
                    </select>
                    <select className="filter-select" value={filterTipo} onChange={e => setFiltTipo(e.target.value)}>
                        <option value="">Todas as naturezas</option>
                        {NATUREZAS_INTERVENCAO.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    {(search || filterEstado || filterTipo) && (
                        <button className="abtn abtn-secondary" type="button" onClick={() => { setSearch(''); setFiltEst(''); setFiltTipo(''); }}>
                            <Filter size={12} /> Limpar
                        </button>
                    )}
                </div>

                <div className="table-container">
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 28 }} />
                                    <th>OT</th>
                                    <th>Nº</th>
                                    <th>Tipo</th>
                                    <th>Natureza</th>
                                    <th>Prioridade</th>
                                    <th>Equipamento</th>
                                    <th>Cliente</th>
                                    <th>Téc. Campo</th>
                                    <th>D.Agendada</th>
                                    <th>Início</th>
                                    <th>Fim</th>
                                    <th>Estado</th>
                                    <th style={{ width: 50 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {loadingData && <TableSkeleton cols={17} />}
                                {!loadingData && filtered.length === 0 && (
                                    <tr><td colSpan={17}><EmptyState icon={<ClipboardList size={28} />} title="Nenhuma OT encontrada" description="Registe ordens de trabalho para planear, executar e faturar intervenções." /></td></tr>
                                )}
                                {!loadingData && filtered.map(o => {
                                    const { equip, cliente } = getLabel(o);
                                    const cfg = ESTADO_CONFIG[o.estado];
                                    return (
                                        <tr key={o.id} onContextMenu={e => { e.preventDefault(); setCtx({ id: o.id, x: e.clientX, y: e.clientY }); }}>
                                            <td style={{ paddingLeft: 8, textAlign: 'center' }}>
                                                <span style={{ fontSize: '0.72rem' }}>{cfg.icon}</span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                    <span className="td-link" onClick={() => setModal(o.id)}>{o.id}</span>
                                                    {o.reprogramacoes && o.reprogramacoes.length > 0 && (
                                                        <span title={`Reprogramada ${o.reprogramacoes.length}x`} style={{ fontSize: '0.65rem', fontWeight: 700, background: '#FED7AA', color: '#92400E', borderRadius: 10, padding: '1px 5px' }}>
                                                            R{o.reprogramacoes.length}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{o.numero ?? '—'}</td>
                                            <td><span className="tbadge tbadge-suporte">{o.tipo === 'periodica' ? 'Periódica' : 'Pontual'}</span></td>
                                            <td style={{ fontSize: '0.75rem' }}>{o.naturezaIntervencao ?? '—'}</td>
                                            <td style={{ fontSize: '0.75rem' }}>
                                                {o.prioridade && (
                                                    <span style={{
                                                        padding: '2px 6px', borderRadius: 3, fontSize: '0.7rem', fontWeight: 600,
                                                        background: o.prioridade === 'Urgente' ? '#fee2e2' : o.prioridade === 'Alta' ? '#fef3c7' : '#e0e7ff',
                                                        color: o.prioridade === 'Urgente' ? '#991b1b' : o.prioridade === 'Alta' ? '#92400e' : '#3730a3',
                                                    }}>{o.prioridade}</span>
                                                )}
                                            </td>
                                            <td style={{ fontSize: '0.78rem' }}>{equip}</td>
                                            <td style={{ fontSize: '0.8rem', fontWeight: 600 }}>{cliente}</td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{o.executadoPorNome ?? o.responsavel ?? '—'}</td>
                                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmtDate(o.dataAgendada)   || '—'}</td>
                                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmtDate(o.dataInicio)     || '—'}</td>
                                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmtDate(o.dataFim)        || '—'}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem' }}>
                                                    <span className={`dot ${cfg.dot}`} />
                                                    {cfg.label}
                                                </div>
                                                {/* #165 — estado de faturação (v11 §4.4), só em OTs finalizadas */}
                                                {o.estado === 'Finalizada' && o.estadoFaturacao && (
                                                    <div title={o.documentoVendaNumero ? `Faturada em ${o.documentoVendaNumero}` : 'Ainda não faturada'}
                                                        style={{ fontSize: '0.66rem', fontWeight: 700, marginTop: 2, color: o.estadoFaturacao === 'Paga' ? '#2E7D32' : o.estadoFaturacao === 'Não faturada' ? 'var(--text-muted)' : '#E65100' }}>
                                                        {o.estadoFaturacao}{o.documentoVendaNumero ? ` · ${o.documentoVendaNumero}` : ''}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <div className="row-actions">
                                                    <button className="icon-btn" title="Ver" onClick={() => setModal(o.id)}><Eye size={12} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="table-count">{filtered.length} ordens</div>
                </div>
            </div>

            {/* Context menu */}
            {ctx && (() => {
                const ot = ordens.find(o => o.id === ctx.id)!;
                return (
                    <div style={{ position: 'fixed', top: ctx.y, left: ctx.x, background: '#fff', border: '1px solid var(--border)', borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 9999, minWidth: 160 }}
                        onClick={e => e.stopPropagation()}>
                        {[
                            { label: 'Abrir',    action: () => { setModal(ctx.id); setCtx(null); } },
                            { label: '⎙ Imprimir', action: () => { printOT(ot, equipInstalados, modelosEquipamento, clientes, empresaConfig, simboloMoeda); setCtx(null); } },
                            ...(ot.estado === 'Em execução' && !isTecnicoCampo ? [{ label: '📦 Registar Consumo', action: () => { setConsumoOt(ot); setCtx(null); } }] : []),
                            ...acoesDisponiveis(ot).map(a => ({ label: `→ ${a.label} (${a.target})`, action: () => executarTransicao(ot, a) })),
                        ].map(item => (
                            <button key={item.label} type="button" onClick={item.action}
                                style={{ display: 'block', width: '100%', padding: '8px 14px', border: 'none', background: 'none', textAlign: 'left', fontSize: '0.82rem', cursor: 'pointer', color: 'var(--text-primary)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                                {item.label}
                            </button>
                        ))}
                    </div>
                );
            })()}

            {modal !== null && (
                <OTForm
                    ot={editOT}
                    onClose={() => setModal(null)}
                    onSave={handleSave}
                    acoes={editOT && !isTecnicoCampo ? acoesDisponiveis(editOT).map(a => ({ label: a.label, target: a.target, run: () => executarTransicao(editOT, a) })) : undefined}
                    readOnly={isTecnicoCampo && !!editOT}
                />
            )}

            {showRelatorio && <RelatorioIntervModal onClose={() => setShowRelatorio(false)} />}

            {showExport && (
                <ExportModal
                    title="Ordens de Trabalho"
                    columns={COLS_OT}
                    data={exportData}
                    filename="ordens_trabalho"
                    onClose={() => setShowExport(false)}
                />
            )}

            {/* RF-OT-006 — Modal Finalizar (assinatura obrigatória) */}
            {finalizarOt && (
                <FinalizarModal
                    ot={finalizarOt}
                    simboloMoeda={simboloMoeda}
                    onClose={() => setFinalizarOt(null)}
                    onSubmit={async (dataFim) => {
                        try {
                            const r = await finalizarOT(finalizarOt.id, { assinadaCliente: true, dataFim });
                            if (r?.otGeradaId) {
                                showToast(`OT ${finalizarOt.id} finalizada. Próxima OT #${r.otGeradaId} criada.`);
                            } else {
                                showToast(`OT ${finalizarOt.id} finalizada.`);
                            }
                            setFinalizarOt(null);
                            setModal(null);
                        } catch {
                            /* erro já apresentado pelo interceptor global (api.ts) */
                        }
                    }}
                />
            )}

            {/* RF-OT-005 — Modal Registar Consumo */}
            {consumoOt && (
                <ConsumoModal
                    ot={consumoOt}
                    artigosStock={artigosStock}
                    simboloMoeda={simboloMoeda}
                    onClose={() => setConsumoOt(null)}
                    onSubmit={async (linhas) => {
                        try {
                            await registarConsumoOT(consumoOt.id, linhas);
                            showToast(`Consumo registado para a OT ${consumoOt.id}.`);
                            setConsumoOt(null);
                        } catch {
                            /* erro já apresentado pelo interceptor global (api.ts) */
                        }
                    }}
                />
            )}

            {/* RF-OT-003 — Modal Confirmar/Adiar */}
            {transicaoModal && (
                <TransicaoModal
                    tipo={transicaoModal.tipo}
                    ot={transicaoModal.ot}
                    tecnicos={tecnicos}
                    currentUser={currentUser}
                    onClose={() => setTransicaoModal(null)}
                    onSubmit={async (payload) => {
                        try {
                            if (transicaoModal.tipo === 'confirmar') {
                                const avisos = await confirmarOT(transicaoModal.ot.id, payload as any);
                                if (avisos && avisos.length) {
                                    const faltas = avisos.map(a => `${a.descricao} (faltam ${a.emFalta})`).join(', ');
                                    showToast(`OT ${transicaoModal.ot.id} confirmada — reposição necessária: ${faltas}`);
                                } else {
                                    showToast(`OT ${transicaoModal.ot.id} confirmada.`);
                                }
                            } else {
                                await adiarOT(transicaoModal.ot.id, payload as any);
                                showToast(`OT ${transicaoModal.ot.id} adiada.`);
                            }
                            setTransicaoModal(null);
                            setModal(null);
                        } catch {
                            /* erro já apresentado pelo interceptor global (api.ts) */
                        }
                    }}
                />
            )}

        </AppLayout>
    );
};

/* ══ TransicaoModal — Confirmar/Adiar (RF-OT-003) ═══════════ */
type TransicaoModalProps = {
    tipo: 'confirmar' | 'adiar';
    ot: OrdemTrabalho;
    tecnicos: ReturnType<typeof useGlobal>['tecnicos'];
    currentUser: ReturnType<typeof useGlobal>['currentUser'];
    onClose: () => void;
    onSubmit: (payload: any) => Promise<void>;
};
const TransicaoModal: React.FC<TransicaoModalProps> = ({ tipo, ot, tecnicos, currentUser, onClose, onSubmit }) => {
    const today = () => new Date().toISOString().split('T')[0];
    const isConfirmar = tipo === 'confirmar';
    const [data, setData] = useState<string>(today());
    const [executadoPorId, setExecutadoPorId] = useState<string>(ot.executadoPorId ?? '');
    const [motivo, setMotivo] = useState('');
    const [aprovadoPor, setAprovadoPor] = useState<string>('');
    const [aprovacaoMotivo, setAprovacaoMotivo] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const requerAprovacao = !isConfirmar && !!ot.requerAprovacaoAdiar;
    const podeAprovar = currentUser?.role === 'admin';

    const handleSubmit = async (ev: React.FormEvent) => {
        ev.preventDefault();
        setSubmitting(true);
        try {
            if (isConfirmar) {
                await onSubmit({ dataExecucao: data, executadoPorId: executadoPorId || undefined });
            } else {
                const payload: any = { novaData: data, motivo };
                if (requerAprovacao) {
                    payload.aprovadoPor = aprovadoPor;
                    payload.aprovacaoMotivo = aprovacaoMotivo;
                }
                await onSubmit(payload);
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 480 }}>
                <div className="modal-header">
                    <h3 className="modal-title">
                        {isConfirmar ? `Confirmar OT ${ot.id}` : `Adiar OT ${ot.id}`}
                    </h3>
                    <button className="modal-close" aria-label="Fechar" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {ot.janelaFim && (
                            <div style={{ marginBottom: 10, padding: '6px 10px', fontSize: '0.78rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4 }}>
                                Janela de programação até <strong>{ot.janelaFim}</strong>
                                {typeof ot.adiamentos === 'number' && <span> · Adiamentos: <strong>{ot.adiamentos}</strong></span>}
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label req">
                                {isConfirmar ? 'Data de execução' : 'Nova data'}
                            </label>
                            <input type="date" className="form-input" value={data} onChange={e => setData(e.target.value)} required />
                        </div>

                        {isConfirmar && (
                            <div className="form-group">
                                <label className="form-label req">Técnico de campo</label>
                                <select className="form-select" value={executadoPorId} onChange={e => setExecutadoPorId(e.target.value)} required>
                                    <option value="">Seleccionar...</option>
                                    {tecnicos.filter(t => t.ativo).map(t => (
                                        <option key={t.id} value={t.id}>{t.nome}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {!isConfirmar && (
                            <div className="form-group">
                                <label className="form-label req">Motivo do adiamento (mín. 5 caracteres)</label>
                                <textarea className="form-textarea" value={motivo} onChange={e => setMotivo(e.target.value)} required minLength={5} placeholder="Ex: Cliente ausente" />
                            </div>
                        )}

                        {requerAprovacao && (
                            <div style={{ padding: '10px 12px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 4, marginTop: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 6, color: '#92400e' }}>
                                    <AlertCircle size={13} /> Limite de adiamentos atingido — requer aprovação de administrador
                                </div>
                                {!podeAprovar && (
                                    <div style={{ fontSize: '0.78rem', color: '#92400e', marginBottom: 6 }}>
                                        Não tem permissão para aprovar este adiamento. Solicite a um administrador.
                                    </div>
                                )}
                                <div className="form-group" style={{ marginBottom: 6 }}>
                                    <label className="form-label req">ID do aprovador (admin)</label>
                                    <input type="number" className="form-input" value={aprovadoPor} onChange={e => setAprovadoPor(e.target.value)} required={requerAprovacao} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label req">Motivo da aprovação (mín. 5 caracteres)</label>
                                    <textarea className="form-textarea" value={aprovacaoMotivo} onChange={e => setAprovacaoMotivo(e.target.value)} required={requerAprovacao} minLength={5} placeholder="Justifique a excepção" />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="abtn abtn-primary" disabled={submitting}>
                            <Check size={12} /> {isConfirmar ? 'Confirmar' : 'Adiar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ══ ConsumoModal — Registar consumo real (RF-OT-005) ═══════ */
type ConsumoLinha = { artigoId?: string; descricao: string; qtdPrevista: number; qtdConsumida: number; preco: number; extra: boolean };
type ConsumoModalProps = {
    ot: OrdemTrabalho;
    artigosStock: ReturnType<typeof useGlobal>['artigos'];
    simboloMoeda: string;
    onClose: () => void;
    onSubmit: (linhas: { artigoId?: number; quantidade: number; descricao?: string }[]) => Promise<void>;
};
const ConsumoModal: React.FC<ConsumoModalProps> = ({ ot, artigosStock, simboloMoeda, onClose, onSubmit }) => {
    const [linhas, setLinhas] = useState<ConsumoLinha[]>(
        (ot.artigos ?? []).map(a => ({
            artigoId: a.artigoId,
            descricao: a.descricao,
            qtdPrevista: a.qtdPrevista ?? a.quantidade ?? 0,
            qtdConsumida: a.qtdConsumida ?? a.qtdPrevista ?? a.quantidade ?? 0,
            preco: a.preco ?? 0,
            extra: false,
        })),
    );
    const [saving, setSaving] = useState(false);

    const setQtd = (i: number, v: string) =>
        setLinhas(p => p.map((l, j) => j === i ? { ...l, qtdConsumida: Number(v) || 0 } : l));
    const removeLinha = (i: number) => setLinhas(p => p.filter((_, j) => j !== i));
    const addExtra = (artigoId: string) => {
        const art = artigosStock.find(a => a.id === artigoId);
        if (!art || linhas.some(l => l.artigoId === artigoId)) return;
        setLinhas(p => [...p, { artigoId, descricao: art.descricao, qtdPrevista: 0, qtdConsumida: 1, preco: art.precoUnitario, extra: true }]);
    };

    const custoReal = linhas.reduce((s, l) => s + l.qtdConsumida * l.preco, 0);
    const opcoesExtra = artigosStock
        .filter(a => !a.inativo && !linhas.some(l => l.artigoId === a.id))
        .map(a => ({ value: a.id, label: a.descricao, sub: `${a.codigo} · Disp: ${a.existencia - a.stockReservado}` }));

    const submit = async () => {
        setSaving(true);
        try {
            await onSubmit(linhas.map(l => ({
                artigoId: l.artigoId ? Number(l.artigoId) : undefined,
                quantidade: l.qtdConsumida,
                descricao: l.descricao,
            })));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 640 }}>
                <div className="modal-header">
                    <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Package size={14} /> Registar Consumo — OT {ot.numero ?? ot.id}
                    </h3>
                    <button className="modal-close" aria-label="Fechar" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body">
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 0 }}>
                        Ajuste as quantidades realmente consumidas. Peças não previstas podem ser adicionadas abaixo.
                    </p>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                                <th style={{ padding: '6px 4px' }}>Peça</th>
                                <th style={{ padding: '6px 4px', textAlign: 'right' }}>Previsto</th>
                                <th style={{ padding: '6px 4px', textAlign: 'right' }}>Consumido</th>
                                <th style={{ padding: '6px 4px', textAlign: 'right' }}>Subtotal</th>
                                <th style={{ width: 28 }} />
                            </tr>
                        </thead>
                        <tbody>
                            {linhas.length === 0 && (
                                <tr><td colSpan={5} style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)' }}>Sem peças. Adicione o consumo real.</td></tr>
                            )}
                            {linhas.map((l, i) => (
                                <tr key={`${l.artigoId ?? 'x'}-${i}`} style={{ borderBottom: '1px solid var(--border-subtle,#f1f5f9)' }}>
                                    <td style={{ padding: '6px 4px' }}>
                                        {l.descricao}{l.extra && <span style={{ marginLeft: 6, fontSize: '0.68rem', color: 'var(--orange,#f97316)', fontWeight: 700 }}>EXTRA</span>}
                                    </td>
                                    <td style={{ padding: '6px 4px', textAlign: 'right', color: 'var(--text-muted)' }}>{l.qtdPrevista}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'right' }}>
                                        <input type="number" min={0} className="form-input" style={{ width: 72, textAlign: 'right' }}
                                            value={l.qtdConsumida} onChange={e => setQtd(i, e.target.value)} />
                                    </td>
                                    <td style={{ padding: '6px 4px', textAlign: 'right' }}>{(l.qtdConsumida * l.preco).toLocaleString('pt-PT')} {simboloMoeda}</td>
                                    <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                                        <button type="button" onClick={() => removeLinha(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red,#ef4444)' }}><Trash2 size={13} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div style={{ marginTop: 12 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Adicionar peça não prevista</label>
                        <SearchableSelect options={opcoesExtra} value="" onChange={addExtra} placeholder="Procurar artigo..." />
                    </div>

                    <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 24, fontSize: '0.85rem' }}>
                        <span>Custo real (peças): <strong>{custoReal.toLocaleString('pt-PT')} {simboloMoeda}</strong></span>
                    </div>
                </div>
                <div className="modal-footer">
                    <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                    <button type="button" className="abtn abtn-primary" onClick={submit} disabled={saving}>
                        {saving ? 'A guardar…' : 'Registar Consumo'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ══ FinalizarModal — Fecho com assinatura (RF-OT-006) ══════ */
type FinalizarModalProps = {
    ot: OrdemTrabalho;
    simboloMoeda: string;
    onClose: () => void;
    onSubmit: (dataFim: string) => Promise<void>;
};
const FinalizarModal: React.FC<FinalizarModalProps> = ({ ot, simboloMoeda, onClose, onSubmit }) => {
    const [dataFim, setDataFim] = useState(today());
    const [assinou, setAssinou] = useState(false);
    const [saving, setSaving] = useState(false);
    const ehPeriodica = ot.tipo === 'periodica';

    const submit = async () => {
        if (!assinou) return;
        setSaving(true);
        try { await onSubmit(dataFim); } finally { setSaving(false); }
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 480 }}>
                <div className="modal-header">
                    <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CheckCircle size={14} /> Finalizar OT {ot.numero ?? ot.id}
                    </h3>
                    <button className="modal-close" aria-label="Fechar" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body">
                    {ot.custoReal != null && (
                        <div style={{ fontSize: '0.82rem', marginBottom: 12, color: 'var(--text-secondary)' }}>
                            Custo real da intervenção: <strong>{ot.custoReal.toLocaleString('pt-PT')} {simboloMoeda}</strong>
                        </div>
                    )}
                    <div className="form-group">
                        <label className="form-label">Data de fim</label>
                        <input type="date" className="form-input" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12, cursor: 'pointer', fontSize: '0.85rem' }}>
                        <input type="checkbox" checked={assinou} onChange={e => setAssinou(e.target.checked)} style={{ marginTop: 2 }} />
                        <span>O cliente assinou a ficha da intervenção <span style={{ color: 'var(--red,#ef4444)' }}>*</span></span>
                    </label>
                    {!assinou && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6, marginBottom: 0 }}>
                            A assinatura do cliente é obrigatória para finalizar.
                        </p>
                    )}
                    {ehPeriodica && (
                        <p style={{ fontSize: '0.78rem', color: 'var(--blue)', marginTop: 10, marginBottom: 0 }}>
                            Esta OT é periódica — a próxima intervenção será criada automaticamente.
                        </p>
                    )}
                </div>
                <div className="modal-footer">
                    <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                    <button type="button" className="abtn abtn-primary" onClick={submit} disabled={!assinou || saving}>
                        {saving ? 'A finalizar…' : 'Finalizar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OrdensPage;
