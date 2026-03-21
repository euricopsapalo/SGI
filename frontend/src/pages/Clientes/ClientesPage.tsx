import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import ExportModal, { ExportCol } from '../../components/ExportModal';
import { Search, Plus, Pencil, Eye, Phone, Mail, MapPin, Building2, User, X, Check, AlertCircle, Trash2, Download } from 'lucide-react';
import axios from 'axios';
import { useGlobal } from '../../contexts/GlobalContext';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

/* ══════════════════════════════════════════
   Types
══════════════════════════════════════════ */
type TipoCliente = 'empresa' | 'particular';

export interface Endereco {
    descricao: string;
    morada: string;
    cidade: string;
    principal: boolean;
    provinciaId?: string;
    municipioId?: string;
}

export interface Cliente {
    id: number; tipo: TipoCliente;
    nome: string; nif: string; email: string; telefone: string;
    ativo: boolean;
    enderecos: Endereco[];
}

/* ── Helpers ── */
const endPrincipal = (c: Cliente): Endereco =>
    (c.enderecos ?? []).find(e => e.principal) ?? c.enderecos?.[0] ?? { descricao: '', morada: '', cidade: '', principal: true };

const codigoCli = (id: number) => `CLI-${String(id).padStart(4, '0')}`;

/* ══════════════════════════════════════════
   Form types
══════════════════════════════════════════ */
type ScalarField = 'nome' | 'nif' | 'email' | 'telefone';
type FormErrors = Partial<Record<ScalarField, string>>;
type EndErrors = Array<{ morada?: string; cidade?: string }>;

type FormData = {
    tipo: TipoCliente;
    nome: string; nif: string; email: string; telefone: string;
    ativo: boolean;
    enderecos: Endereco[];
};

const BLANK_END: Endereco = { descricao: '', morada: '', cidade: '', principal: true, provinciaId: '', municipioId: '' };
const BLANK: FormData = { tipo: 'empresa', nome: '', nif: '', email: '', telefone: '', ativo: true, enderecos: [{ ...BLANK_END }] };

/* ══════════════════════════════════════════
   Field
══════════════════════════════════════════ */
interface FieldProps {
    k: ScalarField; label: string; placeholder?: string; type?: string; required?: boolean;
    form: FormData; errors: FormErrors;
    onChange: (k: ScalarField) => (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const Field: React.FC<FieldProps> = ({ k, label, placeholder, type = 'text', required = false, form, errors, onChange }) => (
    <div className="form-group">
        <label className={`form-label${required ? ' req' : ''}`}>{label}</label>
        <input
            type={type}
            className={`form-input${errors[k] ? ' err' : ''}`}
            value={form[k]}
            onChange={onChange(k)}
            placeholder={placeholder}
        />
        {errors[k] && <span className="form-error"><AlertCircle size={11} /> {errors[k]}</span>}
    </div>
);

/* ══════════════════════════════════════════
   MODAL — Criar / Editar Cliente
══════════════════════════════════════════ */
interface ModalProps { initial: Cliente | null; onClose: () => void; onSave: (data: FormData) => void; }

const ClienteModal: React.FC<ModalProps> = ({ initial, onClose, onSave }) => {
    const isEdit = Boolean(initial);
    const { provincias, municipios } = useGlobal();
    const [form, setForm] = useState<FormData>(BLANK);
    const [errors, setErrors] = useState<FormErrors>({});
    const [endErrors, setEndErrors] = useState<EndErrors>([]);

    useEffect(() => {
        if (initial) {
            setForm({
                tipo: initial.tipo, nome: initial.nome, nif: initial.nif ?? '',
                email: initial.email ?? '', telefone: initial.telefone ?? '',
                ativo: initial.ativo ?? true,
                enderecos: (initial.enderecos ?? []).length > 0
                    ? initial.enderecos.map(e => ({
                        ...e,
                        provinciaId: e.provinciaId ? String(e.provinciaId) : '',
                        municipioId: e.municipioId ? String(e.municipioId) : '',
                    }))
                    : [{ ...BLANK_END }],
            });
        } else {
            setForm({ ...BLANK, enderecos: [{ ...BLANK_END }] });
        }
        setErrors({});
        setEndErrors([]);
    }, [initial]);

    const set = (k: ScalarField) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(p => ({ ...p, [k]: e.target.value }));

    const setEnd = (i: number, field: keyof Endereco) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(p => ({
            ...p,
            enderecos: p.enderecos.map((en, idx) => idx === i ? { ...en, [field]: e.target.value } : en),
        }));

    const setEndProv = (i: number, provId: string) =>
        setForm(p => ({
            ...p,
            enderecos: p.enderecos.map((en, idx) => idx === i ? { ...en, provinciaId: provId, municipioId: '' } : en),
        }));

    const setEndMun = (i: number, munId: string) =>
        setForm(p => ({
            ...p,
            enderecos: p.enderecos.map((en, idx) => idx === i ? { ...en, municipioId: munId } : en),
        }));

    const setPrincipal = (i: number) =>
        setForm(p => ({
            ...p,
            enderecos: p.enderecos.map((en, idx) => ({ ...en, principal: idx === i })),
        }));

    const addEnd = () =>
        setForm(p => ({
            ...p,
            enderecos: [...p.enderecos, { descricao: '', morada: '', cidade: '', principal: p.enderecos.length === 0 }],
        }));

    const removeEnd = (i: number) =>
        setForm(p => {
            const ends = p.enderecos.filter((_, idx) => idx !== i);
            if (ends.length > 0 && !ends.some(e => e.principal)) ends[0].principal = true;
            return { ...p, enderecos: ends };
        });

    const validate = (): boolean => {
        const e: FormErrors = {};
        if (!form.nome.trim()) e.nome = 'Obrigatório';
        if (!form.nif.trim()) e.nif = 'Obrigatório';
        if (!form.email.trim()) e.email = 'Obrigatório';
        else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Email inválido';

        const ee: EndErrors = form.enderecos.map(en => {
            const err: { morada?: string; cidade?: string } = {};
            if (!en.morada.trim()) err.morada = 'Obrigatório';
            if (!en.cidade.trim()) err.cidade = 'Obrigatório';
            return err;
        });

        setErrors(e);
        setEndErrors(ee);
        return Object.keys(e).length === 0 && ee.every(err => !err.morada && !err.cidade);
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (validate()) onSave(form);
    };

    const isEmpresa = form.tipo === 'empresa';

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 560 }}>

                <div className="modal-header">
                    <h3 className="modal-title">{isEdit ? `Editar — ${initial?.nome}` : 'Novo Cliente'}</h3>
                    <button className="modal-close" onClick={onClose} type="button"><X size={13} /></button>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                    <div className="modal-body">

                        {/* Tipo */}
                        <div className="form-group">
                            <label className="form-label req">Tipo de Cliente</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {(['empresa', 'particular'] as TipoCliente[]).map(t => (
                                    <button key={t} type="button"
                                        className={`abtn${form.tipo === t ? ' abtn-primary' : ' abtn-secondary'}`}
                                        style={{ flex: 1, justifyContent: 'center', gap: 6 }}
                                        onClick={() => setForm(p => ({ ...p, tipo: t }))}>
                                        {t === 'empresa' ? <Building2 size={13} /> : <User size={13} />}
                                        {t === 'empresa' ? 'Empresa' : 'Particular'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Nome */}
                        <Field k="nome" required
                            label={isEmpresa ? 'Nome / Razão Social' : 'Nome Completo'}
                            placeholder={isEmpresa ? 'Ex: Empresa Alpha, LDA' : 'Ex: João Manuel Silva'}
                            form={form} errors={errors} onChange={set} />

                        {/* NIF + Telefone */}
                        <div className="form-row">
                            <Field k="nif" required
                                label={isEmpresa ? 'NIF' : 'BI / NIF'}
                                placeholder={isEmpresa ? '54001XXXXX' : '004XXXXXXXXXXX'}
                                form={form} errors={errors} onChange={set} />
                            <Field k="telefone" label="Telefone" placeholder="+244 9XX XXX XXX"
                                form={form} errors={errors} onChange={set} />
                        </div>

                        {/* Email */}
                        <Field k="email" required label="Email" type="email"
                            placeholder={isEmpresa ? 'geral@empresa.ao' : 'contacto@email.ao'}
                            form={form} errors={errors} onChange={set} />

                        {/* Ativo */}
                        <div className="form-group">
                            <label className="form-label">Estado</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {[true, false].map(v => (
                                    <button key={String(v)} type="button"
                                        className={`abtn${form.ativo === v ? ' abtn-primary' : ' abtn-secondary'}`}
                                        style={{ flex: 1, justifyContent: 'center' }}
                                        onClick={() => setForm(p => ({ ...p, ativo: v }))}>
                                        {v ? 'Ativo' : 'Inativo'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Endereços */}
                        <div style={{ marginTop: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <label className="form-label" style={{ margin: 0 }}>Endereços</label>
                                <button type="button" className="abtn abtn-secondary"
                                    style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={addEnd}>
                                    <Plus size={11} /> Adicionar
                                </button>
                            </div>

                            {form.enderecos.map((en, i) => (
                                <div key={i} style={{
                                    border: `1px solid ${endErrors[i]?.morada || endErrors[i]?.cidade ? 'var(--red, #e53e3e)' : 'var(--border)'}`,
                                    borderRadius: 4, padding: '10px 12px', marginBottom: 8,
                                    background: en.principal ? 'var(--bg-secondary, #f8f9fa)' : 'transparent',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <input type="text"
                                                className="form-input"
                                                value={en.descricao}
                                                onChange={setEnd(i, 'descricao')}
                                                placeholder="Designação (ex: Sede)"
                                                style={{ width: 160, fontSize: '0.8rem' }}
                                            />
                                            {en.principal && (
                                                <span style={{ fontSize: '0.7rem', background: 'var(--blue)', color: '#fff', borderRadius: 3, padding: '1px 6px', fontWeight: 600 }}>
                                                    Principal
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            {!en.principal && (
                                                <button type="button" className="icon-btn" title="Definir como principal" onClick={() => setPrincipal(i)}>
                                                    <Check size={11} />
                                                </button>
                                            )}
                                            {form.enderecos.length > 1 && (
                                                <button type="button" className="icon-btn" title="Remover endereço"
                                                    style={{ color: 'var(--red, #e53e3e)' }} onClick={() => removeEnd(i)}>
                                                    <Trash2 size={11} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="form-row" style={{ marginBottom: 0 }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <input type="text"
                                                className={`form-input${endErrors[i]?.morada ? ' err' : ''}`}
                                                value={en.morada}
                                                onChange={setEnd(i, 'morada')}
                                                placeholder="Rua / Avenida, Nº"
                                            />
                                            {endErrors[i]?.morada && <span className="form-error"><AlertCircle size={11} /> {endErrors[i]!.morada}</span>}
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <input type="text"
                                                className={`form-input${endErrors[i]?.cidade ? ' err' : ''}`}
                                                value={en.cidade}
                                                onChange={setEnd(i, 'cidade')}
                                                placeholder="Cidade"
                                            />
                                            {endErrors[i]?.cidade && <span className="form-error"><AlertCircle size={11} /> {endErrors[i]!.cidade}</span>}
                                        </div>
                                    </div>
                                    <div className="form-row" style={{ marginBottom: 0, marginTop: 6 }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <select className="form-select" value={en.provinciaId ?? ''}
                                                onChange={e => setEndProv(i, e.target.value)}>
                                                <option value="">Província...</option>
                                                {provincias.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <select className="form-select" value={en.municipioId ?? ''}
                                                onChange={e => setEndMun(i, e.target.value)}
                                                disabled={!en.provinciaId}>
                                                <option value="">Município...</option>
                                                {municipios.filter(m => m.provinciaId === en.provinciaId).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>

                    <div className="modal-footer">
                        <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="abtn abtn-primary">
                            {isEdit ? 'Guardar Alterações' : 'Criar Cliente'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════
   MODAL — Detalhe do Cliente
══════════════════════════════════════════ */
interface DetailProps { cliente: Cliente; maquinas: number; osTotal: number; onClose: () => void; onEdit: () => void; }

const TIPO_STYLE: Record<TipoCliente, React.CSSProperties> = {
    empresa: { background: 'var(--blue)', color: '#fff' },
    particular: { background: 'var(--green)', color: '#fff' },
};

const ClienteDetail: React.FC<DetailProps> = ({ cliente, maquinas, osTotal, onClose, onEdit }) => {
    const principal = endPrincipal(cliente);
    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 560 }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <h3 className="modal-title" style={{ margin: 0 }}>{codigoCli(cliente.id)} — {cliente.nome}</h3>
                        <span style={{ fontSize: '0.7rem', padding: '1px 7px', borderRadius: 3, fontWeight: 600, flexShrink: 0, ...TIPO_STYLE[cliente.tipo] }}>
                            {cliente.tipo === 'empresa' ? 'Empresa' : 'Particular'}
                        </span>
                    </div>
                    <button className="modal-close" onClick={onClose} type="button"><X size={13} /></button>
                </div>

                <div className="modal-body">
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">{cliente.tipo === 'empresa' ? 'NIF' : 'BI / NIF'}</label>
                            <div style={{ padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 3, fontSize: '0.82rem' }}>{cliente.nif}</div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Cidade Principal</label>
                            <div style={{ padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 3, fontSize: '0.82rem' }}>{principal.cidade}</div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Endereços ({(cliente.enderecos ?? []).length})</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {(cliente.enderecos ?? []).map((en, i) => (
                                <div key={i} style={{
                                    display: 'flex', gap: 8, alignItems: 'flex-start',
                                    padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 3,
                                    background: en.principal ? 'var(--bg-secondary, #f8f9fa)' : 'transparent',
                                }}>
                                    <MapPin size={13} style={{ color: 'var(--blue)', marginTop: 2, flexShrink: 0 }} />
                                    <div style={{ fontSize: '0.82rem', flex: 1 }}>
                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 2 }}>
                                            {en.descricao && <strong>{en.descricao}</strong>}
                                            {en.principal && (
                                                <span style={{ fontSize: '0.65rem', background: 'var(--blue)', color: '#fff', borderRadius: 3, padding: '0 5px', fontWeight: 600 }}>
                                                    Principal
                                                </span>
                                            )}
                                        </div>
                                        <span style={{ color: 'var(--text-secondary)' }}>{en.morada}, {en.cidade}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Telefone</label>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                <Phone size={13} /> {cliente.telefone}
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-link)' }}>
                                <Mail size={13} /> {cliente.email}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12, marginTop: 8 }}>
                        {[
                            { label: 'Máquinas Instaladas', value: maquinas, color: 'var(--blue)' },
                            { label: 'OT Realizadas', value: osTotal, color: 'var(--green)' },
                            { label: 'Estado', value: cliente.ativo ? 'Ativo' : 'Inativo', color: cliente.ativo ? 'var(--green)' : 'var(--text-muted)', sm: true },
                        ].map(s => (
                            <div key={s.label} className="panel" style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <div className="stat-label">{s.label}</div>
                                <div style={{ fontWeight: 800, fontSize: (s as any).sm ? '0.82rem' : '1.3rem', color: s.color, marginTop: 2 }}>{s.value}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="abtn abtn-secondary" onClick={onClose} type="button">Fechar</button>
                    <button className="abtn abtn-primary" onClick={onEdit} type="button"><Pencil size={12} /> Editar</button>
                </div>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════ */
const ClientesPage: React.FC = () => {
    const { equipInstalados, ordens, addLog, currentUser } = useGlobal();
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch]     = useState('');
    const [detail, setDetail]     = useState<Cliente | null>(null);
    const [editTarget, setEditTarget] = useState<Cliente | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [toast, setToast]         = useState('');
    const [toastErr, setToastErr]   = useState('');
    const [showExport, setShowExport] = useState(false);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
    const showErr   = (msg: string) => { setToastErr(msg); setTimeout(() => setToastErr(''), 5000); };

    const handleRemove = async (id: number, nome: string) => {
        if (!window.confirm(`Eliminar o cliente "${nome}"? Esta acção não pode ser desfeita.`)) return;
        try {
            await axios.delete(`${API}/api/clientes/${id}`);
            showToast(`Cliente "${nome}" eliminado.`);
            addLog({ usuario: currentUser?.email ?? 'sistema', modulo: 'Clientes', acao: 'Cliente eliminado', detalhes: `Nome: ${nome}`, tipo: 'warning' });
            loadClientes();
        } catch (e: any) {
            showErr(e?.response?.data?.message ?? 'Erro ao eliminar cliente.');
        }
    };

    const loadClientes = useCallback(async () => {
        try {
            const { data } = await axios.get(`${API}/api/clientes`);
            setClientes(data);
        } catch (e) {
            console.error('Erro ao carregar clientes', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadClientes(); }, [loadClientes]);

    const openNew = () => { setEditTarget(null); setModalOpen(true); };
    const openEdit = (c: Cliente) => { setDetail(null); setEditTarget(c); setModalOpen(true); };
    const closeModal = () => { setModalOpen(false); setEditTarget(null); };

    const handleSave = async (data: FormData) => {
        try {
            if (editTarget) {
                await axios.put(`${API}/api/clientes/${editTarget.id}`, data);
                showToast('Cliente actualizado com sucesso.');
            } else {
                await axios.post(`${API}/api/clientes`, data);
                showToast('Cliente criado com sucesso.');
            }
            await loadClientes();
        } catch (e) {
            console.error('Erro ao guardar cliente', e);
            showToast('Erro ao guardar cliente.');
        }
        closeModal();
    };

    const getMaquinas = (id: number) => equipInstalados.filter(e => e.clienteId === String(id)).length;
    const getOsTotal  = (id: number) => ordens.filter(o => o.clienteId === String(id)).length;

    const filtered = clientes.filter(c => {
        const q = search.toLowerCase();
        return !q || c.nome.toLowerCase().includes(q)
            || codigoCli(c.id).toLowerCase().includes(q)
            || (c.nif ?? '').includes(q);
    });

    const exportData = filtered.map(c => ({
        codigo: codigoCli(c.id),
        nome: c.nome,
        tipo: c.tipo === 'empresa' ? 'Empresa' : 'Particular',
        nif: c.nif,
        email: c.email,
        telefone: c.telefone,
        cidade: endPrincipal(c).cidade,
        maquinas: getMaquinas(c.id),
        otTotal: getOsTotal(c.id),
        estado: c.ativo ? 'Ativo' : 'Inativo',
    }));

    const EXPORT_COLS: ExportCol[] = [
        { key: 'codigo',    label: 'Código'   },
        { key: 'nome',      label: 'Nome'     },
        { key: 'tipo',      label: 'Tipo'     },
        { key: 'nif',       label: 'NIF / BI' },
        { key: 'email',     label: 'Email'    },
        { key: 'telefone',  label: 'Telefone' },
        { key: 'cidade',    label: 'Cidade'   },
        { key: 'maquinas',  label: 'Máquinas' },
        { key: 'otTotal',   label: 'OT Total' },
        { key: 'estado',    label: 'Estado'   },
    ];

    return (
        <AppLayout>
            <ActionBar title="Gestão de Clientes" breadcrumb="AQUATEX SGI · Clientes">
                <div className="actionbar-spacer" />
                <button className="abtn abtn-secondary" type="button" onClick={() => setShowExport(true)}>
                    <Download size={13} /> Exportar
                </button>
                <button id="btn-novo-cliente" className="abtn abtn-primary" type="button" onClick={openNew}>
                    <Plus size={13} /> Novo Cliente
                </button>
                <div className="actionbar-sep" />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{filtered.length} registos</span>
            </ActionBar>

            <div className="page-content">
                {/* Stats */}
                <div className="stats-row">
                    {[
                        { label: 'Total Clientes',  value: clientes.length },
                        { label: 'Empresas',        value: clientes.filter(c => c.tipo === 'empresa').length },
                        { label: 'Particulares',    value: clientes.filter(c => c.tipo === 'particular').length },
                        { label: 'Ativos',          value: clientes.filter(c => c.ativo !== false).length },
                        { label: 'Máquinas Instal.', value: equipInstalados.length },
                    ].map(s => (
                        <div key={s.label} className="stat-card">
                            <span className="stat-label">{s.label}</span>
                            <span className="stat-value blue">{s.value}</span>
                        </div>
                    ))}
                </div>

                {/* Filter */}
                <div className="filters-bar">
                    <div className="search-wrap">
                        <Search className="search-icon" />
                        <input
                            className="search-input"
                            placeholder="Pesquisar por nome, código ou NIF..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="table-container">
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Nome</th>
                                    <th>Tipo</th>
                                    <th>NIF / BI</th>
                                    <th>Cidade</th>
                                    <th>Telefone</th>
                                    <th style={{ textAlign: 'center' }}>Endereços</th>
                                    <th style={{ textAlign: 'center' }}>Máquinas</th>
                                    <th style={{ textAlign: 'center' }}>OT</th>
                                    <th style={{ textAlign: 'center' }}>Estado</th>
                                    <th style={{ width: 60 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {loading && (
                                    <tr><td colSpan={11}><div className="empty-state">A carregar...</div></td></tr>
                                )}
                                {!loading && filtered.length === 0 && (
                                    <tr><td colSpan={11}><div className="empty-state">Nenhum cliente encontrado.</div></td></tr>
                                )}
                                {filtered.map(c => {
                                    const principal = endPrincipal(c);
                                    const maquinas = getMaquinas(c.id);
                                    const otTotal = getOsTotal(c.id);
                                    return (
                                        <tr key={c.id} style={{ opacity: c.ativo === false ? 0.6 : 1 }}>
                                            <td><span className="td-link" onClick={() => setDetail(c)}>{codigoCli(c.id)}</span></td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    {c.tipo === 'empresa'
                                                        ? <Building2 size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                        : <User size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                    }
                                                    <span style={{ fontWeight: 600 }}>{c.nome}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{
                                                    fontSize: '0.7rem', padding: '2px 7px', borderRadius: 3,
                                                    fontWeight: 600, whiteSpace: 'nowrap',
                                                    ...TIPO_STYLE[c.tipo],
                                                }}>
                                                    {c.tipo === 'empresa' ? 'Empresa' : 'Particular'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{c.nif}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{principal.cidade}</td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{c.telefone}</td>
                                            <td style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                                {(c.enderecos ?? []).length}
                                            </td>
                                            <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--blue)' }}>{maquinas}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--green)' }}>{otTotal}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span style={{
                                                    fontSize: '0.68rem', padding: '2px 6px', borderRadius: 3, fontWeight: 600,
                                                    background: c.ativo !== false ? 'var(--green)' : '#e0e0e0',
                                                    color: c.ativo !== false ? '#fff' : '#666',
                                                }}>
                                                    {c.ativo !== false ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="row-actions">
                                                    <button className="icon-btn" title="Ver detalhe" onClick={() => setDetail(c)}><Eye size={12} /></button>
                                                    <button className="icon-btn" title="Editar" onClick={() => openEdit(c)}><Pencil size={12} /></button>
                                                    <button className="icon-btn icon-btn-danger" title="Eliminar" onClick={() => handleRemove(c.id, c.nome)}><Trash2 size={12} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="table-count">{filtered.length} cliente(s)</div>
                </div>
            </div>

            {/* Detail modal */}
            {detail && (
                <ClienteDetail
                    cliente={detail}
                    maquinas={getMaquinas(detail.id)}
                    osTotal={getOsTotal(detail.id)}
                    onClose={() => setDetail(null)}
                    onEdit={() => openEdit(detail)}
                />
            )}

            {/* Create / Edit modal */}
            {modalOpen && (
                <ClienteModal
                    initial={editTarget}
                    onClose={closeModal}
                    onSave={handleSave}
                />
            )}

            {/* Toast */}
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
                    title="Clientes"
                    columns={EXPORT_COLS}
                    data={exportData}
                    filename="clientes"
                    onClose={() => setShowExport(false)}
                />
            )}
        </AppLayout>
    );
};

export default ClientesPage;
