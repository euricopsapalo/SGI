import React, { useState, useMemo, useEffect } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import SearchableSelect from '../../components/SearchableSelect';
import {
    useGlobal, OrdemTrabalho, OTEstado, OTTipo, OTMaoObra, OTArtigo,
    EquipInstalado, ModeloEquipamento, Cliente,
} from '../../contexts/GlobalContext';
import {
    Search, Plus, Filter, Eye, X, AlertCircle, Check, Printer,
    Clock, PlayCircle, CheckCircle, Archive, AlertTriangle,
    Trash2, ChevronRight, Calendar, List, Download,
} from 'lucide-react';
import ExportModal, { ExportCol } from '../../components/ExportModal';

/* ── Constants ───────────────────────────────────────── */
const ESTADO_CONFIG: Record<OTEstado, { dot: string; label: string; icon: React.ReactNode }> = {
    'Programado': { dot: 'dot-blue',   label: 'Programado', icon: <Clock      size={13} /> },
    'Em curso':   { dot: 'dot-orange', label: 'Em curso',   icon: <PlayCircle size={13} /> },
    'Terminado':  { dot: 'dot-green',  label: 'Terminado',  icon: <CheckCircle size={13} /> },
    'Encerrado':  { dot: 'dot-gray',   label: 'Encerrado',  icon: <Archive    size={13} /> },
};
const PERIOD_OPTIONS = ['Mensal', 'Trimestral', 'Semestral', 'Anual', 'Única'];

const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('pt-PT') : '—';
const today = () => new Date().toISOString().split('T')[0];

const COLS_OT: ExportCol[] = [
    { key: 'id',             label: 'Nº OT' },
    { key: 'tipo',           label: 'Tipo' },
    { key: 'equipamento',    label: 'Equipamento' },
    { key: 'clienteNome',    label: 'Cliente' },
    { key: 'responsavel',    label: 'Responsável' },
    { key: 'dataProgInicio', label: 'Data Prog. Início' },
    { key: 'estado',         label: 'Estado' },
    { key: 'tipoTrabalho',   label: 'Tipo Trabalho' },
];

/* ── Standalone print helper (used by modal & context menu) ── */
function printOT(
    ot: OrdemTrabalho,
    equipInstalados: EquipInstalado[],
    modelosEquipamento: ModeloEquipamento[],
    clientes: Cliente[],
) {
    const equip = equipInstalados.find(e => e.id === ot.equipInstaladoId);
    const mod   = modelosEquipamento.find(m => m.id === equip?.modeloId)?.nome ?? '—';
    const cli   = clientes.find(c => c.id === ot.clienteId)?.nome ?? '—';

    const maosHtml = (ot.maosDeObra?.length ?? 0) > 0
        ? `<h3 class="sec-title">Mão de Obra</h3>
<table><thead><tr><th>Função</th><th style="text-align:right">Custo/h (Kz)</th><th>Hora</th></tr></thead><tbody>
${ot.maosDeObra.map(m => `<tr><td>${m.funcao}</td><td style="text-align:right">${m.custo.toLocaleString('pt-PT')}</td><td>${m.hora}</td></tr>`).join('')}
</tbody></table>` : '';

    const artsHtml = (ot.artigos?.length ?? 0) > 0
        ? `<h3 class="sec-title">Artigos / Consumíveis</h3>
<table><thead><tr><th>Descrição</th><th style="text-align:center">Qtd</th><th style="text-align:right">Preço Unit. (Kz)</th><th style="text-align:right">Total (Kz)</th></tr></thead><tbody>
${ot.artigos.map(a => `<tr><td>${a.descricao}</td><td style="text-align:center">${a.quantidade}</td><td style="text-align:right">${a.preco.toLocaleString('pt-PT')}</td><td style="text-align:right">${(a.quantidade * a.preco).toLocaleString('pt-PT')}</td></tr>`).join('')}
</tbody></table>` : '';

    const diagHtml = ot.orgao
        ? `<h3 class="sec-title">Diagnóstico</h3>
<table class="info-table">
<tr><td>Órgão</td><td>${ot.orgao}</td></tr>
<tr><td>Sintoma</td><td>${ot.sintoma ?? '—'}</td></tr>
<tr><td>Causa</td><td>${ot.causa ?? '—'}</td></tr>
</table>` : '';

    const w = window.open('', '_blank', 'width=840,height=960');
    if (!w) return;
    w.document.write(`<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>OT ${ot.id}</title>
<style>
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
  .sign-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 28px; }
  .sign-box  { border: 1px solid #bbb; border-radius: 4px; padding: 12px 16px; }
  .sign-lbl  { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #555; margin-bottom: 6px; }
  .sign-name { font-size: 0.76rem; color: #555; margin-bottom: 4px; }
  .sign-line { border-top: 1px solid #555; margin-top: 46px; padding-top: 4px; font-size: 0.65rem; color: #888; }
  .footer    { margin-top: 20px; font-size: 0.65rem; color: #bbb; text-align: center; border-top: 1px solid #eee; padding-top: 6px; }
  @page { size: A4; margin: 0; }
</style></head><body>
<div class="header-row">
  <div>
    <h1>AQUATEX — Ordem de Trabalho</h1>
    <div class="sub">Nº: <strong>${ot.id}</strong> &nbsp;|&nbsp; Impresso em ${new Date().toLocaleString('pt-PT')}</div>
  </div>
  <span class="badge">${ot.estado}</span>
</div>
<h3 class="sec-title">Identificação</h3>
<table class="info-table">
<tr><td>Tipo</td><td>${ot.tipo === 'programada' ? 'Programada' : 'Pontual'} — ${ot.tipoTrabalho}</td></tr>
<tr><td>Equipamento</td><td>${equip?.id ?? '—'} — ${mod} <span style="color:#888">(${equip?.nrSerie ?? '—'})</span></td></tr>
<tr><td>Cliente</td><td>${cli}</td></tr>
<tr><td>Responsável</td><td>${ot.responsavel}</td></tr>
<tr><td>Descrição</td><td>${ot.descricao}</td></tr>
${ot.periodicidade ? `<tr><td>Periodicidade</td><td>${ot.periodicidade}</td></tr>` : ''}
${ot.previsaoTempo  ? `<tr><td>Previsão Tempo</td><td>${ot.previsaoTempo}h</td></tr>` : ''}
</table>
<h3 class="sec-title">Datas</h3>
<table class="info-table">
${ot.dataProgInicio  ? `<tr><td>Data Prog. Início</td><td>${fmtDate(ot.dataProgInicio)}</td></tr>` : ''}
${ot.dataProgFim     ? `<tr><td>Data Prog. Fim</td><td>${fmtDate(ot.dataProgFim)}</td></tr>` : ''}
${ot.dataEmissao     ? `<tr><td>Emitida</td><td>${fmtDate(ot.dataEmissao)}</td></tr>` : ''}
${ot.dataInicio      ? `<tr><td>Início Efectivo</td><td>${fmtDate(ot.dataInicio)}</td></tr>` : ''}
${ot.dataFim         ? `<tr><td>Fim Efectivo</td><td>${fmtDate(ot.dataFim)}</td></tr>` : ''}
${ot.dataEncerramento? `<tr><td>Encerramento</td><td>${fmtDate(ot.dataEncerramento)}</td></tr>` : ''}
</table>
${maosHtml}${artsHtml}${diagHtml}
<div class="sign-grid">
  <div class="sign-box">
    <div class="sign-lbl">Técnico de Campo</div>
    <div class="sign-name">${ot.responsavel ?? '—'}</div>
    <div class="sign-line">Assinatura &amp; Data</div>
  </div>
  <div class="sign-box">
    <div class="sign-lbl">Cliente / Responsável</div>
    <div class="sign-name">${cli}</div>
    <div class="sign-line">Assinatura &amp; Data</div>
  </div>
</div>
<div class="footer">AQUATEX, LDA &nbsp;&bull;&nbsp; Sistema de Gestão de Intervenções</div>
</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
}

/* ══ OT Form Modal ═══════════════════════════════════════ */
interface OTFormProps {
    ot?: OrdemTrabalho;
    onClose: () => void;
    onSave: (o: Omit<OrdemTrabalho, 'id'>) => void;
    onEmitir?: () => void;
    onTerminar?: (dataFim: string) => void;
    onEncerrar?: (dataEnc: string) => void;
    readOnly?: boolean;
}

const OTForm: React.FC<OTFormProps> = ({ ot, onClose, onSave, onEmitir, onTerminar, onEncerrar, readOnly }) => {
    const { equipInstalados, clientes, modelosEquipamento, planos, tiposTrabalho, tiposOT, funcoesTecnico, artigos: catalog, tecnicos, currentUser, taxaIvaGlobal } = useGlobal();
    const isTecnicoCampo = currentUser?.role === 'Técnico de Campo';
    const [tab, setTab] = useState<'origem' | 'maos' | 'artigos' | 'diagnostico' | 'gestao'>('origem');

    // Origem
    const [tipo, setTipo]           = useState<OTTipo>(ot?.tipo ?? 'pontual');
    const [equipId, setEquipId]     = useState(ot?.equipInstaladoId ?? '');
    const [clienteId, setClienteId] = useState(ot?.clienteId ?? '');
    const [descricao, setDesc]      = useState(ot?.descricao ?? '');
    const [previsao, setPrevisao]   = useState(String(ot?.previsaoTempo ?? ''));
    const [periodo, setPeriodo]     = useState(ot?.periodicidade ?? 'Mensal');
    const [planoId, setPlanoId]     = useState(ot?.planoId ?? '');
    const [tipoTrab, setTipoTrab]   = useState(ot?.tipoTrabalho ?? '');
    const [tipoOT, setTipoOT]       = useState(ot?.tipoOT ?? '');
    const [responsavel, setResp]    = useState(ot?.responsavel ?? (!ot && isTecnicoCampo ? (currentUser?.tecnicoNome ?? currentUser?.nome ?? '') : ''));

    // Mão de obra
    const [maos, setMaos] = useState<OTMaoObra[]>(ot?.maosDeObra ?? []);

    // Artigos
    const [arts, setArts] = useState<OTArtigo[]>(ot?.artigos ?? []);

    // Auto-load from plano when OT is Programado with planoId but has no mão de obra/artigos
    useEffect(() => {
        if (!ot || ot.estado !== 'Programado') return;
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
    const [dpI, setDpI] = useState(ot?.dataProgInicio ?? '');
    const [dpF, setDpF] = useState(ot?.dataProgFim    ?? '');
    const [dEm, setDEm] = useState(ot?.dataEmissao    ?? '');
    const [dIn, setDIn] = useState(ot?.dataInicio     ?? '');
    const [dFi, setDFi] = useState(ot?.dataFim        ?? '');
    const [dEn, setDEn] = useState(ot?.dataEncerramento ?? '');

    // Emit/Terminate confirmation
    const [emitirForm, setEmitirForm]     = useState(false);
    const [terminarForm, setTerminarForm] = useState(false);
    const [encerrarForm, setEncerrarForm] = useState(false);

    const [errors, setErrors] = useState<Record<string, string>>({});

    // Derived
    const equipOpts = equipInstalados.map(e => {
        const cli = clientes.find(c => c.id === e.clienteId)?.nome ?? '—';
        const mod = modelosEquipamento.find(m => m.id === e.modeloId)?.nome ?? '—';
        return { value: e.id, label: `${e.id} — ${mod}`, sub: `${cli} · ${e.nrSerie}` };
    });
    const tecCampoOpts = tecnicos.filter(t => t.ativo).map(t => ({ value: t.nome, label: t.nome, sub: funcoesTecnico.find(f => f.id === t.funcaoId)?.descricao }));
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
        const tt = tiposTrabalho.find(t => t.id === p.tipoTrabalhoId);
        if (tt) setTipoTrab(tt.descricao);
        setMaos(p.maosDeObra.map(m => {
            const f = funcoesTecnico.find(x => x.id === m.funcaoId);
            return { funcao: f?.descricao ?? m.funcaoId, custo: m.custo, hora: '08:00' };
        }));
        setArts(p.artigos.map(a => {
            const art = catalog.find(x => x.id === a.artigoId);
            return { artigoId: a.artigoId, descricao: art?.descricao ?? '—', quantidade: a.quantidade, preco: a.preco };
        }));
    };

    // Auto-fill mão de obra when responsável is selected (new OT only)
    const handleRespChange = (nome: string) => {
        setResp(nome);
        if (ot) return; // editing — don't override
        const tec = tecnicos.find(t => t.nome === nome);
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
        setArts(p => p.map((x, idx) => idx !== i ? x : { artigoId: id, descricao: a?.descricao ?? '', quantidade: x.quantidade, preco: a?.precoUnitario ?? 0 }));
    };
    const updateArtQtd = (i: number, v: string) => setArts(p => p.map((x, idx) => idx !== i ? x : { ...x, quantidade: Math.max(1, Number(v) || 1) }));

    const validate = () => {
        const e: Record<string, string> = {};
        if (!tipoOT)           e.tipoOT = 'Obrigatório';
        if (!equipId)          e.equip  = 'Obrigatório';
        if (!descricao.trim()) e.desc   = 'Obrigatório';
        if (!tipoTrab)         e.tipo   = 'Obrigatório';
        if (!responsavel)      e.resp   = 'Obrigatório';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const buildOT = (): Omit<OrdemTrabalho, 'id'> => ({
        tipo, equipInstaladoId: equipId, clienteId,
        descricao, previsaoTempo: Number(previsao) || 0, periodicidade: tipo === 'programada' ? periodo : undefined,
        planoId: planoId || undefined, tipoTrabalho: tipoTrab, tipoOT: tipoOT || undefined, responsavel,
        maosDeObra: maos, artigos: arts,
        orgao: orgao || undefined, sintoma: sintoma || undefined, causa: causa || undefined,
        dataProgInicio: dpI || undefined, dataProgFim: dpF || undefined,
        dataEmissao: dEm || undefined, dataInicio: dIn || undefined,
        dataFim: dFi || undefined, dataEncerramento: dEn || undefined,
        estado: ot?.estado ?? 'Programado',
        reprogramacoes: [],
    });

    const handleOk = (ev: React.FormEvent) => {
        ev.preventDefault();
        if (!validate()) { setTab('origem'); return; }
        onSave(buildOT());
    };

    const TABS = [
        { id: 'origem',      label: 'Origem'       },
        { id: 'maos',        label: 'Mão de Obra'  },
        { id: 'artigos',     label: 'Artigos'      },
        { id: 'diagnostico', label: 'Diagnóstico'  },
        { id: 'gestao',      label: 'Gestão'       },
    ] as const;

    const estado = ot?.estado;
    const canEmitir   = estado === 'Programado';
    const canTerminar = estado === 'Em curso';
    const canEncerrar = estado === 'Terminado';

    const handlePrint = () => {
        if (ot) printOT(ot, equipInstalados, modelosEquipamento, clientes);
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 700 }}>
                <div className="modal-header">
                    <div>
                        <h3 className="modal-title">{ot ? `${ot.id} — Ordem de Trabalho` : 'Nova Ordem de Trabalho'}</h3>
                        {ot && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                <span className={`dot ${ESTADO_CONFIG[ot.estado].dot}`} />
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{ot.estado}</span>
                                <span className="tbadge tbadge-admin">{ot.tipo === 'programada' ? 'Programada' : 'Pontual'}</span>
                            </div>
                        )}
                    </div>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
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

                        {/* ── ORIGEM ── */}
                        {tab === 'origem' && (
                            <>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label req">Tipo de OT</label>
                                        <select className={`form-select${errors.tipoOT ? ' err' : ''}`} value={tipoOT} onChange={e => { const v = e.target.value; setTipoOT(v); setTipo(v.toLowerCase().includes('pontual') ? 'pontual' : 'programada'); }}>
                                            <option value="">Seleccionar...</option>
                                            {tiposOT.map(t => <option key={t.id} value={t.descricao}>{t.descricao}</option>)}
                                        </select>
                                        {errors.tipoOT && <span className="form-error"><AlertCircle size={11} /> {errors.tipoOT}</span>}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label req">Equipamento</label>
                                        <SearchableSelect options={equipOpts} value={equipId} onChange={onEquipChange} placeholder="Seleccionar equipamento..." />
                                        {errors.equip && <span className="form-error"><AlertCircle size={11} /> {errors.equip}</span>}
                                    </div>
                                </div>

                                {tipo === 'programada' && equipId && planoOpts.length > 0 && (
                                    <div className="form-group" style={{ padding: '8px 12px', background: 'var(--blue-light,#eff6ff)', border: '1px solid #BFDBFE', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontSize: '0.8rem', flex: 1 }}>Carregar a partir de um plano de manutenção:</span>
                                        <select className="form-select" style={{ width: 'auto', flex: 2 }} value={planoId} onChange={e => loadPlano(e.target.value)}>
                                            <option value="">Seleccionar plano...</option>
                                            {planoOpts.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                        </select>
                                    </div>
                                )}

                                <div className="form-group" style={{ marginTop: 8 }}>
                                    <label className="form-label req">Descrição</label>
                                    <textarea className={`form-textarea${errors.desc ? ' err' : ''}`} value={descricao}
                                        onChange={e => setDesc(e.target.value)} placeholder="Descreva o trabalho a realizar..." style={{ minHeight: 70 }} />
                                    {errors.desc && <span className="form-error"><AlertCircle size={11} /> {errors.desc}</span>}
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label req">Tipo de Trabalho</label>
                                        <select className={`form-select${errors.tipo ? ' err' : ''}`} value={tipoTrab} onChange={e => setTipoTrab(e.target.value)}>
                                            <option value="">Seleccionar...</option>
                                            {tiposTrabalho.map(t => <option key={t.id}>{t.descricao}</option>)}
                                        </select>
                                        {errors.tipo && <span className="form-error"><AlertCircle size={11} /> {errors.tipo}</span>}
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label req">Responsável</label>
                                        <SearchableSelect options={tecCampoOpts} value={responsavel} onChange={handleRespChange} placeholder="Técnico de campo..." />
                                        {errors.resp && <span className="form-error"><AlertCircle size={11} /> {errors.resp}</span>}
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Previsão de Tempo (h)</label>
                                        <input type="number" min={0.5} step={0.5} className="form-input"
                                            value={previsao} onChange={e => setPrevisao(e.target.value)} />
                                    </div>
                                    {tipo === 'programada' && (
                                        <div className="form-group">
                                            <label className="form-label">Periodicidade</label>
                                            <select className="form-select" value={periodo} onChange={e => setPeriodo(e.target.value)}>
                                                {PERIOD_OPTIONS.map(p => <option key={p}>{p}</option>)}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* ── MÃO DE OBRA ── */}
                        {tab === 'maos' && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
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
                            </>
                        )}

                        {/* ── ARTIGOS ── */}
                        {tab === 'artigos' && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
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
                                    const iva = subtotal * (taxaIvaGlobal / 100);
                                    const total = subtotal + iva;
                                    const fmt = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                    return (
                                        <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 3, fontSize: '0.8rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: 3 }}>
                                                <span>Subtotal</span>
                                                <span>{fmt(subtotal)} Kz</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginBottom: 6 }}>
                                                <span>IVA ({taxaIvaGlobal}%)</span>
                                                <span>{fmt(iva)} Kz</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.85rem', borderTop: '1px solid var(--border)', paddingTop: 5 }}>
                                                <span>Total</span>
                                                <strong>{fmt(total)} Kz</strong>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </>
                        )}

                        {/* ── DIAGNÓSTICO ── */}
                        {tab === 'diagnostico' && (
                            <>
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
                            </>
                        )}

                        {/* ── GESTÃO ── */}
                        {tab === 'gestao' && (
                            <>
                                {tipo === 'programada' && (
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Data Prog. Início</label>
                                            <input type="date" className="form-input" value={dpI} onChange={e => {
                                                const inicio = e.target.value;
                                                setDpI(inicio);
                                                if (inicio) {
                                                    const d = new Date(inicio);
                                                    switch (periodo) {
                                                        case 'Mensal':     d.setMonth(d.getMonth() + 1);       break;
                                                        case 'Trimestral': d.setMonth(d.getMonth() + 3);       break;
                                                        case 'Semestral':  d.setMonth(d.getMonth() + 6);       break;
                                                        case 'Anual':      d.setFullYear(d.getFullYear() + 1); break;
                                                        default:           d.setMonth(d.getMonth() + 1);
                                                    }
                                                    d.setDate(d.getDate() - 7);
                                                    setDpF(d.toISOString().split('T')[0]);
                                                }
                                            }} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Data Prog. Fim</label>
                                            <input type="date" className="form-input" value={dpF} onChange={e => setDpF(e.target.value)} />
                                        </div>
                                    </div>
                                )}
                                {tipo === 'pontual' && (
                                    <div className="form-group">
                                        <label className="form-label">Data Programada</label>
                                        <input type="date" className="form-input" value={dpI} onChange={e => { setDpI(e.target.value); setDpF(e.target.value); }} />
                                    </div>
                                )}
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label" style={{ color: 'var(--text-muted)' }}>Emitida</label>
                                        <input type="date" className="form-input" value={dEm} onChange={e => setDEm(e.target.value)} disabled={!ot || ot.estado === 'Programado'} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ color: 'var(--text-muted)' }}>Início</label>
                                        <input type="date" className="form-input" value={dIn} onChange={e => setDIn(e.target.value)} disabled={!ot || ot.estado === 'Programado'} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label" style={{ color: 'var(--text-muted)' }}>Fim</label>
                                        <input type="date" className="form-input" value={dFi} onChange={e => setDFi(e.target.value)} disabled={!ot || ot.estado !== 'Terminado' && ot.estado !== 'Encerrado'} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ color: 'var(--text-muted)' }}>Encerramento</label>
                                        <input type="date" className="form-input" value={dEn} onChange={e => setDEn(e.target.value)} disabled={!ot || ot.estado !== 'Encerrado'} />
                                    </div>
                                </div>

                                {/* Emitir */}
                                {canEmitir && !emitirForm && (
                                    <div style={{ marginTop: 12 }}>
                                        <button type="button" className="abtn abtn-primary" style={{ background: 'var(--orange)', borderColor: 'var(--orange)' }} onClick={() => { setDEm(today()); setDIn(today()); setEmitirForm(true); setTab('gestao'); }}>
                                            <PlayCircle size={13} /> Emitir
                                        </button>
                                    </div>
                                )}
                                {canEmitir && emitirForm && (
                                    <div style={{ marginTop: 12, padding: '10px 12px', background: '#fff7ed', border: '1px solid #FED7AA', borderRadius: 4 }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--orange)', marginBottom: 8 }}>Confirmar Emissão</div>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label className="form-label">Data Emissão</label>
                                                <input type="date" className="form-input" value={dEm} onChange={e => setDEm(e.target.value)} />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Data Início</label>
                                                <input type="date" className="form-input" value={dIn} onChange={e => setDIn(e.target.value)} />
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button type="button" className="abtn abtn-secondary" onClick={() => setEmitirForm(false)}>Cancelar</button>
                                            <button type="button" className="abtn abtn-primary" style={{ background: 'var(--orange)', borderColor: 'var(--orange)' }} onClick={() => onEmitir?.()}>Confirmar Emissão</button>
                                        </div>
                                    </div>
                                )}

                                {/* Terminar */}
                                {canTerminar && !terminarForm && (
                                    <div style={{ marginTop: 12 }}>
                                        <button type="button" className="abtn abtn-primary" style={{ background: 'var(--green)', borderColor: 'var(--green)' }} onClick={() => { setDFi(today()); setTerminarForm(true); setTab('gestao'); }}>
                                            <CheckCircle size={13} /> Terminar
                                        </button>
                                    </div>
                                )}
                                {canTerminar && terminarForm && (
                                    <div style={{ marginTop: 12, padding: '10px 12px', background: '#f0fdf4', border: '1px solid #BBF7D0', borderRadius: 4 }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--green)', marginBottom: 8 }}>Confirmar Conclusão</div>
                                        <div className="form-group">
                                            <label className="form-label">Data de Fim</label>
                                            <input type="date" className="form-input" value={dFi} onChange={e => setDFi(e.target.value)} />
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button type="button" className="abtn abtn-secondary" onClick={() => setTerminarForm(false)}>Cancelar</button>
                                            <button type="button" className="abtn abtn-primary" style={{ background: 'var(--green)', borderColor: 'var(--green)' }} onClick={() => onTerminar?.(dFi || today())}>Confirmar Conclusão</button>
                                        </div>
                                    </div>
                                )}

                                {/* Encerrar */}
                                {canEncerrar && !encerrarForm && (
                                    <div style={{ marginTop: 12 }}>
                                        <button type="button" className="abtn abtn-secondary" onClick={() => { setDEn(today()); setEncerrarForm(true); setTab('gestao'); }}>
                                            <Archive size={13} /> Encerrar
                                        </button>
                                    </div>
                                )}
                                {canEncerrar && encerrarForm && (
                                    <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4 }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 8 }}>Confirmar Encerramento</div>
                                        <div className="form-group">
                                            <label className="form-label">Data de Encerramento</label>
                                            <input type="date" className="form-input" value={dEn} onChange={e => setDEn(e.target.value)} />
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button type="button" className="abtn abtn-secondary" onClick={() => setEncerrarForm(false)}>Cancelar</button>
                                            <button type="button" className="abtn abtn-primary" onClick={() => onEncerrar?.(dEn || today())}>Confirmar Encerramento</button>
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
                            <button type="button" className="abtn abtn-secondary" onClick={handlePrint}><Printer size={12} /> Imprimir</button>
                        )}
                        {!readOnly && <button type="submit" className="abtn abtn-primary"><Check size={12} /> OK</button>}
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ══ Main Page ═══════════════════════════════════════════ */
const OrdensPage: React.FC = () => {
    const { ordens, addOrdem, updateOrdem, emitirOT, terminarOT, encerrarOT, equipInstalados, clientes, modelosEquipamento, currentUser, tiposOT } = useGlobal();
    const isTecnicoCampo = currentUser?.role === 'Técnico de Campo';

    const [search, setSearch]         = useState('');
    const [filterEstado, setFiltEst]  = useState('');
    const [filterTipo, setFiltTipo]   = useState('');
    const [modal, setModal]           = useState<'new' | string | null>(null);
    const [toast,      setToast]      = useState('');
    const [showExport, setShowExport] = useState(false);
    const [ctx, setCtx]               = useState<{ id: string; x: number; y: number } | null>(null);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

    const getLabel = (ot: OrdemTrabalho) => {
        const eq  = equipInstalados.find(e => e.id === ot.equipInstaladoId);
        const mod = modelosEquipamento.find(m => m.id === eq?.modeloId)?.nome ?? '—';
        const cli = clientes.find(c => c.id === ot.clienteId)?.nome ?? '—';
        return { equip: `${ot.equipInstaladoId} — ${mod}`, cliente: cli };
    };

    const filtered = useMemo(() => ordens.filter(o => {
        const q = search.toLowerCase();
        const { equip, cliente } = getLabel(o);
        return (!q || o.id.toLowerCase().includes(q) || equip.toLowerCase().includes(q) || cliente.toLowerCase().includes(q) || o.descricao.toLowerCase().includes(q))
            && (!filterEstado || o.estado === filterEstado)
            && (!filterTipo   || o.tipoOT === filterTipo)
            && (!isTecnicoCampo || o.responsavel === (currentUser?.tecnicoNome ?? currentUser?.nome));
    }), [ordens, search, filterEstado, filterTipo, isTecnicoCampo, currentUser]);

    // Base scoped to current user (ignores search/estado/tipo filters, but respects role)
    const baseOrdens = useMemo(() =>
        isTecnicoCampo ? ordens.filter(o => o.responsavel === (currentUser?.tecnicoNome ?? currentUser?.nome)) : ordens,
    [ordens, isTecnicoCampo, currentUser]);

    const stats = useMemo(() => ({
        programados: baseOrdens.filter(o => o.estado === 'Programado').length,
        emCurso:     baseOrdens.filter(o => o.estado === 'Em curso').length,
        terminados:  baseOrdens.filter(o => o.estado === 'Terminado').length,
        encerrados:  baseOrdens.filter(o => o.estado === 'Encerrado').length,
    }), [baseOrdens]);

    const exportData = filtered.map(o => {
        const { equip, cliente } = getLabel(o);
        return { ...o, equipamento: equip, clienteNome: cliente, dataProgInicio: fmtDate(o.dataProgInicio) };
    });

    const editOT = typeof modal === 'string' && modal !== 'new' ? ordens.find(o => o.id === modal) : undefined;

    const handleSave = (data: Omit<OrdemTrabalho, 'id'>) => {
        if (typeof modal === 'string' && modal !== 'new') {
            updateOrdem(modal, data);
            showToast('OT actualizada.');
        } else {
            const ot = addOrdem(data);
            showToast(`${ot.id} criada.`);
        }
        setModal(null);
    };

    const handleEmitir = (id: string) => { emitirOT(id); setModal(null); showToast(`OT ${id} emitida — Em curso.`); };
    const handleTerminar = (id: string, df: string) => { terminarOT(id, df); setModal(null); showToast(`OT ${id} terminada. Nova OT gerada se periódica.`); };
    const handleEncerrar = (id: string, de: string) => { encerrarOT(id, de); setModal(null); showToast(`OT ${id} encerrada.`); };

    const PROX_ESTADO: Record<OTEstado, string> = { 'Programado': 'Emitir → Em curso', 'Em curso': 'Terminar', 'Terminado': 'Encerrar', 'Encerrado': '—' };
    const PREV_ESTADO: Partial<Record<OTEstado, OTEstado>> = { 'Em curso': 'Programado', 'Terminado': 'Em curso', 'Encerrado': 'Terminado' };
    const handleProxEstado = (ot: OrdemTrabalho) => {
        if (ot.estado === 'Programado') handleEmitir(ot.id);
        else if (ot.estado === 'Em curso') handleTerminar(ot.id, today());
        else if (ot.estado === 'Terminado') handleEncerrar(ot.id, today());
        setCtx(null);
    };
    const handleReverter = (ot: OrdemTrabalho) => {
        const prev = PREV_ESTADO[ot.estado];
        if (prev) { updateOrdem(ot.id, { estado: prev }); showToast(`OT ${ot.id} revertida → ${prev}.`); }
        setCtx(null);
    };

    return (
        <AppLayout>
            <ActionBar title="Ordens de Trabalho" breadcrumb="AQUATEX SGI · Ordens">
                <div className="actionbar-spacer" />
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
                        <option value="">Todos os tipos</option>
                        {tiposOT.map(t => <option key={t.id} value={t.descricao}>{t.descricao}</option>)}
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
                                    <th>Tipo</th>
                                    <th>Equipamento</th>
                                    <th>Cliente</th>
                                    <th>Responsável</th>
                                    <th>D.Prog.Início</th>
                                    <th>D.Prog.Fim</th>
                                    <th>Emitida</th>
                                    <th>Início</th>
                                    <th>Fim</th>
                                    <th>Encerramento</th>
                                    <th>Estado</th>
                                    <th style={{ width: 50 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr><td colSpan={14}><div className="empty-state">Nenhuma OT encontrada.</div></td></tr>
                                )}
                                {filtered.map(o => {
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
                                            <td>{o.tipoOT ? <span className="tbadge tbadge-suporte">{o.tipoOT}</span> : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{equip}</td>
                                            <td style={{ fontSize: '0.8rem', fontWeight: 600 }}>{cliente}</td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{o.responsavel}</td>
                                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmtDate(o.dataProgInicio) || '—'}</td>
                                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmtDate(o.dataProgFim)    || '—'}</td>
                                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmtDate(o.dataEmissao)    || '—'}</td>
                                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmtDate(o.dataInicio)     || '—'}</td>
                                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmtDate(o.dataFim)        || '—'}</td>
                                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmtDate(o.dataEncerramento) || '—'}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem' }}>
                                                    <span className={`dot ${cfg.dot}`} />
                                                    {cfg.label}
                                                </div>
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
                            { label: '⎙ Imprimir', action: () => { printOT(ot, equipInstalados, modelosEquipamento, clientes); setCtx(null); } },
                            ...(ot.estado !== 'Encerrado' ? [{ label: `→ ${PROX_ESTADO[ot.estado]}`, action: () => handleProxEstado(ot) }] : []),
                            ...(!isTecnicoCampo && PREV_ESTADO[ot.estado] ? [{ label: `↩ Reverter → ${PREV_ESTADO[ot.estado]}`, action: () => handleReverter(ot) }] : []),
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
                    onEmitir={editOT ? () => handleEmitir(editOT.id) : undefined}
                    onTerminar={editOT ? (df) => handleTerminar(editOT.id, df) : undefined}
                    onEncerrar={editOT ? (de) => handleEncerrar(editOT.id, de) : undefined}
                    readOnly={isTecnicoCampo && !!editOT}
                />
            )}

            {showExport && (
                <ExportModal
                    title="Ordens de Trabalho"
                    columns={COLS_OT}
                    data={exportData}
                    filename="ordens_trabalho"
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

export default OrdensPage;
