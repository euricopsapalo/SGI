import React, { useState, useEffect } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import { Search, Plus, Pencil, Eye, Phone, Mail, MapPin, Building2, User, X, Check, AlertCircle, Trash2 } from 'lucide-react';

/* ══════════════════════════════════════════
   Types
══════════════════════════════════════════ */
type TipoCliente = 'empresa' | 'particular';

export interface Endereco {
    descricao: string;
    morada: string;
    cidade: string;
    principal: boolean;
}

export interface Cliente {
    id: number; codigo: string; tipo: TipoCliente;
    nome: string; nif: string; email: string; telefone: string;
    enderecos: Endereco[];
    maquinas: number; osTotal: number; dataCriacao: string;
}

const endPrincipal = (c: Cliente): Endereco =>
    c.enderecos.find(e => e.principal) ?? c.enderecos[0];

const INIT_CLIENTES: Cliente[] = [
    {
        id: 1, codigo: 'CLI-0001', tipo: 'empresa', nome: 'Empresa Alpha, LDA', nif: '5400112233',
        email: 'geral@alpha.ao', telefone: '+244 222 300 100',
        enderecos: [{ descricao: 'Sede', morada: 'Rua da Samba, 45', cidade: 'Luanda', principal: true }],
        maquinas: 3, osTotal: 12, dataCriacao: '01/01/2024',
    },
    {
        id: 2, codigo: 'CLI-0002', tipo: 'empresa', nome: 'Hotel Marina Palace', nif: '5400223344',
        email: 'manut@marinapalace.ao', telefone: '+244 222 400 200',
        enderecos: [
            { descricao: 'Hotel Principal', morada: 'Av. Marginal, 12', cidade: 'Luanda', principal: true },
            { descricao: 'Armazém', morada: 'Zona Industrial, Bloco A', cidade: 'Viana', principal: false },
        ],
        maquinas: 5, osTotal: 28, dataCriacao: '15/02/2024',
    },
    {
        id: 3, codigo: 'CLI-0003', tipo: 'empresa', nome: 'Clínica São João', nif: '5400334455',
        email: 'admin@csj.ao', telefone: '+244 222 500 300',
        enderecos: [{ descricao: 'Sede', morada: 'Rua da Missão, 8', cidade: 'Luanda', principal: true }],
        maquinas: 2, osTotal: 9, dataCriacao: '10/03/2024',
    },
    {
        id: 4, codigo: 'CLI-0004', tipo: 'empresa', nome: 'GlobalTrade SA', nif: '5400445566',
        email: 'op@globaltrade.ao', telefone: '+244 923 100 400',
        enderecos: [{ descricao: 'Sede', morada: 'Zona Industrial 3, Bloco C', cidade: 'Viana', principal: true }],
        maquinas: 4, osTotal: 17, dataCriacao: '22/04/2024',
    },
    {
        id: 5, codigo: 'CLI-0005', tipo: 'empresa', nome: 'Escola da Nação', nif: '5400556677',
        email: 'manut@enacao.ao', telefone: '+244 912 500 500',
        enderecos: [{ descricao: 'Sede', morada: 'Av. Lenine, 200', cidade: 'Luanda', principal: true }],
        maquinas: 1, osTotal: 4, dataCriacao: '05/06/2024',
    },
    {
        id: 6, codigo: 'CLI-0006', tipo: 'empresa', nome: 'Farmácia Saúde +', nif: '5400667788',
        email: 'saude@farmaciap.ao', telefone: '+244 935 600 600',
        enderecos: [{ descricao: 'Sede', morada: 'Rua Amílcar Cabral, 77', cidade: 'Luanda', principal: true }],
        maquinas: 2, osTotal: 8, dataCriacao: '18/07/2024',
    },
    {
        id: 7, codigo: 'CLI-0007', tipo: 'empresa', nome: 'Residencial Vista Mar', nif: '5400778899',
        email: 'maint@vistamar.ao', telefone: '+244 946 700 700',
        enderecos: [{ descricao: 'Sede', morada: 'Ilha do Cabo, Lote 9', cidade: 'Luanda', principal: true }],
        maquinas: 6, osTotal: 31, dataCriacao: '30/08/2024',
    },
    {
        id: 8, codigo: 'CLI-0008', tipo: 'particular', nome: 'António Ferreira', nif: '004123456789LA',
        email: 'tec@maxi.ao', telefone: '+244 921 800 800',
        enderecos: [
            { descricao: 'Casa', morada: 'Estrada de Catete, km 5', cidade: 'Cacuaco', principal: true },
            { descricao: 'Escritório', morada: 'Av. 4 de Fevereiro, 22', cidade: 'Luanda', principal: false },
        ],
        maquinas: 3, osTotal: 11, dataCriacao: '12/09/2024',
    },
    {
        id: 9, codigo: 'CLI-0009', tipo: 'empresa', nome: 'MINSA — Direcção Luanda', nif: '5400990011',
        email: 'tec@minsa.gov.ao', telefone: '+244 222 900 900',
        enderecos: [
            { descricao: 'Direcção Provincial', morada: 'Av. Hoji Ya Henda, 1', cidade: 'Luanda', principal: true },
            { descricao: 'Unidade Satélite', morada: 'Rua da Paz, 34', cidade: 'Luanda', principal: false },
        ],
        maquinas: 8, osTotal: 45, dataCriacao: '01/10/2024',
    },
    {
        id: 10, codigo: 'CLI-0010', tipo: 'empresa', nome: 'Petro Servicing Angola', nif: '5401101122',
        email: 'manut@petroservice.ao', telefone: '+244 923 010 010',
        enderecos: [
            { descricao: 'Escritório', morada: 'Zona Industrial Viana, Lote 12', cidade: 'Viana', principal: true },
            { descricao: 'Armazém', morada: 'Estrada Lobito, km 3', cidade: 'Luanda', principal: false },
        ],
        maquinas: 7, osTotal: 33, dataCriacao: '15/11/2024',
    },
];

/* ══════════════════════════════════════════
   Form types
══════════════════════════════════════════ */
type ScalarField = 'nome' | 'nif' | 'email' | 'telefone';
type FormErrors = Partial<Record<ScalarField, string>>;
type EndErrors = Array<{ morada?: string; cidade?: string }>;

type FormData = {
    tipo: TipoCliente;
    nome: string; nif: string; email: string; telefone: string;
    enderecos: Endereco[];
};

const BLANK_END: Endereco = { descricao: '', morada: '', cidade: '', principal: true };
const BLANK: FormData = { tipo: 'empresa', nome: '', nif: '', email: '', telefone: '', enderecos: [{ ...BLANK_END }] };

/* ══════════════════════════════════════════
   Field — módulo-level para evitar perda de foco
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
    const [form, setForm] = useState<FormData>(BLANK);
    const [errors, setErrors] = useState<FormErrors>({});
    const [endErrors, setEndErrors] = useState<EndErrors>([]);

    useEffect(() => {
        if (initial) {
            setForm({
                tipo: initial.tipo, nome: initial.nome, nif: initial.nif,
                email: initial.email, telefone: initial.telefone,
                enderecos: initial.enderecos.map(e => ({ ...e })),
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
                                    {/* Cabeçalho do endereço */}
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

                                    {/* Morada + Cidade */}
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
interface DetailProps { cliente: Cliente; onClose: () => void; onEdit: () => void; }

const TIPO_STYLE: Record<TipoCliente, React.CSSProperties> = {
    empresa: { background: 'var(--blue)', color: '#fff' },
    particular: { background: 'var(--green)', color: '#fff' },
};

const ClienteDetail: React.FC<DetailProps> = ({ cliente, onClose, onEdit }) => {
    const principal = endPrincipal(cliente);
    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 560 }}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <h3 className="modal-title" style={{ margin: 0 }}>{cliente.codigo} — {cliente.nome}</h3>
                        <span style={{ fontSize: '0.7rem', padding: '1px 7px', borderRadius: 3, fontWeight: 600, flexShrink: 0, ...TIPO_STYLE[cliente.tipo] }}>
                            {cliente.tipo === 'empresa' ? 'Empresa' : 'Particular'}
                        </span>
                    </div>
                    <button className="modal-close" onClick={onClose} type="button"><X size={13} /></button>
                </div>

                <div className="modal-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className="form-group">
                            <label className="form-label">{cliente.tipo === 'empresa' ? 'NIF' : 'BI / NIF'}</label>
                            <div style={{ padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 3, fontSize: '0.82rem' }}>{cliente.nif}</div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Cidade Principal</label>
                            <div style={{ padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 3, fontSize: '0.82rem' }}>{principal.cidade}</div>
                        </div>
                    </div>

                    {/* Endereços */}
                    <div className="form-group">
                        <label className="form-label">Endereços ({cliente.enderecos.length})</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {cliente.enderecos.map((en, i) => (
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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 8 }}>
                        {[
                            { label: 'Máquinas Instaladas', value: cliente.maquinas, color: 'var(--blue)' },
                            { label: 'OS Realizadas', value: cliente.osTotal, color: 'var(--green)' },
                            { label: 'Cliente desde', value: cliente.dataCriacao, color: 'var(--text-secondary)', sm: true },
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
    const [clientes, setClientes] = useState<Cliente[]>(INIT_CLIENTES);
    const [search, setSearch] = useState('');
    const [detail, setDetail] = useState<Cliente | null>(null);
    const [editTarget, setEditTarget] = useState<Cliente | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [toast, setToast] = useState('');

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    const openNew = () => { setEditTarget(null); setModalOpen(true); };
    const openEdit = (c: Cliente) => { setDetail(null); setEditTarget(c); setModalOpen(true); };
    const closeModal = () => { setModalOpen(false); setEditTarget(null); };

    const handleSave = (data: FormData) => {
        if (editTarget) {
            setClientes(prev => prev.map(c => c.id === editTarget.id ? { ...c, ...data } : c));
            showToast('Cliente actualizado com sucesso.');
        } else {
            const nextId = Math.max(...clientes.map(c => c.id)) + 1;
            const codigo = `CLI-${String(nextId).padStart(4, '0')}`;
            const today = new Date().toLocaleDateString('pt-PT');
            setClientes(prev => [{ ...data, id: nextId, codigo, maquinas: 0, osTotal: 0, dataCriacao: today }, ...prev]);
            showToast('Cliente criado com sucesso.');
        }
        closeModal();
    };

    const filtered = clientes.filter(c => {
        const q = search.toLowerCase();
        return !q || c.nome.toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q) || c.nif.includes(q);
    });

    return (
        <AppLayout>
            <ActionBar title="Gestão de Clientes" breadcrumb="AQUATEX SGI · Clientes">
                <div className="actionbar-spacer" />
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
                        { label: 'Total Clientes', value: clientes.length },
                        { label: 'Empresas', value: clientes.filter(c => c.tipo === 'empresa').length },
                        { label: 'Particulares', value: clientes.filter(c => c.tipo === 'particular').length },
                        { label: 'Máquinas Instaladas', value: clientes.reduce((s, c) => s + c.maquinas, 0) },
                        { label: 'OS Realizadas (total)', value: clientes.reduce((s, c) => s + c.osTotal, 0) },
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
                                    <th style={{ textAlign: 'center' }}>OS</th>
                                    <th>Desde</th>
                                    <th style={{ width: 60 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr><td colSpan={11}><div className="empty-state">Nenhum cliente encontrado.</div></td></tr>
                                )}
                                {filtered.map(c => {
                                    const principal = endPrincipal(c);
                                    return (
                                        <tr key={c.id}>
                                            <td><span className="td-link" onClick={() => setDetail(c)}>{c.codigo}</span></td>
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
                                                {c.enderecos.length}
                                            </td>
                                            <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--blue)' }}>{c.maquinas}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--green)' }}>{c.osTotal}</td>
                                            <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{c.dataCriacao}</td>
                                            <td>
                                                <div className="row-actions">
                                                    <button className="icon-btn" title="Ver detalhe" onClick={() => setDetail(c)}><Eye size={12} /></button>
                                                    <button className="icon-btn" title="Editar" onClick={() => openEdit(c)}><Pencil size={12} /></button>
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
        </AppLayout>
    );
};

export default ClientesPage;
