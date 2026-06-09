import React, { useState, useMemo } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import { useGlobal, OrdemTrabalho, OTEstado } from '../../contexts/GlobalContext';
import { ChevronLeft, ChevronRight, Calendar, X, Clock, PlayCircle, CheckCircle, Archive, AlertCircle, GripVertical, Printer, Eye } from 'lucide-react';

/* ── Helpers ── */
const TODAY = new Date();

const ESTADO_COLOR: Record<OTEstado, { bg: string; color: string; border: string }> = {
    'Registada':   { bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB' },
    'Programada':  { bg: '#EFF6FF', color: '#1d4ed8', border: '#BFDBFE' },
    'Adiada':      { bg: '#FFF7ED', color: '#c2410c', border: '#FDBA74' },
    'Confirmada':  { bg: '#F5F3FF', color: '#6d28d9', border: '#DDD6FE' },
    'Em execução': { bg: '#FEFCE8', color: '#a16207', border: '#FEF08A' },
    'Finalizada':  { bg: '#F0FDF4', color: '#166534', border: '#BBF7D0' },
};
const ESTADO_DOT: Record<OTEstado, string> = {
    'Registada': 'dot-gray', 'Programada': 'dot-blue', 'Adiada': 'dot-orange',
    'Confirmada': 'dot-purple', 'Em execução': 'dot-yellow', 'Finalizada': 'dot-green',
};
const ESTADO_ICON: Record<OTEstado, React.ReactNode> = {
    'Registada': <Clock size={11} />, 'Programada': <Clock size={11} />,
    'Adiada': <AlertCircle size={11} />, 'Confirmada': <CheckCircle size={11} />,
    'Em execução': <PlayCircle size={11} />, 'Finalizada': <Archive size={11} />,
};

const addDays     = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const isoDate     = (d: Date) => d.toISOString().split('T')[0];
const fmtDateShort= (d: Date) => d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
const fmtDateLong = (d: Date) => d.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short' });
const fmtMonth    = (d: Date) => d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
const fmtWeek     = (s: Date) => `${fmtDateShort(s)} – ${fmtDateShort(addDays(s, 6))}`;
const otDate      = (ot: OrdemTrabalho) => ot.dataAgendada ?? null;
const startOfWeek = (d: Date) => { const r = new Date(d); r.setDate(r.getDate() - ((r.getDay() + 6) % 7)); return r; };
const startOfMonth= (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

/* ── Reprogramar Modal ── */
interface ReprogramarProps {
    ot: OrdemTrabalho;
    novaData: string;
    onClose: () => void;
    onConfirm: (novaData: string, motivo: string) => void;
}
const ReprogramarModal: React.FC<ReprogramarProps> = ({ ot, novaData: initialData, onClose, onConfirm }) => {
    const { fmtDate: fmtDt } = useGlobal();
    const [data, setData]     = useState(initialData);
    const [motivo, setMotivo] = useState('');
    const [err, setErr]       = useState('');

    const handleConfirm = () => {
        if (!motivo.trim()) { setErr('O motivo da reprogramação é obrigatório.'); return; }
        if (!data) { setErr('Seleccione uma data válida.'); return; }
        onConfirm(data, motivo);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 440 }}>
                <div className="modal-header">
                    <h3 className="modal-title">Reprogramar OT</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body">
                    <div style={{ padding: '10px 12px', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 4, marginBottom: 14, fontSize: '0.8rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--blue)' }}>{ot.id} — {ot.naturezaIntervencao}</div>
                        <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
                            Data actual: <strong>{fmtDt(ot.dataAgendada)}</strong>
                            {ot.responsavel && ot.responsavel !== '—' && <> · Responsável: {ot.responsavel}</>}
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label req">Nova Data Programada</label>
                        <input type="date" className="form-input" value={data} onChange={e => setData(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="form-label req">Motivo da Reprogramação</label>
                        <textarea className="form-input" rows={3} style={{ resize: 'vertical' }}
                            value={motivo} onChange={e => { setMotivo(e.target.value); setErr(''); }}
                            placeholder="Ex: Indisponibilidade do técnico, reagendamento pedido pelo cliente..." />
                        {err && <span className="form-error"><AlertCircle size={11} /> {err}</span>}
                    </div>
                </div>
                <div className="modal-footer">
                    <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                    <button type="button" className="abtn abtn-primary" onClick={handleConfirm}>
                        <CheckCircle size={12} /> Confirmar Reprogramação
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ── OT Card (draggable) ── */
interface OTCardProps {
    ot: OrdemTrabalho;
    nomeCliente: string;
    onClick: () => void;
    onDragStart: (e: React.DragEvent) => void;
    canDrag: boolean;
}
const OTCard: React.FC<OTCardProps> = ({ ot, nomeCliente, onClick, onDragStart, canDrag }) => {
    const ec = ESTADO_COLOR[ot.estado];
    return (
        <div
            draggable={canDrag}
            onDragStart={canDrag ? onDragStart : undefined}
            onClick={onClick}
            title={`${ot.id} — ${ot.naturezaIntervencao ?? "—"}\n${nomeCliente}${canDrag ? '\n(Arrastar para reprogramar)' : ''}`}
            style={{
                padding: '3px 6px', borderRadius: 3, fontSize: '0.7rem', cursor: canDrag ? 'grab' : 'pointer',
                background: ec.bg, color: ec.color, border: `1px solid ${ec.border}`,
                display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden',
            }}>
            {canDrag && <GripVertical size={9} style={{ flexShrink: 0, opacity: 0.5 }} />}
            {ESTADO_ICON[ot.estado]}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{nomeCliente}</span>
        </div>
    );
};

/* ── OT Detail Modal ── */
const OTDetail: React.FC<{ ot: OrdemTrabalho; nomeCliente: string; nomeEquip: string; onClose: () => void }> = ({ ot, nomeCliente, nomeEquip, onClose }) => {
    const { fmtDate: fmtDt } = useGlobal();
    const ec = ESTADO_COLOR[ot.estado];
    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 460 }}>
                <div className="modal-header">
                    <div>
                        <h3 className="modal-title">{ot.id} — {ot.naturezaIntervencao}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <span className={`dot ${ESTADO_DOT[ot.estado]}`} />
                            <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 10, fontWeight: 700, background: ec.bg, color: ec.color }}>
                                {ot.estado}
                            </span>
                        </div>
                    </div>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body">
                    {[
                        { label: 'Cliente',          value: nomeCliente },
                        { label: 'Equipamento',       value: nomeEquip || '—' },
                        { label: 'Responsável',       value: ot.responsavel || '—' },
                        { label: 'Descrição',         value: ot.descricao || '—' },
                        { label: 'Data Agendada',     value: fmtDt(ot.dataAgendada) },
                        { label: 'Data Prog. Fim',    value: fmtDt(ot.dataProgFim) },
                        { label: 'Previsão (h)',      value: ot.previsaoTempo ? `${ot.previsaoTempo}h` : '—' },
                    ].map(row => (
                        <div key={row.label} className="form-group">
                            <label className="form-label">{row.label}</label>
                            <div style={{ padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 3, fontSize: '0.82rem' }}>{row.value}</div>
                        </div>
                    ))}
                </div>
                <div className="modal-footer">
                    <button className="abtn abtn-secondary" type="button" onClick={onClose}>Fechar</button>
                </div>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════ */
type Vista = 'mes' | 'semana' | 'dia';

const AgendaPage: React.FC = () => {
    const { ordens, updateOrdem, reprogramarOT, clientes, equipInstalados, modelosEquipamento, tecnicos, currentUser } = useGlobal();
    const isTecnicoCampo = currentUser?.role === 'Técnico de Campo';
    const meuTecnicoNome = currentUser?.tecnicoNome ?? currentUser?.nome;

    const [vista,       setVista]     = useState<Vista>('mes');
    const [cursor,      setCursor]    = useState(new Date(TODAY));
    const [filterTec,   setFilterTec] = useState('');
    const [detalheOT,   setDetalheOT] = useState<OrdemTrabalho | null>(null);
    const [dragOT,      setDragOT]    = useState<OrdemTrabalho | null>(null);
    const [dropTarget,  setDropTarget]= useState<{ ot: OrdemTrabalho; date: string } | null>(null);
    const [dropOver,    setDropOver]  = useState<string | null>(null); // date being hovered
    const [toast,       setToast]     = useState('');
    const [previewHtml, setPreviewHtml] = useState('');

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

    const campoTecs = tecnicos.filter(t => t.ativo);

    const nav = (dir: 1 | -1) => {
        setCursor(prev => {
            const d = new Date(prev);
            if (vista === 'dia')         d.setDate(d.getDate() + dir);
            else if (vista === 'semana') d.setDate(d.getDate() + dir * 7);
            else d.setMonth(d.getMonth() + dir);
            return d;
        });
    };

    const navLabel = vista === 'dia'
        ? fmtDateLong(cursor)
        : vista === 'semana'
        ? `Semana ${fmtWeek(startOfWeek(cursor))}`
        : fmtMonth(cursor);

    const getClienteNome = (id: string) => clientes.find(c => c.id === id)?.nome ?? id;
    const getEquipNome   = (id: string) => {
        const eq = equipInstalados.find(e => e.id === id);
        if (!eq) return '';
        const mod = modelosEquipamento.find(m => m.id === eq.modeloId);
        return mod ? `${mod.marca} ${mod.nome}` : eq.id;
    };

    const ordemsFiltradas = useMemo(() =>
        ordens.filter(o => {
            if (!o.dataAgendada) return false;
            if (filterTec && o.responsavel !== filterTec) return false;
            if (isTecnicoCampo && o.responsavel !== meuTecnicoNome) return false;
            return true;
        }), [ordens, filterTec, isTecnicoCampo, meuTecnicoNome]);

    const byDate = useMemo(() => {
        const m: Record<string, OrdemTrabalho[]> = {};
        ordemsFiltradas.forEach(o => {
            const d = otDate(o);
            if (d) { if (!m[d]) m[d] = []; m[d].push(o); }
        });
        return m;
    }, [ordemsFiltradas]);

    const periodOT = useMemo(() => {
        let start: string, end: string;
        if (vista === 'dia') {
            start = end = isoDate(cursor);
        } else if (vista === 'semana') {
            const sw = startOfWeek(cursor);
            start = isoDate(sw); end = isoDate(addDays(sw, 6));
        } else {
            const sm = startOfMonth(cursor);
            start = isoDate(sm);
            end = isoDate(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));
        }
        return ordemsFiltradas.filter(o => { const d = otDate(o); return d && d >= start && d <= end; });
    }, [ordemsFiltradas, vista, cursor]);

    /* ── Drag handlers ── */
    const handleDragStart = (e: React.DragEvent, ot: OrdemTrabalho) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('otId', ot.id);
        setDragOT(ot);
    };
    const handleDragOver  = (e: React.DragEvent, dateStr: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDropOver(dateStr);
    };
    const handleDragLeave = () => setDropOver(null);
    const handleDrop      = (e: React.DragEvent, dateStr: string) => {
        e.preventDefault();
        setDropOver(null);
        if (isTecnicoCampo || !dragOT || dateStr === dragOT.dataAgendada) { setDragOT(null); return; }
        setDropTarget({ ot: dragOT, date: dateStr });
        setDragOT(null);
    };

    const handleReprogramar = async (novaData: string, motivo: string) => {
        if (!dropTarget) return;
        const ot = dropTarget.ot;
        const oldStart = ot.dataAgendada ?? '';
        const delta    = oldStart ? Math.round((new Date(novaData).getTime() - new Date(oldStart).getTime()) / 86400000) : 0;
        const newFim   = ot.dataProgFim && delta !== 0
            ? isoDate(addDays(new Date(ot.dataProgFim), delta))
            : ot.dataProgFim;
        try {
            await reprogramarOT(ot.id, novaData, oldStart || undefined, motivo);
            if (newFim !== ot.dataProgFim) {
                updateOrdem(ot.id, { dataProgFim: newFim });
            }
        } catch (e) { console.error(e); }
        showToast(`OT ${ot.id} reprogramada para ${new Date(novaData).toLocaleDateString('pt-PT')}. Motivo: ${motivo}`);
        setDropTarget(null);
    };

    /* ── Print Agenda (all views) ── */
    const buildAgendaHtml = (): string | null => {
        // Determine OTs for the current period based on active view
        let periodOTs: OrdemTrabalho[];
        let periodTitle: string;

        if (vista === 'dia') {
            const dayStr = isoDate(cursor);
            periodOTs = ordemsFiltradas.filter(o => otDate(o) === dayStr);
            periodTitle = cursor.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        } else if (vista === 'semana') {
            const sw = startOfWeek(cursor);
            const start = isoDate(sw), end = isoDate(addDays(sw, 6));
            periodOTs = ordemsFiltradas.filter(o => { const d = otDate(o); return !!d && d >= start && d <= end; });
            periodTitle = `Semana ${fmtWeek(sw)}`;
        } else {
            const sm = startOfMonth(cursor);
            const start = isoDate(sm);
            const end = isoDate(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));
            periodOTs = ordemsFiltradas.filter(o => { const d = otDate(o); return !!d && d >= start && d <= end; });
            periodTitle = fmtMonth(cursor);
        }

        if (periodOTs.length === 0) return null;

        const tecNames = filterTec
            ? [filterTec]
            : Array.from(new Set(periodOTs.map(o => o.responsavel).filter(Boolean) as string[])).sort();

        const byDateP: Record<string, OrdemTrabalho[]> = {};
        periodOTs.forEach(ot => {
            const d = otDate(ot);
            if (d) { if (!byDateP[d]) byDateP[d] = []; byDateP[d].push(ot); }
        });

        const estadoClass = (est: OTEstado) => 'estado-' + est.toLowerCase().replace(' ', '-');

        const buildSection = (days: Date[], sectionOTs: OrdemTrabalho[], byDateW: Record<string, OrdemTrabalho[]>, title: string) => {
            const hdrs = days.map(d => {
                const dow = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()];
                return `<th>${dow}<br/><span class="day-num">${d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}</span></th>`;
            }).join('');
            const rows = tecNames.map(tec => {
                const cells = days.map(day => {
                    const ds = isoDate(day);
                    const otsT = (byDateW[ds] ?? []).filter(o => o.responsavel === tec);
                    if (otsT.length === 0) return `<td class="cell-empty"></td>`;
                    return `<td class="cell">${otsT.map(ot =>
                        `<div class="ot-card ${estadoClass(ot.estado)}"><span class="ot-id">${ot.id}</span><span class="ot-tipo">${ot.naturezaIntervencao || '—'}</span><span class="ot-cliente">${getClienteNome(ot.clienteId)}</span></div>`
                    ).join('')}</td>`;
                }).join('');
                return `<tr><td class="tec-name">${tec}</td>${cells}</tr>`;
            }).join('');
            const totals = days.map(day => {
                const cnt = (byDateW[isoDate(day)] ?? []).length;
                return `<td class="total-cell">${cnt > 0 ? cnt : '—'}</td>`;
            }).join('');
            return `<div class="week-section">
                <div class="week-header">${title} &mdash; ${sectionOTs.length} ordem(ns)</div>
                <table><thead><tr><th class="th-tec">Técnico</th>${hdrs}</tr></thead>
                <tbody>${rows}<tr class="total-row"><td class="th-tec">Total / dia</td>${totals}</tr></tbody></table>
            </div>`;
        };

        let sectionsHTML = '';

        if (vista === 'dia') {
            sectionsHTML = buildSection([cursor], periodOTs, byDateP,
                cursor.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long' }));
        } else if (vista === 'semana') {
            const sw = startOfWeek(cursor);
            const days = Array.from({ length: 7 }, (_, i) => addDays(sw, i));
            sectionsHTML = buildSection(days, periodOTs, byDateP, `Semana ${fmtWeek(sw)}`);
        } else {
            // Month: iterate weeks, only print those with OTs
            const sm = startOfMonth(cursor);
            const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
            let weekStart = startOfWeek(sm);
            while (isoDate(weekStart) <= isoDate(lastDay)) {
                const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
                const weekOTs = days.flatMap(day => byDateP[isoDate(day)] ?? []);
                if (weekOTs.length > 0) {
                    const byDateW: Record<string, OrdemTrabalho[]> = {};
                    weekOTs.forEach(ot => { const dt = otDate(ot); if (dt) { if (!byDateW[dt]) byDateW[dt] = []; byDateW[dt].push(ot); } });
                    const sf = weekStart.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
                    const ef = addDays(weekStart, 6).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });
                    sectionsHTML += buildSection(days, weekOTs, byDateW, `Semana de ${sf} a ${ef}`);
                }
                weekStart = addDays(weekStart, 7);
            }
        }

        if (!sectionsHTML) return null;

        const legend = `<div class="legend">
            <div class="legend-title">Legenda — Estados das Ordens de Trabalho</div>
            <div class="legend-items">
                <div class="legend-item estado-programado"><span class="leg-dot"></span>Programado</div>
                <div class="legend-item estado-em-curso"><span class="leg-dot"></span>Em curso</div>
                <div class="legend-item estado-terminado"><span class="leg-dot"></span>Terminado</div>
                <div class="legend-item estado-encerrado"><span class="leg-dot"></span>Encerrado</div>
            </div>
        </div>`;

        const filterLabel = filterTec ? ` — ${filterTec}` : '';
        const pageSize = vista === 'dia' ? 'A4 portrait' : 'A4 landscape';
        return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<title>Agenda — ${periodTitle}${filterLabel}</title>
<style>
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; padding: 12mm 15mm; color: #111; }
@page { size: ${pageSize}; margin: 0; }
h1 { font-size: 1.1rem; margin: 0 0 2px; }
.subtitle { font-size: 0.72rem; color: #555; margin-bottom: 14px; }
.week-section { margin-bottom: 18px; page-break-inside: avoid; }
.week-header { font-weight: 700; font-size: 0.82rem; padding: 5px 10px; background: #1d4ed8 !important; color: #fff !important; border-radius: 3px 3px 0 0; }
table { width: 100%; border-collapse: collapse; font-size: 0.7rem; }
th { padding: 4px 5px; background: #eff6ff !important; border: 1px solid #bfdbfe; text-align: center; font-weight: 700; }
.th-tec { width: 120px; text-align: left; font-size: 0.72rem; }
.day-num { font-weight: 400; font-size: 0.65rem; color: #555; }
td { padding: 3px 4px; border: 1px solid #e5e7eb; vertical-align: top; min-width: 75px; }
.tec-name { font-weight: 600; font-size: 0.75rem; background: #f9fafb !important; white-space: nowrap; }
.cell-empty { background: #fafafa !important; }
.ot-card { padding: 2px 5px; border-radius: 2px; margin-bottom: 2px; font-size: 0.65rem; border-left-width: 3px; border-left-style: solid; }
.ot-id { font-weight: 700; margin-right: 3px; }
.ot-tipo { display: block; font-size: 0.6rem; }
.ot-cliente { display: block; font-size: 0.6rem; color: #444; }
.estado-programado { background: #eff6ff !important; color: #1d4ed8 !important; border-color: #3b82f6 !important; }
.estado-em-curso   { background: #fff7ed !important; color: #c2410c !important; border-color: #f97316 !important; }
.estado-terminado  { background: #f0fdf4 !important; color: #166534 !important; border-color: #22c55e !important; }
.estado-encerrado  { background: #f3f4f6 !important; color: #6b7280 !important; border-color: #9ca3af !important; }
.total-row td { background: #eff6ff !important; font-weight: 700; text-align: center; color: #1d4ed8 !important; font-size: 0.73rem; }
.legend { margin-top: 20px; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; page-break-inside: avoid; }
.legend-title { font-weight: 700; font-size: 0.75rem; margin-bottom: 7px; }
.legend-items { display: flex; gap: 12px; flex-wrap: wrap; }
.legend-item { display: flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 3px; font-size: 0.7rem; font-weight: 600; }
.leg-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
.footer { margin-top: 10px; text-align: center; font-size: 0.65rem; color: #888; border-top: 1px solid #eee; padding-top: 5px; }
</style>
</head><body>
<h1>Agenda — ${periodTitle}${filterLabel}</h1>
<div class="subtitle">Impresso em ${new Date().toLocaleDateString('pt-PT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} &bull; AQUATEX SGI</div>
${sectionsHTML}
${legend}
<div class="footer">AQUATEX, LDA &nbsp;&bull;&nbsp; Sistema de Gestão de Intervenções &nbsp;&bull;&nbsp; Agenda</div>
</body></html>`;
    };

    const printAgenda = () => {
        const html = buildAgendaHtml();
        if (!html) return;
        const w = window.open('', '_blank', 'width=1200,height=850');
        if (!w) return;
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 350);
    };

    const handlePreviewAgenda = () => {
        const html = buildAgendaHtml();
        if (html) setPreviewHtml(html);
    };

    /* Draggable only for Programado OTs and non-técnico-campo users */
    const canDrag = (ot: OrdemTrabalho) => !isTecnicoCampo && (ot.estado === 'Programada' || ot.estado === 'Adiada');

    const dropStyle = (dateStr: string): React.CSSProperties =>
        dropOver === dateStr && dragOT
            ? { outline: '2px dashed var(--blue)', background: '#EFF6FF' }
            : {};

    /* ── VISTA DIA ── */
    const VistaDia = () => {
        const dayStr = isoDate(cursor);
        const dayOTs = byDate[dayStr] ?? [];
        const tecList = filterTec ? [filterTec] : campoTecs.map(t => t.nome);
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tecList.map(tec => {
                    const otsT = dayOTs.filter(o => o.responsavel === tec);
                    return (
                        <div key={tec} style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ padding: '6px 12px', background: '#f8f9fa', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontWeight: 700, fontSize: '0.83rem' }}>{tec}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{otsT.length} OT</span>
                            </div>
                            <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 5, minHeight: 48 }}>
                                {otsT.length === 0 ? (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '6px 0' }}>Sem ordens de trabalho.</div>
                                ) : otsT.map(ot => (
                                    <div key={ot.id} onClick={() => setDetalheOT(ot)}
                                        style={{ padding: '6px 10px', borderRadius: 4, cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'flex-start', ...(() => { const ec = ESTADO_COLOR[ot.estado]; return { background: ec.bg, border: `1px solid ${ec.border}`, color: ec.color }; })() }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{ot.id} · {ot.naturezaIntervencao}</div>
                                            <div style={{ fontSize: '0.76rem' }}>{getClienteNome(ot.clienteId)}</div>
                                            <div style={{ fontSize: '0.72rem', marginTop: 2 }}>{ot.descricao}</div>
                                        </div>
                                        <span style={{ fontSize: '0.7rem', flexShrink: 0, fontWeight: 700 }}>{ot.estado}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    /* ── VISTA SEMANA ── */
    const VistaSemana = () => {
        const sw = startOfWeek(cursor);
        const days = Array.from({ length: 7 }, (_, i) => addDays(sw, i));
        const tecList = filterTec ? [filterTec] : campoTecs.map(t => t.nome);
        return (
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                    <thead>
                        <tr>
                            <th style={{ padding: '6px 10px', background: '#f8f9fa', border: '1px solid var(--border)', fontSize: '0.78rem', fontWeight: 700, width: 130, textAlign: 'left' }}>Técnico</th>
                            {days.map(d => {
                                const isToday = isoDate(d) === isoDate(TODAY);
                                return (
                                    <th key={isoDate(d)} style={{ padding: '6px 8px', background: isToday ? '#EFF6FF' : '#f8f9fa', border: '1px solid var(--border)', fontSize: '0.76rem', fontWeight: 700, textAlign: 'center', color: isToday ? 'var(--blue)' : undefined }}>
                                        {d.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit' })}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {tecList.map(tec => (
                            <tr key={tec}>
                                <td style={{ padding: '6px 10px', border: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 600, background: '#fafafa', verticalAlign: 'top' }}>{tec}</td>
                                {days.map(d => {
                                    const ds = isoDate(d);
                                    const otsT = (byDate[ds] ?? []).filter(o => o.responsavel === tec);
                                    return (
                                        <td key={ds}
                                            onDragOver={e => handleDragOver(e, ds)}
                                            onDragLeave={handleDragLeave}
                                            onDrop={e => handleDrop(e, ds)}
                                            style={{ padding: 4, border: '1px solid var(--border)', verticalAlign: 'top', minWidth: 80, background: isoDate(d) === isoDate(TODAY) ? '#F8FAFF' : undefined, transition: 'outline 0.1s', ...dropStyle(ds) }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                {otsT.map(ot => (
                                                    <OTCard key={ot.id} ot={ot}
                                                        nomeCliente={getClienteNome(ot.clienteId)}
                                                        onClick={() => setDetalheOT(ot)}
                                                        onDragStart={e => handleDragStart(e, ot)}
                                                        canDrag={canDrag(ot)} />
                                                ))}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        <tr>
                            <td style={{ padding: '4px 10px', border: '1px solid var(--border)', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', background: '#f8f9fa' }}>Total / dia</td>
                            {days.map(d => {
                                const ds = isoDate(d);
                                const cnt = (byDate[ds] ?? []).length;
                                return (
                                    <td key={ds} style={{ padding: '4px 8px', border: '1px solid var(--border)', textAlign: 'center', fontSize: '0.76rem', fontWeight: cnt > 0 ? 700 : 400, color: cnt > 0 ? 'var(--blue)' : 'var(--text-muted)', background: '#f8f9fa' }}>
                                        {cnt > 0 ? cnt : '—'}
                                    </td>
                                );
                            })}
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };

    /* ── VISTA MÊS ── */
    const VistaMes = () => {
        const sm = startOfMonth(cursor);
        const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
        const startDow = (sm.getDay() + 6) % 7;
        const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;
        const weeks: (Date | null)[][] = [];
        let week: (Date | null)[] = [];
        for (let i = 0; i < totalCells; i++) {
            const dayNum = i - startDow + 1;
            week.push(dayNum >= 1 && dayNum <= daysInMonth ? new Date(cursor.getFullYear(), cursor.getMonth(), dayNum) : null);
            if (week.length === 7) { weeks.push(week); week = []; }
        }
        const DOW_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
        return (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 560 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
                    {DOW_LABELS.map(l => (
                        <div key={l} style={{ textAlign: 'center', fontSize: '0.73rem', fontWeight: 700, color: 'var(--text-muted)', padding: '4px 0' }}>{l}</div>
                    ))}
                </div>
                {weeks.map((wk, wi) => (
                    <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
                        {wk.map((day, di) => {
                            if (!day) return <div key={di} style={{ minHeight: 80, background: '#fafafa', border: '1px solid var(--border)', borderRadius: 3 }} />;
                            const ds = isoDate(day);
                            const dayOTs = byDate[ds] ?? [];
                            const isToday = ds === isoDate(TODAY);
                            const SHOW_MAX = 3;
                            return (
                                <div key={ds}
                                    onDragOver={e => handleDragOver(e, ds)}
                                    onDragLeave={handleDragLeave}
                                    onDrop={e => handleDrop(e, ds)}
                                    style={{ minHeight: 80, border: `1px solid ${isToday ? 'var(--blue)' : 'var(--border)'}`, borderRadius: 3, padding: 4, background: isToday ? '#F8FAFF' : '#fff', cursor: dayOTs.length > 0 ? 'pointer' : 'default', transition: 'outline 0.1s', ...dropStyle(ds) }}
                                    onClick={() => { if (dayOTs.length > 0) { setCursor(day); setVista('dia'); } }}>
                                    <div style={{ fontSize: '0.73rem', fontWeight: isToday ? 800 : 600, color: isToday ? 'var(--blue)' : 'var(--text-primary)', marginBottom: 3 }}>
                                        {day.getDate()}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        {dayOTs.slice(0, SHOW_MAX).map(ot => (
                                            <div key={ot.id} onClick={e => e.stopPropagation()}>
                                                <OTCard ot={ot} nomeCliente={getClienteNome(ot.clienteId)}
                                                    onClick={() => setDetalheOT(ot)}
                                                    onDragStart={e => handleDragStart(e, ot)}
                                                    canDrag={canDrag(ot)} />
                                            </div>
                                        ))}
                                        {dayOTs.length > SHOW_MAX && (
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', padding: '1px 4px' }}>+{dayOTs.length - SHOW_MAX} mais</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
              </div>
            </div>
        );
    };

    /* ── Stats panel ── */
    const StatsPanel = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200, maxWidth: 220 }}>
            <div style={{ fontWeight: 700, fontSize: '0.83rem', color: 'var(--text-secondary)' }}>Resumo do Período</div>
            <div style={{ padding: '8px 10px', background: '#f8f9fa', border: '1px solid var(--border)', borderRadius: 4 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Total OT no período</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--blue)' }}>{periodOT.length}</div>
            </div>
            {(['Registada', 'Programada', 'Adiada', 'Confirmada', 'Em execução', 'Finalizada'] as OTEstado[]).map(est => {
                const cnt = periodOT.filter(o => o.estado === est).length;
                if (cnt === 0) return null;
                const ec = ESTADO_COLOR[est];
                return (
                    <div key={est} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', background: ec.bg, border: `1px solid ${ec.border}`, borderRadius: 4, fontSize: '0.78rem', color: ec.color }}>
                        <span>{est}</span><strong>{cnt}</strong>
                    </div>
                );
            })}
            {dragOT && (
                <div style={{ marginTop: 8, padding: '8px 10px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 4, fontSize: '0.76rem', color: '#92400E' }}>
                    A arrastar: <strong>{dragOT.id}</strong><br/>Largue sobre um dia para reprogramar.
                </div>
            )}
        </div>
    );

    return (
        <AppLayout>
            <ActionBar title="Agenda" breadcrumb="AQUATEX SGI · Agenda">
                <div style={{ display: 'flex', gap: 4 }}>
                    {(['dia', 'semana', 'mes'] as Vista[]).map(v => (
                        <button key={v} type="button"
                            className={`abtn ${vista === v ? 'abtn-primary' : 'abtn-secondary'}`}
                            onClick={() => setVista(v)}>
                            {v === 'dia' ? 'Dia' : v === 'semana' ? 'Semana' : 'Mês'}
                        </button>
                    ))}
                </div>
                <div className="actionbar-sep" />
                {!isTecnicoCampo && (
                    <select className="filter-select" value={filterTec} onChange={e => setFilterTec(e.target.value)} style={{ fontSize: '0.82rem' }}>
                        <option value="">Todos os técnicos</option>
                        {campoTecs.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                    </select>
                )}
                {isTecnicoCampo && meuTecnicoNome && (
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--blue)', padding: '4px 10px', background: '#EFF6FF', borderRadius: 4, border: '1px solid #BFDBFE' }}>
                        {meuTecnicoNome}
                    </span>
                )}
                <div className="actionbar-spacer" />
                <button className="abtn abtn-secondary" type="button" onClick={handlePreviewAgenda} title="Pré-visualizar agenda" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Eye size={13} /> Pré-visualizar
                </button>
                <button className="abtn abtn-secondary" type="button" onClick={printAgenda} title="Imprimir agenda semanal">
                    <Printer size={13} /> Imprimir
                </button>
                <button className="abtn abtn-secondary" type="button" onClick={() => setCursor(new Date(TODAY))}>
                    <Calendar size={13} /> Hoje
                </button>
                <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <button className="abtn abtn-secondary" type="button" style={{ padding: '5px 8px' }} onClick={() => nav(-1)}><ChevronLeft size={14} /></button>
                    <span style={{ fontSize: '0.83rem', fontWeight: 600, minWidth: 180, textAlign: 'center' }}>{navLabel}</span>
                    <button className="abtn abtn-secondary" type="button" style={{ padding: '5px 8px' }} onClick={() => nav(1)}><ChevronRight size={14} /></button>
                </div>
            </ActionBar>

            <div className="page-content">
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '280px' }}>
                        {vista === 'dia'    && <VistaDia />}
                        {vista === 'semana' && <VistaSemana />}
                        {vista === 'mes'    && <VistaMes />}
                    </div>
                    <StatsPanel />
                </div>
            </div>

            {detalheOT && (
                <OTDetail
                    ot={detalheOT}
                    nomeCliente={getClienteNome(detalheOT.clienteId)}
                    nomeEquip={getEquipNome(detalheOT.equipInstaladoId)}
                    onClose={() => setDetalheOT(null)}
                />
            )}

            {dropTarget && (
                <ReprogramarModal
                    ot={dropTarget.ot}
                    novaData={dropTarget.date}
                    onClose={() => setDropTarget(null)}
                    onConfirm={handleReprogramar}
                />
            )}

            {toast && (
                <div className="toast" role="status">
                    <CheckCircle size={14} strokeWidth={2.5} style={{ color: 'var(--green)' }} />
                    <span>{toast}</span>
                </div>
            )}

            {previewHtml && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, fontWeight: 700, fontSize: '0.85rem' }}>Pré-visualização</span>
                        <button type="button" className="abtn abtn-primary" onClick={printAgenda} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Printer size={13} /> Imprimir
                        </button>
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

export default AgendaPage;
