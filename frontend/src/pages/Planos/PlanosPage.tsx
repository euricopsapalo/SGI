import React, { useState } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import { showToast as notify } from '../../utils/errorHandler';
import ActionBar from '../../components/Layout/ActionBar';
import SearchableSelect from '../../components/SearchableSelect';
import ExportModal, { ExportCol } from '../../components/ExportModal';
import {
    useGlobal, PlanoManutencao, PlanoMaoObra, PlanoArtigo,
} from '../../contexts/GlobalContext';
import {
    Search, Plus, Edit2, X, AlertCircle, Check, ClipboardList,
    Trash2, Copy, Download,
} from 'lucide-react';

const PERIOD_OPTIONS = ['Mensal', 'Trimestral', 'Semestral', 'Anual', 'Única'];

/* ══ Plan Modal ══════════════════════════════════════════ */
interface PlanoModalProps {
    plano?: PlanoManutencao;
    onClose: () => void;
    onSave: (p: Omit<PlanoManutencao, 'id'>) => void;
}
const PlanoModal: React.FC<PlanoModalProps> = ({ plano, onClose, onSave }) => {
    const { equipInstalados, clientes, modelosEquipamento, tiposTrabalho, funcoesTecnico, artigos } = useGlobal();

    const [equipId, setEquipId]     = useState(plano?.equipInstaladoId ?? '');
    const [descricao, setDescricao] = useState(plano?.descricao ?? '');
    const [tipoId, setTipoId]       = useState(plano?.tipoTrabalhoId ?? '');
    const [periodo, setPeriodo]     = useState(plano?.periodicidade ?? 'Mensal');
    const [tempo, setTempo]             = useState(String(plano?.previsaoTempo ?? ''));
    const [maos, setMaos]               = useState<PlanoMaoObra[]>(plano?.maosDeObra ?? []);
    const [arts, setArts]               = useState<PlanoArtigo[]>(plano?.artigos ?? []);
    const [errors, setErrors]           = useState<Record<string, string>>({});

    const equipOpts = equipInstalados.map(e => {
        const cli = clientes.find(c => c.id === e.clienteId)?.nome ?? '—';
        const mod = modelosEquipamento.find(m => m.id === e.modeloId)?.nome ?? '—';
        return { value: e.id, label: `${e.id} — ${mod}`, sub: `Cliente: ${cli} · ${e.nrSerie}` };
    });
    const artigoOpts = artigos.filter(a => !a.inativo).map(a => ({
        value: a.id, label: a.descricao, sub: `${a.codigo} · ${a.existencia} em stock · ${a.precoUnitario.toLocaleString('pt-PT')} Kz`,
    }));

    const validate = () => {
        const e: Record<string, string> = {};
        if (!equipId)         e.equip   = 'Obrigatório';
        if (!descricao.trim()) e.desc   = 'Obrigatório';
        if (!tipoId)          e.tipo    = 'Obrigatório';
        if (!tempo || isNaN(Number(tempo))) e.tempo = 'Inválido';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSave = (ev: React.FormEvent) => {
        ev.preventDefault();
        if (!validate()) return;
        onSave({ equipInstaladoId: equipId, descricao, tipoTrabalhoId: tipoId, periodicidade: periodo, previsaoTempo: Number(tempo), maosDeObra: maos, artigos: arts, ativo: true });
    };

    // Mão de obra
    const addMao = () => setMaos(p => [...p, { funcaoId: '', custo: 0 }]);
    const removeMao = (i: number) => setMaos(p => p.filter((_, idx) => idx !== i));
    const updateMao = (i: number, funcaoId: string) => {
        const f = funcoesTecnico.find(x => x.id === funcaoId);
        setMaos(p => p.map((m, idx) => idx !== i ? m : { funcaoId, custo: f?.custo ?? 0 }));
    };

    // Artigos
    const addArt = () => setArts(p => [...p, { artigoId: '', quantidade: 1, preco: 0 }]);
    const removeArt = (i: number) => setArts(p => p.filter((_, idx) => idx !== i));
    const updateArtId = (i: number, artigoId: string) => {
        const a = artigos.find(x => x.id === artigoId);
        setArts(p => p.map((x, idx) => idx !== i ? x : { ...x, artigoId, preco: a?.precoUnitario ?? 0 }));
    };
    const updateArtQtd = (i: number, q: string) =>
        setArts(p => p.map((x, idx) => idx !== i ? x : { ...x, quantidade: Math.max(1, Number(q) || 1) }));

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 620 }}>
                <div className="modal-header">
                    <h3 className="modal-title">{plano ? 'Editar Plano' : 'Novo Plano de Manutenção'}</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <form onSubmit={handleSave} noValidate>
                    <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                        {/* Informação Geral */}
                        <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Informação Geral
                        </div>
                        <div className="form-group">
                            <label className="form-label req">Equipamento</label>
                            <SearchableSelect options={equipOpts} value={equipId} onChange={setEquipId} placeholder="Seleccionar equipamento..." />
                            {errors.equip && <span className="form-error"><AlertCircle size={11} /> {errors.equip}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-label req">Descrição do Plano</label>
                            <input className={`form-input${errors.desc ? ' err' : ''}`} value={descricao}
                                onChange={e => setDescricao(e.target.value)} placeholder="Ex: Manutenção Preventiva Mensal" />
                            {errors.desc && <span className="form-error"><AlertCircle size={11} /> {errors.desc}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-label req">Tipo de Trabalho</label>
                            <select className={`form-select${errors.tipo ? ' err' : ''}`} value={tipoId}
                                onChange={e => setTipoId(e.target.value)}>
                                <option value="">Seleccionar...</option>
                                {tiposTrabalho.map(t => <option key={t.id} value={t.id}>{t.descricao}</option>)}
                            </select>
                            {errors.tipo && <span className="form-error"><AlertCircle size={11} /> {errors.tipo}</span>}
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Periodicidade</label>
                                <select className="form-select" value={periodo} onChange={e => setPeriodo(e.target.value)}>
                                    {PERIOD_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label req">Previsão Tempo (h)</label>
                                <input type="number" min={0.5} step={0.5} className={`form-input${errors.tempo ? ' err' : ''}`}
                                    value={tempo} onChange={e => setTempo(e.target.value)} />
                                {errors.tempo && <span className="form-error"><AlertCircle size={11} /> {errors.tempo}</span>}
                            </div>
                        </div>

                        {/* Mão de Obra */}
                        <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '16px 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Mão de Obra</span>
                            <button type="button" className="abtn abtn-secondary" style={{ fontSize: '0.73rem', padding: '2px 7px' }} onClick={addMao}><Plus size={10} /> Adicionar</button>
                        </div>
                        {maos.length === 0 ? (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 8 }}>Sem mão de obra definida.</div>
                        ) : maos.map((m, i) => {
                            const f = funcoesTecnico.find(x => x.id === m.funcaoId);
                            return (
                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 28px', gap: 6, marginBottom: 5, alignItems: 'start' }}>
                                    <select className="form-select" value={m.funcaoId} onChange={e => updateMao(i, e.target.value)}>
                                        <option value="">Seleccionar função...</option>
                                        {funcoesTecnico.map(f => <option key={f.id} value={f.id}>{f.descricao}</option>)}
                                    </select>
                                    <div className="form-input" style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}>
                                        {(f?.custo ?? 0).toLocaleString('pt-PT')} Kz/h
                                    </div>
                                    <button type="button" className="icon-btn" style={{ color: 'var(--red)', marginTop: 3 }} onClick={() => removeMao(i)}><Trash2 size={12} /></button>
                                </div>
                            );
                        })}

                        {/* Artigos */}
                        <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '16px 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Artigos / Consumíveis</span>
                            <button type="button" className="abtn abtn-secondary" style={{ fontSize: '0.73rem', padding: '2px 7px' }} onClick={addArt}><Plus size={10} /> Adicionar</button>
                        </div>
                        {arts.length === 0 ? (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sem artigos definidos.</div>
                        ) : arts.map((a, i) => {
                            const art = artigos.find(x => x.id === a.artigoId);
                            return (
                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 110px 28px', gap: 6, marginBottom: 5, alignItems: 'start' }}>
                                    <SearchableSelect options={artigoOpts} value={a.artigoId} onChange={v => updateArtId(i, v)} placeholder="Seleccionar artigo..." />
                                    <input type="number" min={1} className="form-input" value={a.quantidade} onChange={e => updateArtQtd(i, e.target.value)} placeholder="Qtd" />
                                    <div className="form-input" style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}>
                                        {(art?.precoUnitario ?? 0).toLocaleString('pt-PT')} Kz
                                    </div>
                                    <button type="button" className="icon-btn" style={{ color: 'var(--red)', marginTop: 3 }} onClick={() => removeArt(i)}><Trash2 size={12} /></button>
                                </div>
                            );
                        })}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="abtn abtn-primary"><Check size={12} /> Guardar Plano</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ══ Repetir Plano Modal ══════════════════════════════ */
interface RepetirModalProps { plano: PlanoManutencao; onClose: () => void; onRepetir: (equipIds: string[]) => void; }
const RepetirModal: React.FC<RepetirModalProps> = ({ plano, onClose, onRepetir }) => {
    const { equipInstalados, clientes, modelosEquipamento, planos } = useGlobal();
    const modeloOrigem = equipInstalados.find(e => e.id === plano.equipInstaladoId)?.modeloId;
    // Show only equips of same model that don't have a plan yet
    const candidates = equipInstalados.filter(e =>
        e.modeloId === modeloOrigem && e.id !== plano.equipInstaladoId &&
        !planos.some(p => p.equipInstaladoId === e.id && p.tipoTrabalhoId === plano.tipoTrabalhoId)
    );
    const [selected, setSelected] = useState<string[]>([]);

    const toggle = (id: string) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 480 }}>
                <div className="modal-header">
                    <h3 className="modal-title">Repetir Plano — {plano.id}</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body">
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                        Seleccione os equipamentos do mesmo modelo que devem receber este plano:
                    </div>
                    {candidates.length === 0 ? (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Não há equipamentos elegíveis do mesmo modelo sem este plano.
                        </div>
                    ) : candidates.map(e => {
                        const cli = clientes.find(c => c.id === e.clienteId)?.nome ?? '—';
                        const mod = modelosEquipamento.find(m => m.id === e.modeloId)?.nome ?? '—';
                        return (
                            <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 3, marginBottom: 6, cursor: 'pointer', background: selected.includes(e.id) ? 'var(--blue-light,#eff6ff)' : undefined }}>
                                <input type="checkbox" checked={selected.includes(e.id)} onChange={() => toggle(e.id)} />
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{e.id} — {mod}</div>
                                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{cli} · {e.nrSerie}</div>
                                </div>
                            </label>
                        );
                    })}
                </div>
                <div className="modal-footer">
                    <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                    <button type="button" className="abtn abtn-primary" disabled={selected.length === 0} onClick={() => onRepetir(selected)}>
                        <Copy size={12} /> Aplicar a {selected.length} equip.
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ══ Page ════════════════════════════════════════════════ */
const PlanosPage: React.FC = () => {
    const { planos, addPlano, updatePlano, equipInstalados, clientes, modelosEquipamento } = useGlobal();

    const [search, setSearch]     = useState('');
    const [modal, setModal]       = useState<'new' | string | null>(null);
    const [repetirId, setRepetirId] = useState<string | null>(null);
    const [showExport, setShowExport] = useState(false);

    const showToast = (msg: string) => notify(msg, 'success');

    const getEquipLabel = (id: string) => {
        const e = equipInstalados.find(x => x.id === id);
        const m = modelosEquipamento.find(x => x.id === e?.modeloId);
        const c = clientes.find(x => x.id === e?.clienteId);
        return `${m?.nome ?? '—'} (${c?.nome ?? '—'})`;
    };

    const filtered = planos.filter(p => {
        const q = search.toLowerCase();
        return !q || p.descricao.toLowerCase().includes(q) || p.equipInstaladoId.toLowerCase().includes(q);
    });

    const exportData = filtered.map(p => {
        const equip = equipInstalados.find(e => e.id === p.equipInstaladoId);
        const mod   = modelosEquipamento.find(m => m.id === equip?.modeloId)?.nome ?? '—';
        return {
            id:            p.id,
            equipamento:   equip ? `${equip.id} — ${mod}` : '—',
            descricao:     p.descricao,
            periodicidade: p.periodicidade,
            previsaoTempo: p.previsaoTempo,
            numMaos:       p.maosDeObra?.length ?? 0,
            numArtigos:    p.artigos?.length ?? 0,
        };
    });

    const handleSave = (data: Omit<PlanoManutencao, 'id'>) => {
        if (typeof modal === 'string' && modal !== 'new') {
            updatePlano(modal, data);
            showToast('Plano actualizado.');
        } else {
            const p = addPlano(data);
            showToast(`Plano ${p.id} criado.`);
        }
        setModal(null);
    };

    const handleRepetir = (equipIds: string[]) => {
        const plano = planos.find(p => p.id === repetirId)!;
        equipIds.forEach(eid => addPlano({ ...plano, equipInstaladoId: eid }));
        showToast(`Plano aplicado a ${equipIds.length} equipamento(s).`);
        setRepetirId(null);
    };

    const editPlano = typeof modal === 'string' && modal !== 'new' ? planos.find(p => p.id === modal) : undefined;
    const repetirPlano = repetirId ? planos.find(p => p.id === repetirId) : undefined;

    const EXPORT_COLS: ExportCol[] = [
        { key: 'id',            label: 'ID'                },
        { key: 'equipamento',   label: 'Equipamento'       },
        { key: 'descricao',     label: 'Descrição'         },
        { key: 'periodicidade', label: 'Periodicidade'     },
        { key: 'previsaoTempo', label: 'Tempo Prev. (h)'   },
        { key: 'numMaos',       label: 'Mão de Obra'       },
        { key: 'numArtigos',    label: 'Artigos'           },
    ];

    return (
        <AppLayout>
            <ActionBar title="Planos de Manutenção" breadcrumb="AQUATEX SGI · Planos">
                <div className="actionbar-spacer" />
                <button className="abtn abtn-secondary" type="button" onClick={() => setShowExport(true)}>
                    <Download size={13} /> Exportar
                </button>
                <button className="abtn abtn-primary" type="button" onClick={() => setModal('new')}>
                    <Plus size={13} /> Novo Plano
                </button>
            </ActionBar>

            <div className="page-content">
                <div className="stats-row">
                    {[
                        { label: 'Total',  value: planos.length,                     cls: ''      },
                        { label: 'Ativos', value: planos.filter(p => p.ativo).length, cls: 'green' },
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
                        <input className="search-input" placeholder="Pesquisar plano..."
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>

                <div className="table-container">
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Equipamento</th>
                                    <th>Descrição</th>
                                    <th>Periodicidade</th>
                                    <th>Tempo Prev.</th>
                                    <th>M.O.</th>
                                    <th>Artigos</th>
                                    <th style={{ width: 80 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr><td colSpan={9}><div className="empty-state"><ClipboardList size={28} /><br />Nenhum plano encontrado.</div></td></tr>
                                )}
                                {filtered.map(p => (
                                    <tr key={p.id}>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{p.id}</td>
                                        <td style={{ fontSize: '0.8rem', fontWeight: 600 }}>{getEquipLabel(p.equipInstaladoId)}</td>
                                        <td style={{ fontSize: '0.8rem' }}>{p.descricao}</td>
                                        <td style={{ fontSize: '0.8rem' }}>{p.periodicidade}</td>
                                        <td style={{ fontSize: '0.8rem' }}>{p.previsaoTempo}h</td>
                                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>{p.maosDeObra.length}</td>
                                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>{p.artigos.length}</td>
                                        <td>
                                            <div className="row-actions">
                                                <button className="icon-btn" title="Editar" onClick={() => setModal(p.id)}><Edit2 size={12} /></button>
                                                <button className="icon-btn" title="Repetir Plano" onClick={() => setRepetirId(p.id)}><Copy size={12} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="table-count">{filtered.length} planos</div>
                </div>
            </div>

            {modal !== null && (
                <PlanoModal plano={editPlano} onClose={() => setModal(null)} onSave={handleSave} />
            )}
            {repetirPlano && (
                <RepetirModal plano={repetirPlano} onClose={() => setRepetirId(null)} onRepetir={handleRepetir} />
            )}

            {showExport && (
                <ExportModal
                    title="Planos de Manutenção"
                    columns={EXPORT_COLS}
                    data={exportData}
                    filename="planos_manutencao"
                    onClose={() => setShowExport(false)}
                />
            )}
        </AppLayout>
    );
};

export default PlanosPage;
