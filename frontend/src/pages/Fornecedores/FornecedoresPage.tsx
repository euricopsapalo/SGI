import React, { useState } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import ExportModal, { ExportCol } from '../../components/ExportModal';
import { useGlobal, Fornecedor } from '../../contexts/GlobalContext';
import { Search, Plus, Edit2, Eye, X, AlertCircle, Check, Truck, Download, Trash2, MapPin } from 'lucide-react';

/* ══ View Modal ══════════════════════════════════════════════ */
interface FornecedorViewModalProps {
    fornecedor: Fornecedor;
    provinciaNome: string;
    municipioNome: string;
    encomendasCount: number;
    onClose: () => void;
    onEdit: () => void;
}
const FornecedorViewModal: React.FC<FornecedorViewModalProps> = ({ fornecedor: f, provinciaNome, municipioNome, encomendasCount, onClose, onEdit }) => (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
                <h3 className="modal-title">Fornecedor</h3>
                <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
            </div>
            <div className="modal-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--blue-light,#eff6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Truck size={18} style={{ color: 'var(--blue)' }} />
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{f.nome}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>NIF: {f.nif || '—'}</div>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', padding: '2px 8px', borderRadius: 10, background: f.ativo ? 'var(--green-light,#f0fdf4)' : 'var(--bg-secondary)', color: f.ativo ? 'var(--green)' : 'var(--text-muted)', fontWeight: 600 }}>
                        {f.ativo ? 'Activo' : 'Inactivo'}
                    </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                    {[
                        { label: 'Telefone', value: f.telefone || '—' },
                        { label: 'Email',    value: f.email || '—'    },
                        { label: 'Morada',   value: f.morada || '—', span: true },
                        { label: 'Província', value: provinciaNome || '—' },
                        { label: 'Município', value: municipioNome || '—' },
                        { label: 'Encomendas', value: String(encomendasCount) },
                    ].map(row => (
                        <div key={row.label} style={(row as any).span ? { gridColumn: '1 / -1' } : {}}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{row.label}</div>
                            <div style={{ fontSize: '0.83rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>{row.value}</div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="modal-footer">
                <button type="button" className="abtn abtn-secondary" onClick={onClose}>Fechar</button>
                <button type="button" className="abtn abtn-primary" onClick={onEdit}><Edit2 size={12} /> Editar</button>
            </div>
        </div>
    </div>
);

/* ══ Edit/Create Modal ══════════════════════════════════════ */
interface FornecedorModalProps {
    fornecedor?: Fornecedor;
    onClose: () => void;
    onSave: (f: Omit<Fornecedor, 'id'>) => void;
}
const FornecedorModal: React.FC<FornecedorModalProps> = ({ fornecedor, onClose, onSave }) => {
    const { provincias, municipios } = useGlobal();
    const [nome, setNome]           = useState(fornecedor?.nome       ?? '');
    const [nif, setNif]             = useState(fornecedor?.nif        ?? '');
    const [telefone, setTel]        = useState(fornecedor?.telefone   ?? '');
    const [email, setEmail]         = useState(fornecedor?.email      ?? '');
    const [morada, setMorada]       = useState(fornecedor?.morada     ?? '');
    const [ativo, setAtivo]         = useState(fornecedor?.ativo      ?? true);
    const [provinciaId, setProvId]  = useState(fornecedor?.provinciaId ? String(fornecedor.provinciaId) : '');
    const [municipioId, setMunId]   = useState(fornecedor?.municipioId ? String(fornecedor.municipioId) : '');
    const [errors, setErrors]       = useState<Record<string, string>>({});

    const munsFiltrados = municipios.filter(m => m.provinciaId === provinciaId);

    const validate = () => {
        const e: Record<string, string> = {};
        if (!nome.trim()) e.nome = 'Obrigatório';
        if (!nif.trim())  e.nif  = 'Obrigatório';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSave = (ev: React.FormEvent) => {
        ev.preventDefault();
        if (!validate()) return;
        onSave({ nome, nif, telefone, email, morada, ativo, provinciaId: provinciaId || undefined, municipioId: municipioId || undefined });
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 520 }}>
                <div className="modal-header">
                    <h3 className="modal-title">{fornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <form onSubmit={handleSave} noValidate>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label req">Nome / Razão Social</label>
                            <input className={`form-input${errors.nome ? ' err' : ''}`} value={nome}
                                onChange={e => setNome(e.target.value)} placeholder="Ex: Grundfos Angola, LDA" />
                            {errors.nome && <span className="form-error"><AlertCircle size={11} /> {errors.nome}</span>}
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label req">NIF</label>
                                <input className={`form-input${errors.nif ? ' err' : ''}`} value={nif}
                                    onChange={e => setNif(e.target.value)} placeholder="5XXXXXXXXX" />
                                {errors.nif && <span className="form-error"><AlertCircle size={11} /> {errors.nif}</span>}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Telefone</label>
                                <input className="form-input" value={telefone}
                                    onChange={e => setTel(e.target.value)} placeholder="222 XXX XXX" />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input type="email" className="form-input" value={email}
                                onChange={e => setEmail(e.target.value)} placeholder="comercial@empresa.ao" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Morada</label>
                            <input className="form-input" value={morada}
                                onChange={e => setMorada(e.target.value)} placeholder="Rua, nº, Localidade" />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label"><MapPin size={11} style={{ verticalAlign: 'middle' }} /> Província</label>
                                <select className="form-select" value={provinciaId}
                                    onChange={e => { setProvId(e.target.value); setMunId(''); }}>
                                    <option value="">Seleccionar...</option>
                                    {provincias.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Município</label>
                                <select className="form-select" value={municipioId}
                                    onChange={e => setMunId(e.target.value)} disabled={!provinciaId}>
                                    <option value="">Seleccionar...</option>
                                    {munsFiltrados.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type="checkbox" id="for-ativo" checked={ativo} onChange={e => setAtivo(e.target.checked)} style={{ width: 14, height: 14 }} />
                            <label htmlFor="for-ativo" style={{ fontSize: '0.82rem', color: 'var(--text-primary)', cursor: 'pointer' }}>Fornecedor activo</label>
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
const FornecedoresPage: React.FC = () => {
    const { fornecedores, addFornecedor, updateFornecedor, removeFornecedor, encomendas, provincias, municipios } = useGlobal();

    const [search, setSearch]     = useState('');
    const [modal, setModal]       = useState<'new' | string | null>(null);
    const [viewId, setViewId]     = useState<string | null>(null);
    const [toast, setToast]       = useState('');
    const [toastErr, setToastErr] = useState('');
    const [showExport, setShowExport] = useState(false);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
    const showErr   = (msg: string) => { setToastErr(msg); setTimeout(() => setToastErr(''), 5000); };

    const handleRemove = async (id: string, nome: string) => {
        if (!window.confirm(`Eliminar o fornecedor "${nome}"? Esta acção não pode ser desfeita.`)) return;
        try {
            await removeFornecedor(id);
            showToast(`Fornecedor "${nome}" eliminado.`);
        } catch (e: any) {
            showErr(e?.response?.data?.message ?? 'Erro ao eliminar fornecedor.');
        }
    };

    const countEncomendas = (id: string) => encomendas.filter(e => e.fornecedorId === id).length;

    const getProvinciaNome = (id?: string) => provincias.find(p => p.id === id)?.nome ?? '';
    const getMunicipioNome = (id?: string) => municipios.find(m => m.id === id)?.nome ?? '';

    const filtered = fornecedores.filter(f => {
        const q = search.toLowerCase();
        return !q || f.nome.toLowerCase().includes(q) || f.nif.includes(q) || f.email.toLowerCase().includes(q);
    });

    const exportData = filtered.map(f => ({
        ...f,
        provincia: getProvinciaNome(f.provinciaId),
        municipio: getMunicipioNome(f.municipioId),
        estado: f.ativo ? 'Activo' : 'Inactivo',
    }));

    const ativos   = fornecedores.filter(f => f.ativo).length;
    const inativos = fornecedores.filter(f => !f.ativo).length;

    const editTarget = typeof modal === 'string' && modal !== 'new' ? fornecedores.find(f => f.id === modal) : undefined;
    const viewTarget = viewId ? fornecedores.find(f => f.id === viewId) : undefined;

    const handleSave = (data: Omit<Fornecedor, 'id'>) => {
        if (typeof modal === 'string' && modal !== 'new') {
            updateFornecedor(modal, data);
            showToast('Fornecedor actualizado.');
        } else {
            addFornecedor(data);
            showToast('Fornecedor registado.');
        }
        setModal(null);
    };

    const EXPORT_COLS: ExportCol[] = [
        { key: 'nome',      label: 'Nome / Razão Social' },
        { key: 'nif',       label: 'NIF'                 },
        { key: 'telefone',  label: 'Telefone'             },
        { key: 'email',     label: 'Email'                },
        { key: 'morada',    label: 'Morada'               },
        { key: 'provincia', label: 'Província'            },
        { key: 'municipio', label: 'Município'            },
        { key: 'estado',    label: 'Estado'               },
    ];

    return (
        <AppLayout>
            <ActionBar title="Fornecedores" breadcrumb="AQUATEX SGI · Fornecedores">
                <div className="actionbar-spacer" />
                <button className="abtn abtn-secondary" type="button" onClick={() => setShowExport(true)}>
                    <Download size={13} /> Exportar
                </button>
                <button className="abtn abtn-primary" type="button" onClick={() => setModal('new')}>
                    <Plus size={13} /> Novo Fornecedor
                </button>
            </ActionBar>

            <div className="page-content">
                <div className="stats-row">
                    {[
                        { label: 'Activos',    value: ativos,          cls: 'green' },
                        { label: 'Inativos',   value: inativos,        cls: 'muted' },
                        { label: 'Encomendas', value: encomendas.length, cls: 'blue' },
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
                        <input className="search-input" placeholder="Pesquisar por nome, NIF ou email..."
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>

                <div className="table-container">
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 20 }} />
                                    <th>Nome / Razão Social</th>
                                    <th>NIF</th>
                                    <th>Telefone</th>
                                    <th>Email</th>
                                    <th>Morada</th>
                                    <th>Município</th>
                                    <th>Encomendas</th>
                                    <th style={{ width: 80 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr><td colSpan={9}><div className="empty-state"><Truck size={28} /><br />Nenhum fornecedor encontrado.</div></td></tr>
                                )}
                                {filtered.map(f => (
                                    <tr key={f.id} style={{ opacity: f.ativo ? 1 : 0.5 }}>
                                        <td style={{ paddingLeft: 10 }}>
                                            <span className={`dot ${f.ativo ? 'dot-green' : 'dot-gray'}`} />
                                        </td>
                                        <td style={{ fontWeight: 600, fontSize: '0.83rem' }}>{f.nome}</td>
                                        <td style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{f.nif}</td>
                                        <td style={{ fontSize: '0.78rem' }}>{f.telefone || '—'}</td>
                                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{f.email || '—'}</td>
                                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: 160 }}>{f.morada || '—'}</td>
                                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                            {getMunicipioNome(f.municipioId) || '—'}
                                        </td>
                                        <td style={{ fontSize: '0.78rem', textAlign: 'center' }}>
                                            <span style={{ background: 'var(--blue-light,#eff6ff)', color: 'var(--blue)', borderRadius: 10, padding: '2px 8px', fontSize: '0.75rem' }}>
                                                {countEncomendas(f.id)}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="row-actions">
                                                <button className="icon-btn" title="Pré-visualizar" onClick={() => setViewId(f.id)}>
                                                    <Eye size={12} />
                                                </button>
                                                <button className="icon-btn" title="Editar" onClick={() => setModal(f.id)}>
                                                    <Edit2 size={12} />
                                                </button>
                                                <button className="icon-btn icon-btn-danger" title="Eliminar" onClick={() => handleRemove(f.id, f.nome)}>
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="table-count">{filtered.length} fornecedores</div>
                </div>
            </div>

            {viewTarget && (
                <FornecedorViewModal
                    fornecedor={viewTarget}
                    provinciaNome={getProvinciaNome(viewTarget.provinciaId)}
                    municipioNome={getMunicipioNome(viewTarget.municipioId)}
                    encomendasCount={countEncomendas(viewTarget.id)}
                    onClose={() => setViewId(null)}
                    onEdit={() => { setModal(viewTarget.id); setViewId(null); }}
                />
            )}

            {modal !== null && (
                <FornecedorModal
                    fornecedor={editTarget}
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
                    title="Fornecedores"
                    columns={EXPORT_COLS}
                    data={exportData}
                    filename="fornecedores"
                    onClose={() => setShowExport(false)}
                />
            )}
        </AppLayout>
    );
};

export default FornecedoresPage;
