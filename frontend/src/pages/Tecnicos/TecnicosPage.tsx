import React, { useState } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import ExportModal, { ExportCol } from '../../components/ExportModal';
import { useGlobal, Tecnico, FuncaoTecnico } from '../../contexts/GlobalContext';
import { Search, Plus, Edit2, X, AlertCircle, Check, Download, Trash2 } from 'lucide-react';

/* ══ Modal ══════════════════════════════════════════════ */
interface TecnicoModalProps {
    tecnico?: Tecnico;
    funcoes: FuncaoTecnico[];
    onClose: () => void;
    onSave: (t: Omit<Tecnico, 'id'>) => void;
}
const TecnicoModal: React.FC<TecnicoModalProps> = ({ tecnico, funcoes, onClose, onSave }) => {
    const [nome, setNome]         = useState(tecnico?.nome ?? '');
    const [telefone, setTelefone] = useState(tecnico?.telefone ?? '');
    const [email, setEmail]       = useState(tecnico?.email ?? '');
    const [funcaoId, setFuncaoId] = useState(tecnico?.funcaoId ?? '');
    const [custoHora, setCustoHora] = useState(String(tecnico?.custoHora ?? ''));
    const [ativo, setAtivo]       = useState(tecnico?.ativo ?? true);
    const [errors, setErrors]     = useState<Record<string, string>>({});

    const validate = () => {
        const e: Record<string, string> = {};
        if (!nome.trim())    e.nome    = 'Obrigatório';
        if (!funcaoId)       e.funcao  = 'Obrigatório';
        if (!custoHora || isNaN(Number(custoHora))) e.custo = 'Valor inválido';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSave = (ev: React.FormEvent) => {
        ev.preventDefault();
        if (!validate()) return;
        onSave({ nome, telefone, email, funcaoId, custoHora: Number(custoHora), ativo });
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 520 }}>
                <div className="modal-header">
                    <h3 className="modal-title">{tecnico ? 'Editar Técnico' : 'Novo Técnico'}</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <form onSubmit={handleSave} noValidate>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label req">Nome</label>
                            <input className={`form-input${errors.nome ? ' err' : ''}`} value={nome}
                                onChange={e => setNome(e.target.value)} placeholder="Nome completo" />
                            {errors.nome && <span className="form-error"><AlertCircle size={11} /> {errors.nome}</span>}
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Telefone</label>
                                <input className="form-input" value={telefone}
                                    onChange={e => setTelefone(e.target.value)} placeholder="9XX XXX XXX" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input type="email" className="form-input" value={email}
                                    onChange={e => setEmail(e.target.value)} placeholder="nome@aquatex.ao" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label req">Função</label>
                            <select className={`form-select${errors.funcao ? ' err' : ''}`} value={funcaoId}
                                onChange={e => {
                                    setFuncaoId(e.target.value);
                                    const f = funcoes.find(x => x.id === e.target.value);
                                    if (f) setCustoHora(String(f.custo));
                                }}>
                                <option value="">Seleccionar...</option>
                                {funcoes.map(f => <option key={f.id} value={f.id}>{f.descricao}</option>)}
                            </select>
                            {errors.funcao && <span className="form-error"><AlertCircle size={11} /> {errors.funcao}</span>}
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label req">Custo/Hora (Kz)</label>
                                <input type="number" min={0} className={`form-input${errors.custo ? ' err' : ''}`}
                                    value={custoHora} onChange={e => setCustoHora(e.target.value)} />
                                {errors.custo && <span className="form-error"><AlertCircle size={11} /> {errors.custo}</span>}
                            </div>
                            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                                <input type="checkbox" id="tec-ativo" checked={ativo} onChange={e => setAtivo(e.target.checked)} style={{ width: 14, height: 14 }} />
                                <label htmlFor="tec-ativo" style={{ fontSize: '0.82rem', color: 'var(--text-primary)', cursor: 'pointer' }}>Técnico activo</label>
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

/* ══ Page ════════════════════════════════════════════════ */
const TecnicosPage: React.FC = () => {
    const { tecnicos, addTecnico, updateTecnico, removeTecnico, funcoesTecnico } = useGlobal();

    const [search, setSearch]     = useState('');
    const [modal, setModal]       = useState<'new' | string | null>(null);
    const [toast, setToast]       = useState('');
    const [toastErr, setToastErr] = useState('');
    const [showExport, setShowExport] = useState(false);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
    const showErr   = (msg: string) => { setToastErr(msg); setTimeout(() => setToastErr(''), 5000); };

    const handleRemove = async (id: string, nome: string) => {
        if (!window.confirm(`Eliminar o técnico "${nome}"? Esta acção não pode ser desfeita.`)) return;
        try {
            await removeTecnico(id);
            showToast(`Técnico "${nome}" eliminado.`);
        } catch (e: any) {
            showErr(e?.response?.data?.message ?? 'Erro ao eliminar técnico.');
        }
    };

    const getFuncaoLabel = (id: string) => funcoesTecnico.find(f => f.id === id)?.descricao ?? id;

    const filtered = tecnicos.filter(t => {
        const q = search.toLowerCase();
        return !q || t.nome.toLowerCase().includes(q) || t.email.toLowerCase().includes(q);
    });

    const exportData = filtered.map(t => ({
        nome:      t.nome,
        funcao:    funcoesTecnico.find(f => f.id === t.funcaoId)?.descricao ?? t.funcaoId,
        telefone:  t.telefone,
        email:     t.email,
        custoHora: t.custoHora,
        estado:    t.ativo ? 'Activo' : 'Inactivo',
    }));

    const ativos   = tecnicos.filter(t => t.ativo).length;
    const inativos = tecnicos.filter(t => !t.ativo).length;

    const editTarget = typeof modal === 'string' && modal !== 'new' ? tecnicos.find(t => t.id === modal) : undefined;

    const handleSave = (data: Omit<Tecnico, 'id'>) => {
        if (typeof modal === 'string' && modal !== 'new') {
            updateTecnico(modal, data);
            showToast('Técnico actualizado.');
        } else {
            const t = addTecnico(data);
            showToast(`Técnico ${t.id} registado.`);
        }
        setModal(null);
    };

    const EXPORT_COLS: ExportCol[] = [
        { key: 'nome',      label: 'Nome'          },
        { key: 'funcao',    label: 'Função'        },
        { key: 'telefone',  label: 'Telefone'      },
        { key: 'email',     label: 'Email'         },
        { key: 'custoHora', label: 'Custo/h (Kz)' },
        { key: 'estado',    label: 'Estado'        },
    ];

    return (
        <AppLayout>
            <ActionBar title="Técnicos" breadcrumb="AQUATEX SGI · Técnicos">
                <div className="actionbar-spacer" />
                <button className="abtn abtn-secondary" type="button" onClick={() => setShowExport(true)}>
                    <Download size={13} /> Exportar
                </button>
                <button className="abtn abtn-primary" type="button" onClick={() => setModal('new')}>
                    <Plus size={13} /> Novo Técnico
                </button>
            </ActionBar>

            <div className="page-content">
                <div className="stats-row">
                    {[
                        { label: 'Total',    value: tecnicos.length, cls: ''      },
                        { label: 'Activos',  value: ativos,          cls: 'green' },
                        { label: 'Inativos', value: inativos,        cls: 'muted' },
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
                        <input className="search-input" placeholder="Pesquisar por nome ou email..."
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>

                <div className="table-container">
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 20 }} />
                                    <th>Nome</th>
                                    <th>Função</th>
                                    <th>Telefone</th>
                                    <th>Email</th>
                                    <th>Custo/h</th>
                                    <th>Estado</th>
                                    <th style={{ width: 60 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr><td colSpan={9}><div className="empty-state">Nenhum técnico encontrado.</div></td></tr>
                                )}
                                {filtered.map(t => (
                                    <tr key={t.id} style={{ opacity: t.ativo ? 1 : 0.5 }}>
                                        <td style={{ paddingLeft: 10 }}>
                                            <span className={`dot ${t.ativo ? 'dot-green' : 'dot-gray'}`} />
                                        </td>
                                        <td style={{ fontWeight: 600, fontSize: '0.83rem' }}>{t.nome}</td>
                                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{getFuncaoLabel(t.funcaoId)}</td>
                                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.telefone || '—'}</td>
                                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.email || '—'}</td>
                                        <td style={{ fontSize: '0.78rem' }}>{t.custoHora.toLocaleString('pt-PT')} Kz</td>
                                        <td>
                                            <span style={{ fontSize: '0.75rem', color: t.ativo ? 'var(--green)' : 'var(--text-muted)' }}>
                                                {t.ativo ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="row-actions">
                                                <button className="icon-btn" title="Editar" onClick={() => setModal(t.id)}>
                                                    <Edit2 size={12} />
                                                </button>
                                                <button className="icon-btn icon-btn-danger" title="Eliminar" onClick={() => handleRemove(t.id, t.nome)}>
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="table-count">{filtered.length} técnicos</div>
                </div>
            </div>

            {modal !== null && (
                <TecnicoModal
                    tecnico={editTarget}
                    funcoes={funcoesTecnico}
                    onClose={() => setModal(null)}
                    onSave={handleSave}
                />
            )}

            {toast && (
                <div className="toast" role="status">
                    <Check size={14} strokeWidth={2.5} style={{ color: 'var(--green)' }} />
                    <span>{toast}</span>
                </div>
            )}
            {toastErr && (
                <div className="toast" role="alert" style={{ background: 'var(--red,#ef4444)', color: '#fff' }}>
                    <AlertCircle size={14} />
                    <span>{toastErr}</span>
                </div>
            )}

            {showExport && (
                <ExportModal
                    title="Técnicos"
                    columns={EXPORT_COLS}
                    data={exportData}
                    filename="tecnicos"
                    onClose={() => setShowExport(false)}
                />
            )}
        </AppLayout>
    );
};

export default TecnicosPage;
