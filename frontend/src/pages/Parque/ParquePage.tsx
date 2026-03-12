import React, { useState, useMemo } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import SearchableSelect from '../../components/SearchableSelect';
import ExportModal, { ExportCol } from '../../components/ExportModal';
import {
    useGlobal, EquipInstalado, EstadoEquip, ModeloEquipamento, Cliente,
} from '../../contexts/GlobalContext';
import {
    Search, Plus, Edit2, X, AlertCircle, Check, MapPin,
    Eye, AlertTriangle, RefreshCw, Package, Printer, Download,
} from 'lucide-react';

const ESTADO_DOT: Record<EstadoEquip, string> = {
    ativo:         'dot-green',
    com_problema:  'dot-orange',
    inativo:       'dot-gray',
};
const ESTADO_LABEL: Record<EstadoEquip, string> = {
    ativo:        'Activo',
    com_problema: 'Com Problema',
    inativo:      'Inactivo',
};

const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('pt-PT') : '—';
const diffDays = (d?: string) => {
    if (!d) return null;
    return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
};

/** Gera número de série único: AQ-{TYPE}-{YEAR}{HEX4} */
const genSerialNumber = (modelo?: ModeloEquipamento): string => {
    const type = modelo?.tipo === 'maquina' ? 'M' : 'F';
    const year  = new Date().getFullYear().toString().slice(2);
    const hex   = Math.random().toString(16).slice(2, 6).toUpperCase();
    return `AQ-${type}${year}-${hex}`;
};

/* ── Equipment print helper ── */
function printEquip(
    eq: EquipInstalado,
    clientes: Cliente[],
    modelosEquipamento: ModeloEquipamento[],
) {
    const cli = clientes.find(c => c.id === eq.clienteId);
    const mod = modelosEquipamento.find(m => m.id === eq.modeloId);

    const w = window.open('', '_blank', 'width=820,height=900');
    if (!w) return;
    w.document.write(`<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>Ficha Equip. ${eq.id}</title>
<style>
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
  body   { font-family: Arial, sans-serif; font-size: 12px; padding: 15mm 20mm; color: #1a1a1a; }
  h1     { font-size: 1rem; margin: 0; }
  .sub   { font-size: 0.7rem; color: #888; margin: 2px 0 16px; }
  .hrow  { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
  .badge { display: inline-block; padding: 3px 12px; border-radius: 12px; font-size: 0.7rem; font-weight: 700; border: 1.5px solid #555; color: #333; background: #f5f5f5; }
  .sec   { font-size: 0.82rem; font-weight: 700; color: #2B2B2B; border-bottom: 1.5px solid #2B2B2B; padding-bottom: 3px; margin: 16px 0 5px; }
  table  { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  thead tr { background: #2B2B2B; }
  th     { background: #2B2B2B; color: #fff; padding: 6px 9px; font-size: 0.72rem; font-weight: 700; border: 1px solid #444; text-align: left; }
  td     { padding: 5px 9px; border: 1px solid #ddd; font-size: 0.78rem; vertical-align: top; }
  .lbl   { width: 35%; background: #f5f5f5; font-weight: 600; color: #444; }
  tr:nth-child(even) td { background: #f9f9f9; }
  tr:nth-child(odd)  td { background: #fff; }
  td.lbl { background: #f5f5f5 !important; }
  .footer { margin-top: 20px; font-size: 0.65rem; color: #bbb; text-align: center; border-top: 1px solid #eee; padding-top: 6px; }
  @page { size: A4; margin: 0; }
</style></head><body>
<div class="hrow">
  <div>
    <h1>AQUATEX — Ficha de Equipamento</h1>
    <div class="sub">Nº: <strong>${eq.id}</strong> &nbsp;|&nbsp; Impresso em ${new Date().toLocaleString('pt-PT')}</div>
  </div>
  <span class="badge">${eq.estado === 'ativo' ? 'Activo' : eq.estado === 'com_problema' ? 'Com Problema' : 'Inactivo'}</span>
</div>

<div class="sec">Identificação</div>
<table>
  <tr><td class="lbl">Equipamento ID</td><td>${eq.id}</td><td class="lbl">Nº de Série</td><td><span style="font-family:monospace">${eq.nrSerie}</span></td></tr>
  <tr><td class="lbl">Modelo</td><td>${mod?.nome ?? '—'}</td><td class="lbl">Marca</td><td>${mod?.marca ?? '—'}</td></tr>
  <tr><td class="lbl">Tipo</td><td>${mod?.tipo === 'maquina' ? 'Máquina' : 'Filtro'}</td><td class="lbl">Cliente</td><td>${cli?.nome ?? '—'}</td></tr>
  <tr><td class="lbl">Localização</td><td colspan="3">${eq.localizacao ?? '—'}</td></tr>
</table>

<div class="sec">Datas de Manutenção</div>
<table>
  <tr><td class="lbl">Data de Instalação</td><td>${eq.dataInstalacao ? new Date(eq.dataInstalacao).toLocaleDateString('pt-PT') : '—'}</td></tr>
  <tr><td class="lbl">Última Manutenção</td><td>${eq.dataUltimaManutencao ? new Date(eq.dataUltimaManutencao).toLocaleDateString('pt-PT') : '—'}</td></tr>
  <tr><td class="lbl">Próxima Manutenção</td><td>${eq.dataProximaManutencao ? new Date(eq.dataProximaManutencao).toLocaleDateString('pt-PT') : '—'}</td></tr>
</table>

<div class="footer">AQUATEX, LDA &nbsp;&bull;&nbsp; Sistema de Gestão de Intervenções</div>
</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
}

/* ══ Modelo Modal ════════════════════════════════════════ */
interface ModeloModalProps {
    modelo?: ModeloEquipamento;
    onClose: () => void;
    onSave: (m: Omit<ModeloEquipamento, 'id'>) => void;
}
const ModeloModal: React.FC<ModeloModalProps> = ({ modelo, onClose, onSave }) => {
    const [nome, setNome]   = useState(modelo?.nome  ?? '');
    const [marca, setMarca] = useState(modelo?.marca ?? '');
    const [tipo, setTipo]   = useState<'maquina' | 'filtro'>(modelo?.tipo ?? 'maquina');
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const e: Record<string, string> = {};
        if (!nome.trim())  e.nome  = 'Obrigatório';
        if (!marca.trim()) e.marca = 'Obrigatório';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSave = (ev: React.FormEvent) => {
        ev.preventDefault();
        if (!validate()) return;
        onSave({ nome, marca, tipo });
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 460 }}>
                <div className="modal-header">
                    <h3 className="modal-title">{modelo ? 'Editar Modelo' : 'Novo Modelo de Equipamento'}</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <form onSubmit={handleSave} noValidate>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label req">Nome / Designação</label>
                            <input className={`form-input${errors.nome ? ' err' : ''}`} value={nome}
                                onChange={e => setNome(e.target.value)} placeholder="Ex: Osmose Inversa Industrial 500L/h" />
                            {errors.nome && <span className="form-error"><AlertCircle size={11} /> {errors.nome}</span>}
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label req">Marca / Fabricante</label>
                                <input className={`form-input${errors.marca ? ' err' : ''}`} value={marca}
                                    onChange={e => setMarca(e.target.value)} placeholder="Ex: Aquatex" />
                                {errors.marca && <span className="form-error"><AlertCircle size={11} /> {errors.marca}</span>}
                            </div>
                            <div className="form-group">
                                <label className="form-label req">Tipo</label>
                                <select className="form-select" value={tipo} onChange={e => setTipo(e.target.value as 'maquina' | 'filtro')}>
                                    <option value="maquina">Máquina</option>
                                    <option value="filtro">Filtro</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="abtn abtn-primary"><Check size={12} /> Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ══ Register Modal ══════════════════════════════════════ */
interface RegisterModalProps {
    equip?: EquipInstalado;
    onClose: () => void;
    onSave: (e: Omit<EquipInstalado, 'id'>) => void;
}
const RegisterModal: React.FC<RegisterModalProps> = ({ equip, onClose, onSave }) => {
    const { clientes, modelosEquipamento } = useGlobal();

    const [clienteId, setClienteId]     = useState(equip?.clienteId ?? '');
    const [modeloId, setModeloId]       = useState(equip?.modeloId  ?? '');
    const [nrSerie, setNrSerie]         = useState(equip?.nrSerie   ?? '');
    const [localizacao, setLocalizacao] = useState(equip?.localizacao ?? '');
    const [dataInst, setDataInst]       = useState(equip?.dataInstalacao ?? '');
    const [estado, setEstado]           = useState<EstadoEquip>(equip?.estado ?? 'ativo');
    const [errors, setErrors]           = useState<Record<string, string>>({});

    const clienteOpts = clientes.filter(c => c.ativo).map(c => ({ value: c.id, label: c.nome, sub: `NIF: ${c.nif}` }));
    const modeloOpts  = modelosEquipamento.map(m => ({ value: m.id, label: m.nome, sub: `${m.marca} · ${m.tipo === 'maquina' ? 'Máquina' : 'Filtro'}` }));

    const handleGerarSerie = () => {
        const mod = modelosEquipamento.find(m => m.id === modeloId);
        setNrSerie(genSerialNumber(mod));
    };

    const validate = () => {
        const e: Record<string, string> = {};
        if (!clienteId) e.cliente = 'Obrigatório';
        if (!modeloId)  e.modelo  = 'Obrigatório';
        if (!nrSerie.trim()) e.serie = 'Obrigatório';
        if (!dataInst)  e.data   = 'Obrigatório';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSave = (ev: React.FormEvent) => {
        ev.preventDefault();
        if (!validate()) return;
        onSave({ clienteId, modeloId, nrSerie, localizacao, dataInstalacao: dataInst, estado });
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 540 }}>
                <div className="modal-header">
                    <h3 className="modal-title">{equip ? 'Editar Equipamento' : 'Registar Equipamento'}</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <form onSubmit={handleSave} noValidate>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label req">Cliente</label>
                            <SearchableSelect options={clienteOpts} value={clienteId} onChange={setClienteId}
                                placeholder="Seleccionar cliente..." />
                            {errors.cliente && <span className="form-error"><AlertCircle size={11} /> {errors.cliente}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-label req">Modelo do Equipamento</label>
                            <SearchableSelect options={modeloOpts} value={modeloId} onChange={setModeloId}
                                placeholder="Seleccionar modelo..." />
                            {errors.modelo && <span className="form-error"><AlertCircle size={11} /> {errors.modelo}</span>}
                        </div>
                        <div className="form-row">
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label req">Nº de Série</label>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <input className={`form-input${errors.serie ? ' err' : ''}`} value={nrSerie}
                                        onChange={e => setNrSerie(e.target.value)} placeholder="Ex: AQ-M26-A3F2"
                                        style={{ fontFamily: 'monospace', flex: 1 }} />
                                    <button type="button" className="abtn abtn-secondary" title="Gerar número de série automático"
                                        onClick={handleGerarSerie} style={{ flexShrink: 0, padding: '0 10px' }}>
                                        <RefreshCw size={12} />
                                    </button>
                                </div>
                                {errors.serie && <span className="form-error"><AlertCircle size={11} /> {errors.serie}</span>}
                            </div>
                            <div className="form-group">
                                <label className="form-label req">Data de Instalação</label>
                                <input type="date" className={`form-input${errors.data ? ' err' : ''}`} value={dataInst}
                                    onChange={e => setDataInst(e.target.value)} />
                                {errors.data && <span className="form-error"><AlertCircle size={11} /> {errors.data}</span>}
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Localização</label>
                                <input className="form-input" value={localizacao}
                                    onChange={e => setLocalizacao(e.target.value)} placeholder="Ex: Cozinha Industrial" />
                            </div>
                            {equip && (
                                <div className="form-group">
                                    <label className="form-label">Estado</label>
                                    <select className="form-select" value={estado} onChange={e => setEstado(e.target.value as EstadoEquip)}>
                                        <option value="ativo">Activo</option>
                                        <option value="com_problema">Com Problema</option>
                                        <option value="inativo">Inactivo</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="abtn abtn-primary"><Check size={12} /> {equip ? 'Actualizar' : 'Registar'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ══ Detalhe Modal ═══════════════════════════════════════ */
interface DetalheProps { equipId: string; onClose: () => void; onEdit: () => void; }
const EquipDetalhe: React.FC<DetalheProps> = ({ equipId, onClose, onEdit }) => {
    const { equipInstalados, clientes, modelosEquipamento, planos, ordens } = useGlobal();
    const eq   = equipInstalados.find(e => e.id === equipId)!;
    const cli  = clientes.find(c => c.id === eq.clienteId);
    const mod  = modelosEquipamento.find(m => m.id === eq.modeloId);
    const ots  = ordens.filter(o => o.equipInstaladoId === equipId);
    const pls  = planos.filter(p => p.equipInstaladoId === equipId);
    const dias = diffDays(eq.dataProximaManutencao);

    const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
        <div className="form-group">
            <label className="form-label">{label}</label>
            <div style={{ padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 3, fontSize: '0.82rem' }}>{value}</div>
        </div>
    );

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 600 }}>
                <div className="modal-header">
                    <div>
                        <h3 className="modal-title">{eq.id} — {mod?.nome}</h3>
                        <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                            <span className={`dot ${ESTADO_DOT[eq.estado]}`} />
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{ESTADO_LABEL[eq.estado]}</span>
                            <span className="tbadge tbadge-admin" style={{ marginLeft: 4 }}>{mod?.tipo === 'maquina' ? 'Máquina' : 'Filtro'}</span>
                        </div>
                    </div>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                        <InfoRow label="Cliente" value={cli?.nome ?? '—'} />
                        <InfoRow label="Nº de Série" value={<span style={{ fontFamily: 'monospace' }}>{eq.nrSerie}</span>} />
                        <InfoRow label="Data de Instalação" value={fmtDate(eq.dataInstalacao)} />
                        <InfoRow label="Localização" value={eq.localizacao || '—'} />
                        <InfoRow label="Última Manutenção" value={fmtDate(eq.dataUltimaManutencao)} />
                        <InfoRow label="Próxima Manutenção" value={
                            <span style={{ color: dias !== null && dias <= 7 ? 'var(--red)' : dias !== null && dias <= 14 ? 'var(--orange)' : undefined }}>
                                {fmtDate(eq.dataProximaManutencao)}
                                {dias !== null && <span style={{ marginLeft: 6, fontSize: '0.74rem' }}>({dias >= 0 ? `em ${dias} dias` : `atrasada ${Math.abs(dias)} dias`})</span>}
                            </span>
                        } />
                    </div>

                    {pls.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                Planos de Manutenção ({pls.length})
                            </div>
                            {pls.map(p => (
                                <div key={p.id} style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 3, marginBottom: 4, fontSize: '0.79rem', display: 'flex', justifyContent: 'space-between' }}>
                                    <span><strong>{p.id}</strong> — {p.descricao}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>{p.periodicidade}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {ots.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                Ordens de Trabalho ({ots.length})
                            </div>
                            {ots.slice(0, 5).map(o => (
                                <div key={o.id} style={{ padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 3, marginBottom: 4, fontSize: '0.79rem', display: 'flex', justifyContent: 'space-between' }}>
                                    <span><strong>{o.id}</strong> — {o.tipoTrabalho}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>{o.estado}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="abtn abtn-secondary" type="button" onClick={onClose}>Fechar</button>
                    <button className="abtn abtn-secondary" type="button" onClick={() => printEquip(eq, clientes, modelosEquipamento)}>
                        <Printer size={12} /> Imprimir
                    </button>
                    <button className="abtn abtn-secondary" type="button" onClick={onEdit}><Edit2 size={12} /> Editar</button>
                </div>
            </div>
        </div>
    );
};

/* ══ Page ════════════════════════════════════════════════ */
type PageView = 'equipamentos' | 'modelos';

const ParquePage: React.FC = () => {
    const {
        equipInstalados, addEquipInstalado, updateEquipInstalado,
        modelosEquipamento, addModelo, updateModelo,
        clientes, addOrdem,
    } = useGlobal();

    const [view, setView]         = useState<PageView>('equipamentos');

    // Equipamentos state
    const [search, setSearch]             = useState('');
    const [filterEstado, setFilterEstado] = useState('');
    const [modal, setModal]               = useState<'new' | 'edit' | null>(null);
    const [detalheId, setDetalheId]       = useState<string | null>(null);
    const [editId, setEditId]             = useState<string | null>(null);

    // Modelos state
    const [mSearch, setMSearch]     = useState('');
    const [mModal, setMModal]       = useState<'new' | string | null>(null);

    const [showExport, setShowExport] = useState(false);
    const [toast, setToast] = useState('');
    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

    const getCliente = (id: string) => clientes.find(c => c.id === id)?.nome ?? '—';
    const getModelo  = (id: string) => modelosEquipamento.find(m => m.id === id);

    /* ── Equipamentos ── */
    const filtered = equipInstalados.filter(e => {
        const q  = search.toLowerCase();
        const cl = getCliente(e.clienteId).toLowerCase();
        const mo = getModelo(e.modeloId)?.nome.toLowerCase() ?? '';
        return (!q || cl.includes(q) || mo.includes(q) || e.nrSerie.toLowerCase().includes(q))
            && (!filterEstado || e.estado === filterEstado);
    });

    const ativos    = equipInstalados.filter(e => e.estado === 'ativo').length;
    const problemas = equipInstalados.filter(e => e.estado === 'com_problema').length;
    const urgentes  = equipInstalados.filter(e => { const d = diffDays(e.dataProximaManutencao); return d !== null && d <= 7; }).length;

    const handleSaveEquip = (data: Omit<EquipInstalado, 'id'>) => {
        if (modal === 'edit' && editId) {
            updateEquipInstalado(editId, data);
            showToast('Equipamento actualizado.');
        } else {
            const eq = addEquipInstalado(data);
            const mod = modelosEquipamento.find(m => m.id === data.modeloId);
            addOrdem({
                id: '', tipo: 'pontual', equipInstaladoId: eq.id, clienteId: data.clienteId,
                descricao: `Montagem e comissionamento — ${mod?.nome ?? 'equipamento'}`,
                previsaoTempo: 4, tipoTrabalho: 'Montagem / Instalação', responsavel: '—',
                maosDeObra: [], artigos: [],
                dataProgInicio: data.dataInstalacao, dataProgFim: data.dataInstalacao,
                estado: 'Programado',
            } as any);
            showToast(`${eq.id} registado. OT de Montagem criada automaticamente.`);
        }
        setModal(null); setEditId(null);
    };

    /* ── Modelos ── */
    const filteredModelos = modelosEquipamento.filter(m => {
        const q = mSearch.toLowerCase();
        return !q || m.nome.toLowerCase().includes(q) || m.marca.toLowerCase().includes(q);
    });

    const editModelo = typeof mModal === 'string' && mModal !== 'new'
        ? modelosEquipamento.find(m => m.id === mModal)
        : undefined;

    /* ── Export ── */
    const COLS_EQUIP: ExportCol[] = [
        { key: 'id',          label: 'ID'               },
        { key: 'clienteNome', label: 'Cliente'          },
        { key: 'modeloNome',  label: 'Modelo'           },
        { key: 'tipo',        label: 'Tipo'             },
        { key: 'nrSerie',     label: 'Nº Série'        },
        { key: 'dataInst',    label: 'Data Instalação'  },
        { key: 'proxManut',   label: 'Próx. Manutenção' },
        { key: 'estado',      label: 'Estado'           },
    ];
    const COLS_MODELOS: ExportCol[] = [
        { key: 'id',    label: 'ID'           },
        { key: 'nome',  label: 'Nome'         },
        { key: 'marca', label: 'Marca'        },
        { key: 'tipo',  label: 'Tipo'         },
        { key: 'count', label: 'Equipamentos' },
    ];
    const exportDataEquip = filtered.map(e => ({
        id:          e.id,
        clienteNome: getCliente(e.clienteId),
        modeloNome:  getModelo(e.modeloId)?.nome ?? '—',
        tipo:        getModelo(e.modeloId)?.tipo === 'maquina' ? 'Máquina' : 'Filtro',
        nrSerie:     e.nrSerie,
        dataInst:    e.dataInstalacao ?? '—',
        proxManut:   e.dataProximaManutencao ?? '—',
        estado:      ESTADO_LABEL[e.estado],
    }));
    const exportDataModelos = filteredModelos.map(m => ({
        id:    m.id,
        nome:  m.nome,
        marca: m.marca,
        tipo:  m.tipo === 'maquina' ? 'Máquina' : 'Filtro',
        count: equipInstalados.filter(e => e.modeloId === m.id).length,
    }));

    const handleSaveModelo = (data: Omit<ModeloEquipamento, 'id'>) => {
        if (typeof mModal === 'string' && mModal !== 'new') {
            updateModelo(mModal, data);
            showToast('Modelo actualizado.');
        } else {
            const m = addModelo(data);
            showToast(`Modelo ${m.id} criado.`);
        }
        setMModal(null);
    };

    const editEquip = equipInstalados.find(e => e.id === editId);

    /* ── View Tabs ── */
    const tabStyle = (active: boolean): React.CSSProperties => ({
        padding: '6px 16px', fontSize: '0.82rem', fontWeight: active ? 700 : 400,
        borderBottom: active ? '2px solid var(--blue)' : '2px solid transparent',
        color: active ? 'var(--blue)' : 'var(--text-secondary)',
        background: 'none', border: 'none', cursor: 'pointer',
        borderBottomWidth: 2, borderBottomStyle: 'solid',
        borderBottomColor: active ? 'var(--blue)' : 'transparent',
    });

    return (
        <AppLayout>
            <ActionBar title="Parque de Equipamentos" breadcrumb="AQUATEX SGI · Parque">
                <div className="actionbar-spacer" />
                <button className="abtn abtn-secondary" type="button" onClick={() => setShowExport(true)}>
                    <Download size={13} /> Exportar
                </button>
                {view === 'equipamentos' ? (
                    <button className="abtn abtn-primary" type="button" onClick={() => setModal('new')}>
                        <Plus size={13} /> Registar Equipamento
                    </button>
                ) : (
                    <button className="abtn abtn-primary" type="button" onClick={() => setMModal('new')}>
                        <Plus size={13} /> Novo Modelo
                    </button>
                )}
            </ActionBar>

            <div className="page-content">
                {/* View toggle */}
                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
                    <button style={tabStyle(view === 'equipamentos')} onClick={() => setView('equipamentos')}>
                        <MapPin size={12} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                        Equipamentos Instalados
                    </button>
                    <button style={tabStyle(view === 'modelos')} onClick={() => setView('modelos')}>
                        <Package size={12} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                        Modelos de Equipamento
                    </button>
                </div>

                {/* ── Equipamentos View ── */}
                {view === 'equipamentos' && (
                    <>
                        <div className="stats-row">
                            {[
                                { label: 'Activos',           value: ativos,                 cls: 'green'  },
                                { label: 'Com Problema',       value: problemas,              cls: 'orange' },
                                { label: 'Total',              value: equipInstalados.length, cls: ''       },
                                { label: 'Manutenção Urgente', value: urgentes,               cls: urgentes > 0 ? 'red' : '' },
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
                                <input className="search-input" placeholder="Pesquisar por cliente, modelo ou nº série..."
                                    value={search} onChange={e => setSearch(e.target.value)} />
                            </div>
                            <select className="filter-select" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
                                <option value="">Todos os estados</option>
                                <option value="ativo">Activo</option>
                                <option value="com_problema">Com Problema</option>
                                <option value="inativo">Inactivo</option>
                            </select>
                        </div>

                        <div className="table-container">
                            <div className="table-scroll">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 20 }} />
                                            <th>ID</th>
                                            <th>Cliente</th>
                                            <th>Modelo</th>
                                            <th>Tipo</th>
                                            <th>Nº Série</th>
                                            <th>Localização</th>
                                            <th>Inst.</th>
                                            <th>Próx. Manutenção</th>
                                            <th style={{ width: 70 }} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.length === 0 && (
                                            <tr><td colSpan={10}><div className="empty-state"><MapPin size={28} /><br />Nenhum equipamento encontrado.</div></td></tr>
                                        )}
                                        {filtered.map(e => {
                                            const mod  = getModelo(e.modeloId);
                                            const dias = diffDays(e.dataProximaManutencao);
                                            const urgente = dias !== null && dias <= 7;
                                            const proximo = dias !== null && dias > 7 && dias <= 14;
                                            return (
                                                <tr key={e.id}>
                                                    <td style={{ paddingLeft: 10 }}><span className={`dot ${ESTADO_DOT[e.estado]}`} /></td>
                                                    <td><span className="td-link" onClick={() => setDetalheId(e.id)}>{e.id}</span></td>
                                                    <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{getCliente(e.clienteId)}</td>
                                                    <td style={{ fontSize: '0.8rem' }}>{mod?.nome ?? '—'}</td>
                                                    <td><span className={mod?.tipo === 'maquina' ? 'tbadge tbadge-admin' : 'tbadge tbadge-suporte'}>{mod?.tipo === 'maquina' ? 'Máquina' : 'Filtro'}</span></td>
                                                    <td style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{e.nrSerie}</td>
                                                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{e.localizacao || '—'}</td>
                                                    <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{fmtDate(e.dataInstalacao)}</td>
                                                    <td style={{ fontSize: '0.76rem' }}>
                                                        {e.dataProximaManutencao ? (
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: urgente ? 'var(--red)' : proximo ? 'var(--orange)' : undefined }}>
                                                                {urgente && <AlertTriangle size={11} />}
                                                                {fmtDate(e.dataProximaManutencao)}
                                                                {dias !== null && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({dias >= 0 ? `+${dias}d` : `${dias}d`})</span>}
                                                            </span>
                                                        ) : '—'}
                                                    </td>
                                                    <td>
                                                        <div className="row-actions">
                                                            <button className="icon-btn" title="Detalhe" onClick={() => setDetalheId(e.id)}><Eye size={12} /></button>
                                                            <button className="icon-btn" title="Editar" onClick={() => { setEditId(e.id); setModal('edit'); }}><Edit2 size={12} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="table-count">{filtered.length} equipamentos</div>
                        </div>
                    </>
                )}

                {/* ── Modelos View ── */}
                {view === 'modelos' && (
                    <>
                        <div className="filters-bar">
                            <div className="search-wrap">
                                <Search className="search-icon" />
                                <input className="search-input" placeholder="Pesquisar por nome ou marca..."
                                    value={mSearch} onChange={e => setMSearch(e.target.value)} />
                            </div>
                        </div>

                        <div className="table-container">
                            <div className="table-scroll">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Nome / Designação</th>
                                            <th>Marca</th>
                                            <th>Tipo</th>
                                            <th>Equipamentos</th>
                                            <th style={{ width: 60 }} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredModelos.length === 0 && (
                                            <tr><td colSpan={6}><div className="empty-state"><Package size={28} /><br />Nenhum modelo registado.</div></td></tr>
                                        )}
                                        {filteredModelos.map(m => {
                                            const count = equipInstalados.filter(e => e.modeloId === m.id).length;
                                            return (
                                                <tr key={m.id}>
                                                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{m.id}</td>
                                                    <td style={{ fontWeight: 600, fontSize: '0.83rem' }}>{m.nome}</td>
                                                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{m.marca}</td>
                                                    <td>
                                                        <span className={m.tipo === 'maquina' ? 'tbadge tbadge-admin' : 'tbadge tbadge-suporte'}>
                                                            {m.tipo === 'maquina' ? 'Máquina' : 'Filtro'}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontSize: '0.8rem', color: count > 0 ? 'var(--blue)' : 'var(--text-muted)', fontWeight: count > 0 ? 700 : 400 }}>{count}</td>
                                                    <td>
                                                        <div className="row-actions">
                                                            <button className="icon-btn" title="Editar" onClick={() => setMModal(m.id)}><Edit2 size={12} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="table-count">{filteredModelos.length} modelos</div>
                        </div>
                    </>
                )}
            </div>

            {/* Equip modals */}
            {(modal === 'new' || modal === 'edit') && (
                <RegisterModal
                    equip={modal === 'edit' ? editEquip : undefined}
                    onClose={() => { setModal(null); setEditId(null); }}
                    onSave={handleSaveEquip}
                />
            )}
            {detalheId && (
                <EquipDetalhe
                    equipId={detalheId}
                    onClose={() => setDetalheId(null)}
                    onEdit={() => { setEditId(detalheId); setModal('edit'); setDetalheId(null); }}
                />
            )}

            {/* Modelo modals */}
            {mModal !== null && (
                <ModeloModal
                    modelo={editModelo}
                    onClose={() => setMModal(null)}
                    onSave={handleSaveModelo}
                />
            )}

            {showExport && (
                <ExportModal
                    title={view === 'equipamentos' ? 'Equipamentos Instalados' : 'Modelos de Equipamento'}
                    columns={view === 'equipamentos' ? COLS_EQUIP : COLS_MODELOS}
                    data={view === 'equipamentos' ? exportDataEquip : exportDataModelos}
                    filename={view === 'equipamentos' ? 'parque_equipamentos' : 'parque_modelos'}
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

export default ParquePage;
