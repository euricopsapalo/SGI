import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import ExportModal, { ExportCol } from '../../components/ExportModal';
import { Search, Plus, Pencil, Eye, Phone, Mail, MapPin, Building2, User, X, Check, AlertCircle, Trash2, Download, Printer } from 'lucide-react';
import SearchableSelect from '../../components/SearchableSelect';
import api from '../../services/api';
import { useGlobal, EquipInstalado, OrdemTrabalho, ModeloEquipamento } from '../../contexts/GlobalContext';

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
    condicaoPagamentoId?: string;
    modoPagamentoId?: string;
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
    condicaoPagamentoId?: string;
    modoPagamentoId?: string;
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
    const { provincias, municipios, condicoesPagamento, modosPagamento } = useGlobal();
    const [tab, setTab] = useState<'geral' | 'comercial'>('geral');
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
                condicaoPagamentoId: initial.condicaoPagamentoId ?? '',
                modoPagamentoId: initial.modoPagamentoId ?? '',
            });
        } else {
            setForm({ ...BLANK, enderecos: [{ ...BLANK_END }] });
        }
        setTab('geral');
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
                <div className="modal-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
                    {(['geral', 'comercial'] as const).map(t => (
                        <button key={t} type="button" onClick={() => setTab(t)}
                            style={{ padding: '8px 14px', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer', borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent', color: tab === t ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: tab === t ? 600 : 400 }}>
                            {t === 'geral' ? 'Dados Gerais' : 'Dados Comerciais'}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} noValidate>
                    <div className="modal-body">

                        {tab === 'comercial' && <>
                            <div className="form-group">
                                <label className="form-label">Condição de Pagamento</label>
                                <select className="form-select" value={form.condicaoPagamentoId ?? ''}
                                    onChange={e => setForm(p => ({ ...p, condicaoPagamentoId: e.target.value }))}>
                                    <option value="">Seleccionar...</option>
                                    {condicoesPagamento.map(c => <option key={c.id} value={c.id}>{c.descricao}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Modo de Pagamento</label>
                                <select className="form-select" value={form.modoPagamentoId ?? ''}
                                    onChange={e => setForm(p => ({ ...p, modoPagamentoId: e.target.value }))}>
                                    <option value="">Seleccionar...</option>
                                    {modosPagamento.map(m => <option key={m.id} value={m.id}>{m.movimento} — {m.descricao}</option>)}
                                </select>
                            </div>
                        </>}

                        {tab === 'geral' && <>
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
                        </>}

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
   RELATÓRIOS DE CLIENTES
══════════════════════════════════════════ */

const RC_CSS = `
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
  .lbl   { background: #f5f5f5 !important; font-weight: 600; color: #444; white-space: nowrap; }
  .cli-block { border: 1px solid #ddd; border-radius: 3px; padding: 10px 12px; margin-bottom: 14px; page-break-inside: avoid; }
  .cli-name  { font-size: 0.88rem; font-weight: 700; margin-bottom: 4px; }
  .footer { margin-top: 18px; font-size: 0.62rem; color: #bbb; text-align: center; border-top: 1px solid #eee; padding-top: 5px; }
  .green { color: #16a34a; } .orange { color: #f97316; } .red { color: #dc2626; } .gray { color: #6b7280; }
  @page { size: A4; margin: 0; }
`;

function fRC(d?: string) { return d ? new Date(d).toLocaleDateString('pt-PT') : '—'; }
function otCorRC(estado: string) {
    if (estado === 'Finalizada')  return '#16a34a';
    if (estado === 'Em execução') return '#eab308';
    if (estado === 'Adiada')      return '#f97316';
    if (estado === 'Confirmada')  return '#7c3aed';
    if (estado === 'Registada')   return '#6b7280';
    return '#2563eb';
}
function proxManutRC(equipId: string, ordens: OrdemTrabalho[]) {
    const dates = ordens
        .filter(o => String(o.equipInstaladoId) === String(equipId) && o.estado !== 'Finalizada')
        .map(o => o.dataAgendada).filter(Boolean) as string[];
    return dates.length > 0 ? [...dates].sort()[0] : undefined;
}
function ultimaIntRC(clienteId: string | number, ordens: OrdemTrabalho[]) {
    const dates = ordens
        .filter(o => String(o.clienteId) === String(clienteId))
        .map(o => o.dataFim || o.dataAgendada || '').filter(Boolean).sort();
    return dates.at(-1);
}
function openPrint(html: string) {
    const w = window.open('', '_blank', 'width=1000,height=900');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
}

/* 1. Ficha de Cliente */
function buildFichaClienteHtml(
    c: Cliente,
    equips: EquipInstalado[],
    ordens: OrdemTrabalho[],
    modelosEquipamento: ModeloEquipamento[],
    empresa: string,
): string {
    const end = endPrincipal(c);
    const cliEquips = equips.filter(e => String(e.clienteId) === String(c.id));
    const cliOTs    = ordens.filter(o => String(o.clienteId) === String(c.id))
        .sort((a, b) => (b.dataAgendada || '').localeCompare(a.dataAgendada || ''));

    const equipRows = cliEquips.map(e => {
        const mod   = modelosEquipamento.find(m => String(m.id) === String(e.modeloId));
        const prox  = proxManutRC(e.id, ordens);
        const dias  = prox ? Math.ceil((new Date(prox).getTime() - Date.now()) / 86400000) : null;
        const dCor  = dias === null ? '' : dias < 0 ? 'color:#dc2626' : dias <= 7 ? 'color:#dc2626' : dias <= 30 ? 'color:#f97316' : '';
        return `<tr>
          <td style="font-family:monospace">${e.id}</td>
          <td>${mod?.nome ?? '—'}</td>
          <td>${mod?.tipo === 'maquina' ? 'Máquina' : 'Filtro'}</td>
          <td style="font-family:monospace">${e.nrSerie}</td>
          <td>${e.localizacao || '—'}</td>
          <td style="color:${e.estado === 'ativo' ? '#16a34a' : e.estado === 'com_problema' ? '#f97316' : '#6b7280'};font-weight:600">${e.estado === 'ativo' ? 'Activo' : e.estado === 'com_problema' ? 'Com Problema' : 'Inactivo'}</td>
          <td style="${dCor}">${fRC(prox)}${dias !== null ? ` (${dias >= 0 ? '+' : ''}${dias}d)` : ''}</td>
        </tr>`;
    }).join('');

    const otRows = cliOTs.slice(0, 20).map(o => `<tr>
      <td style="font-family:monospace">${o.id}</td>
      <td>${o.tipo === 'pontual' ? 'Pontual' : 'Programada'}</td>
      <td>${o.naturezaIntervencao ?? "—"}</td>
      <td style="color:${otCorRC(o.estado)};font-weight:600">${o.estado}</td>
      <td>${fRC(o.dataAgendada)}</td>
      <td>${fRC(o.dataFim)}</td>
      <td>${o.responsavel || '—'}</td>
    </tr>`).join('');

    return `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>Ficha ${codigoCli(c.id)}</title>
<style>${RC_CSS}</style></head><body>
<div class="hrow">
  <div><h1>${empresa} — Ficha de Cliente</h1>
  <div class="sub">Código: <strong>${codigoCli(c.id)}</strong> &nbsp;|&nbsp; Impresso em ${new Date().toLocaleString('pt-PT')}</div></div>
  <span class="badge">${c.ativo !== false ? 'Ativo' : 'Inativo'}</span>
</div>
<div class="sec">Dados do Cliente</div>
<table><tbody>
  <tr><td class="lbl">Nome</td><td>${c.nome}</td><td class="lbl">Tipo</td><td>${c.tipo === 'empresa' ? 'Empresa' : 'Particular'}</td></tr>
  <tr><td class="lbl">NIF / BI</td><td>${c.nif || '—'}</td><td class="lbl">Email</td><td>${c.email || '—'}</td></tr>
  <tr><td class="lbl">Telefone</td><td>${c.telefone || '—'}</td><td class="lbl">Morada</td><td>${end.morada || '—'}, ${end.cidade || '—'}</td></tr>
</tbody></table>
${cliEquips.length > 0 ? `
<div class="sec">Equipamentos Instalados (${cliEquips.length})</div>
<table><thead><tr><th>ID</th><th>Modelo</th><th>Tipo</th><th>Série</th><th>Localização</th><th>Estado</th><th>Próxima Manut.</th></tr></thead>
<tbody>${equipRows}</tbody></table>` : '<div class="sec">Equipamentos Instalados</div><p style="color:#999;font-size:0.78rem">Nenhum equipamento instalado.</p>'}
${cliOTs.length > 0 ? `
<div class="sec">Histórico de OTs (${cliOTs.length}${cliOTs.length > 20 ? ' — últimas 20' : ''})</div>
<table><thead><tr><th>ID</th><th>Tipo OT</th><th>Tipo Trabalho</th><th>Estado</th><th>Data Prog.</th><th>Data Fim</th><th>Responsável</th></tr></thead>
<tbody>${otRows}</tbody></table>` : '<div class="sec">Histórico de OTs</div><p style="color:#999;font-size:0.78rem">Sem ordens de trabalho.</p>'}
<div class="footer">${empresa} &nbsp;&bull;&nbsp; ${codigoCli(c.id)} — ${c.nome}</div>
</body></html>`;
}

function printFichaCliente(
    c: Cliente,
    equips: EquipInstalado[],
    ordens: OrdemTrabalho[],
    modelosEquipamento: ModeloEquipamento[],
    empresa: string,
) {
    openPrint(buildFichaClienteHtml(c, equips, ordens, modelosEquipamento, empresa));
}

/* 2. Clientes por Estado */
function buildClientesPorEstadoHtml(
    clientes: Cliente[],
    ordens: OrdemTrabalho[],
    equips: EquipInstalado[],
    empresa: string,
): string {
    const mkRow = (c: Cliente) => {
        const ultima = ultimaIntRC(c.id, ordens);
        const nEquips = equips.filter(e => String(e.clienteId) === String(c.id)).length;
        const nOTs    = ordens.filter(o => String(o.clienteId) === String(c.id)).length;
        return `<tr>
          <td style="font-family:monospace">${codigoCli(c.id)}</td>
          <td style="font-weight:600">${c.nome}</td>
          <td>${c.tipo === 'empresa' ? 'Empresa' : 'Particular'}</td>
          <td>${c.nif || '—'}</td>
          <td>${c.telefone || '—'}</td>
          <td style="text-align:center">${nEquips}</td>
          <td style="text-align:center">${nOTs}</td>
          <td>${fRC(ultima)}</td>
        </tr>`;
    };
    const ativos   = clientes.filter(c => c.ativo !== false);
    const inativos = clientes.filter(c => c.ativo === false);

    return `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>Clientes por Estado</title>
<style>${RC_CSS}</style></head><body>
<div class="hrow">
  <div><h1>${empresa} — Clientes por Estado</h1>
  <div class="sub">Total: ${clientes.length} clientes &nbsp;|&nbsp; Impresso em ${new Date().toLocaleString('pt-PT')}</div></div>
</div>
<div class="sec">Clientes Ativos (${ativos.length})</div>
<table><thead><tr><th>Código</th><th>Nome</th><th>Tipo</th><th>NIF/BI</th><th>Telefone</th><th>Equip.</th><th>OTs</th><th>Última Interação</th></tr></thead>
<tbody>${ativos.map(mkRow).join('')}</tbody></table>
${inativos.length > 0 ? `
<div class="sec">Clientes Inativos (${inativos.length})</div>
<table><thead><tr><th>Código</th><th>Nome</th><th>Tipo</th><th>NIF/BI</th><th>Telefone</th><th>Equip.</th><th>OTs</th><th>Última Interação</th></tr></thead>
<tbody>${inativos.map(mkRow).join('')}</tbody></table>` : ''}
<div class="footer">${empresa} &nbsp;&bull;&nbsp; Sistema de Gestão de Intervenções</div>
</body></html>`;
}

function printClientesPorEstado(
    clientes: Cliente[],
    ordens: OrdemTrabalho[],
    equips: EquipInstalado[],
    empresa: string,
) {
    openPrint(buildClientesPorEstadoHtml(clientes, ordens, equips, empresa));
}

/* 3. Clientes sem Atividade */
function buildClientesSemAtividadeHtml(
    clientes: Cliente[],
    ordens: OrdemTrabalho[],
    dateFrom: string,
    dateTo: string,
    empresa: string,
): string {
    const refDate = (o: OrdemTrabalho) => o.dataAgendada || '';
    const semAtiv = clientes.filter(c => c.ativo !== false).filter(c => {
        const cOTs = ordens.filter(o => String(o.clienteId) === String(c.id));
        const inPeriod = cOTs.filter(o => {
            const d = refDate(o);
            return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
        });
        return inPeriod.length === 0;
    });

    const rows = semAtiv.map(c => {
        const ultima = ultimaIntRC(c.id, ordens);
        const nOTs   = ordens.filter(o => String(o.clienteId) === String(c.id)).length;
        return `<tr>
          <td style="font-family:monospace">${codigoCli(c.id)}</td>
          <td style="font-weight:600">${c.nome}</td>
          <td>${c.tipo === 'empresa' ? 'Empresa' : 'Particular'}</td>
          <td>${c.nif || '—'}</td>
          <td>${c.telefone || '—'}</td>
          <td>${c.email || '—'}</td>
          <td style="text-align:center">${nOTs}</td>
          <td style="color:${ultima ? '#f97316' : '#dc2626'}">${fRC(ultima)}</td>
        </tr>`;
    }).join('');

    const periodo = dateFrom || dateTo
        ? `${dateFrom ? fRC(dateFrom) : '—'} a ${dateTo ? fRC(dateTo) : '—'}`
        : 'Período não definido';

    return `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>Clientes sem Atividade</title>
<style>${RC_CSS}</style></head><body>
<div class="hrow">
  <div><h1>${empresa} — Clientes sem Atividade</h1>
  <div class="sub">Período: ${periodo} &nbsp;|&nbsp; ${semAtiv.length} cliente(s) sem OT &nbsp;|&nbsp; Impresso em ${new Date().toLocaleString('pt-PT')}</div></div>
  <span class="badge">${semAtiv.length} / ${clientes.filter(c => c.ativo !== false).length} ativos</span>
</div>
${rows ? `<table><thead><tr><th>Código</th><th>Nome</th><th>Tipo</th><th>NIF/BI</th><th>Telefone</th><th>Email</th><th>Total OTs</th><th>Última Interação</th></tr></thead>
<tbody>${rows}</tbody></table>` : '<p style="color:#999;text-align:center;padding:20px">Todos os clientes têm atividade no período seleccionado.</p>'}
<div class="footer">${empresa} &nbsp;&bull;&nbsp; Sistema de Gestão de Intervenções</div>
</body></html>`;
}

function printClientesSemAtividade(
    clientes: Cliente[],
    ordens: OrdemTrabalho[],
    dateFrom: string,
    dateTo: string,
    empresa: string,
) {
    openPrint(buildClientesSemAtividadeHtml(clientes, ordens, dateFrom, dateTo, empresa));
}

/* 4. Equipamentos por Cliente */
function buildEquipamentosPorClienteHtml(
    clientes: Cliente[],
    equips: EquipInstalado[],
    ordens: OrdemTrabalho[],
    modelosEquipamento: ModeloEquipamento[],
    empresa: string,
): string {
    const comEquips = clientes.filter(c => equips.some(e => String(e.clienteId) === String(c.id)));
    let body = '';
    for (const c of comEquips) {
        const cEquips = equips.filter(e => String(e.clienteId) === String(c.id));
        const rows = cEquips.map(e => {
            const mod  = modelosEquipamento.find(m => String(m.id) === String(e.modeloId));
            const prox = proxManutRC(e.id, ordens);
            const dias = prox ? Math.ceil((new Date(prox).getTime() - Date.now()) / 86400000) : null;
            const dCor = dias === null ? '' : dias < 0 ? 'color:#dc2626' : dias <= 7 ? 'color:#dc2626' : dias <= 30 ? 'color:#f97316' : '';
            return `<tr>
              <td style="font-family:monospace">${e.id}</td>
              <td>${mod?.nome ?? '—'}</td>
              <td>${mod?.tipo === 'maquina' ? 'Máquina' : 'Filtro'}</td>
              <td style="font-family:monospace">${e.nrSerie}</td>
              <td>${e.localizacao || '—'}</td>
              <td>${fRC(e.dataInstalacao)}</td>
              <td style="color:${e.estado === 'ativo' ? '#16a34a' : e.estado === 'com_problema' ? '#f97316' : '#6b7280'};font-weight:600">${e.estado === 'ativo' ? 'Activo' : e.estado === 'com_problema' ? 'Com Problema' : 'Inactivo'}</td>
              <td style="${dCor}">${fRC(prox)}${dias !== null ? ` (${dias >= 0 ? '+' : ''}${dias}d)` : ''}</td>
            </tr>`;
        }).join('');
        body += `<div style="margin-bottom:16px;page-break-inside:avoid">
  <div class="sec">${codigoCli(c.id)} — ${c.nome} &nbsp;<span style="font-weight:400;font-size:0.72rem;color:#888">${c.telefone || ''}</span></div>
  <table><thead><tr><th>ID</th><th>Modelo</th><th>Tipo</th><th>Série</th><th>Localização</th><th>Instalação</th><th>Estado</th><th>Próxima Manut.</th></tr></thead>
  <tbody>${rows}</tbody></table>
</div>`;
    }

    return `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>Equipamentos por Cliente</title>
<style>${RC_CSS}</style></head><body>
<div class="hrow">
  <div><h1>${empresa} — Equipamentos por Cliente</h1>
  <div class="sub">${equips.length} equipamento(s) em ${comEquips.length} cliente(s) &nbsp;|&nbsp; Impresso em ${new Date().toLocaleString('pt-PT')}</div></div>
</div>
${body || '<p style="color:#999;text-align:center">Nenhum equipamento instalado.</p>'}
<div class="footer">${empresa} &nbsp;&bull;&nbsp; Sistema de Gestão de Intervenções</div>
</body></html>`;
}

function printEquipamentosPorCliente(
    clientes: Cliente[],
    equips: EquipInstalado[],
    ordens: OrdemTrabalho[],
    modelosEquipamento: ModeloEquipamento[],
    empresa: string,
) {
    openPrint(buildEquipamentosPorClienteHtml(clientes, equips, ordens, modelosEquipamento, empresa));
}

/* 5. Histórico de Intervenções por Cliente */
function buildHistoricoIntervClienteHtml(
    clientes: Cliente[],
    ordens: OrdemTrabalho[],
    equips: EquipInstalado[],
    modelosEquipamento: ModeloEquipamento[],
    dateFrom: string,
    dateTo: string,
    empresa: string,
): string {
    const refDate = (o: OrdemTrabalho) => o.dataAgendada || '';
    const filtOTs = ordens.filter(o => {
        const d = refDate(o);
        return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
    });
    const comOTs = clientes.filter(c => filtOTs.some(o => String(o.clienteId) === String(c.id)));
    let body = '';
    for (const c of comOTs) {
        const cOTs = filtOTs.filter(o => String(o.clienteId) === String(c.id))
            .sort((a, b) => refDate(b).localeCompare(refDate(a)));
        const rows = cOTs.map(o => {
            const eq  = equips.find(e => String(e.id) === String(o.equipInstaladoId));
            const mod = modelosEquipamento.find(m => String(m.id) === String(eq?.modeloId));
            return `<tr>
              <td style="font-family:monospace">${o.id}</td>
              <td>${mod?.nome ?? '—'}</td>
              <td>${o.tipo === 'pontual' ? 'Pontual' : 'Programada'}</td>
              <td>${o.naturezaIntervencao ?? "—"}</td>
              <td style="color:${otCorRC(o.estado)};font-weight:600">${o.estado}</td>
              <td>${fRC(refDate(o))}</td>
              <td>${fRC(o.dataFim)}</td>
              <td>${o.responsavel || '—'}</td>
            </tr>`;
        }).join('');
        body += `<div style="margin-bottom:16px;page-break-inside:avoid">
  <div class="sec">${codigoCli(c.id)} — ${c.nome} &nbsp;<span style="font-weight:400;font-size:0.72rem;color:#888">${cOTs.length} OT(s)</span></div>
  <table><thead><tr><th>ID OT</th><th>Equipamento</th><th>Tipo OT</th><th>Tipo Trabalho</th><th>Estado</th><th>Data Prog.</th><th>Data Fim</th><th>Responsável</th></tr></thead>
  <tbody>${rows}</tbody></table>
</div>`;
    }

    const periodo = dateFrom || dateTo
        ? `Período: ${dateFrom ? fRC(dateFrom) : '—'} a ${dateTo ? fRC(dateTo) : '—'}`
        : 'Todos os períodos';

    return `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>Histórico de Intervenções por Cliente</title>
<style>${RC_CSS}</style></head><body>
<div class="hrow">
  <div><h1>${empresa} — Histórico de Intervenções por Cliente</h1>
  <div class="sub">${periodo} &nbsp;|&nbsp; ${filtOTs.length} OT(s) &nbsp;|&nbsp; Impresso em ${new Date().toLocaleString('pt-PT')}</div></div>
</div>
${body || '<p style="color:#999;text-align:center">Nenhuma intervenção encontrada.</p>'}
<div class="footer">${empresa} &nbsp;&bull;&nbsp; Sistema de Gestão de Intervenções</div>
</body></html>`;
}

function printHistoricoIntervCliente(
    clientes: Cliente[],
    ordens: OrdemTrabalho[],
    equips: EquipInstalado[],
    modelosEquipamento: ModeloEquipamento[],
    dateFrom: string,
    dateTo: string,
    empresa: string,
) {
    openPrint(buildHistoricoIntervClienteHtml(clientes, ordens, equips, modelosEquipamento, dateFrom, dateTo, empresa));
}

/* 6. Manutenções Pendentes por Cliente */
function buildManutencoesPendentesHtml(
    clientes: Cliente[],
    equips: EquipInstalado[],
    ordens: OrdemTrabalho[],
    modelosEquipamento: ModeloEquipamento[],
    thresholdDays: number,
    empresa: string,
): string {
    const now = Date.now();
    type EqStat = { eq: EquipInstalado; prox?: string; dias: number | null; mod?: ModeloEquipamento };
    const pendentes: Array<{ c: Cliente; items: EqStat[] }> = [];

    for (const c of clientes.filter(cl => cl.ativo !== false)) {
        const cEquips = equips.filter(e => String(e.clienteId) === String(c.id) && e.estado !== 'inativo');
        const items: EqStat[] = cEquips.map(e => {
            const prox = proxManutRC(e.id, ordens);
            const dias = prox ? Math.ceil((new Date(prox).getTime() - now) / 86400000) : null;
            const mod  = modelosEquipamento.find(m => String(m.id) === String(e.modeloId));
            return { eq: e, prox, dias, mod };
        }).filter(s => {
            if (s.dias === null) return false;
            if (thresholdDays === 0) return s.dias < 0; // only overdue
            return s.dias <= thresholdDays;
        }).sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0));
        if (items.length > 0) pendentes.push({ c, items });
    }

    let body = '';
    for (const { c, items } of pendentes) {
        const rows = items.map(s => {
            const dCor = s.dias !== null && s.dias < 0 ? 'color:#dc2626;font-weight:700'
                       : s.dias !== null && s.dias <= 7 ? 'color:#dc2626;font-weight:700'
                       : 'color:#f97316;font-weight:700';
            const diasStr = s.dias === null ? '—'
                : s.dias < 0 ? `Atrasada ${Math.abs(s.dias)}d` : `+${s.dias}d`;
            return `<tr>
              <td style="font-family:monospace">${s.eq.id}</td>
              <td>${s.mod?.nome ?? '—'}</td>
              <td style="font-family:monospace">${s.eq.nrSerie}</td>
              <td>${s.eq.localizacao || '—'}</td>
              <td style="color:${s.eq.estado === 'com_problema' ? '#f97316' : '#16a34a'};font-weight:600">${s.eq.estado === 'com_problema' ? 'Com Problema' : 'Activo'}</td>
              <td>${fRC(s.prox)}</td>
              <td style="${dCor}">${diasStr}</td>
            </tr>`;
        }).join('');
        body += `<div style="margin-bottom:16px;page-break-inside:avoid">
  <div class="sec">${codigoCli(c.id)} — ${c.nome}</div>
  <table><thead><tr><th>ID Equip.</th><th>Modelo</th><th>Série</th><th>Localização</th><th>Estado</th><th>Próxima Manut.</th><th>Prazo</th></tr></thead>
  <tbody>${rows}</tbody></table>
</div>`;
    }

    const threshStr = thresholdDays === 0 ? 'Apenas em atraso' : thresholdDays === 9999 ? 'Todas as pendentes' : `Próximos ${thresholdDays} dias`;

    return `<!DOCTYPE html>
<html lang="pt"><head><meta charset="UTF-8"><title>Manutenções Pendentes por Cliente</title>
<style>${RC_CSS}</style></head><body>
<div class="hrow">
  <div><h1>${empresa} — Manutenções Pendentes por Cliente</h1>
  <div class="sub">${threshStr} &nbsp;|&nbsp; ${pendentes.length} cliente(s) com pendências &nbsp;|&nbsp; Impresso em ${new Date().toLocaleString('pt-PT')}</div></div>
</div>
${body || '<p style="color:#999;text-align:center;padding:20px">Nenhuma manutenção pendente no critério seleccionado.</p>'}
<div class="footer">${empresa} &nbsp;&bull;&nbsp; Sistema de Gestão de Intervenções</div>
</body></html>`;
}

function printManutencoesPendentes(
    clientes: Cliente[],
    equips: EquipInstalado[],
    ordens: OrdemTrabalho[],
    modelosEquipamento: ModeloEquipamento[],
    thresholdDays: number,
    empresa: string,
) {
    openPrint(buildManutencoesPendentesHtml(clientes, equips, ordens, modelosEquipamento, thresholdDays, empresa));
}

/* ── Modal de Seleção de Relatório ── */
type RelatCliType = 'ficha' | 'estado' | 'sem_atividade' | 'equip_cliente' | 'historico' | 'manut_pendentes';

const RELAT_CLI_OPTS: Array<{ id: RelatCliType; label: string; sub: string }> = [
    { id: 'ficha',           label: 'Ficha de Cliente',                      sub: 'Resumo completo: dados, equipamentos instalados e histórico de OTs' },
    { id: 'estado',          label: 'Clientes por Estado',                   sub: 'Ativos vs. inativos com data de última interação' },
    { id: 'sem_atividade',   label: 'Clientes sem Atividade',                sub: 'Clientes sem OT num período definido (útil para retenção)' },
    { id: 'equip_cliente',   label: 'Equipamentos por Cliente',              sub: 'Parque instalado por cliente com estado e próxima manutenção' },
    { id: 'historico',       label: 'Histórico de Intervenções por Cliente', sub: 'Todas as OTs realizadas com datas, tipo e responsável' },
    { id: 'manut_pendentes', label: 'Manutenções Pendentes por Cliente',     sub: 'Equipamentos com manutenção em atraso ou próxima' },
];

interface RelatoriosClienteModalProps {
    clientes: Cliente[];
    onClose: () => void;
}
const RelatoriosClienteModal: React.FC<RelatoriosClienteModalProps> = ({ clientes, onClose }) => {
    const { equipInstalados, ordens, modelosEquipamento, empresaConfig } = useGlobal();
    const empresa = empresaConfig?.nome || 'AQUATEX';

    const [tipo,       setTipo]       = useState<RelatCliType>('ficha');
    const [clienteId,  setClienteId]  = useState('');
    const [dateFrom,   setDateFrom]   = useState('');
    const [dateTo,     setDateTo]     = useState('');
    const [threshold,  setThreshold]  = useState(30);
    const [previewHtml, setPreviewHtml] = useState('');

    const clienteOpts = clientes.map(c => ({ value: String(c.id), label: c.nome, sub: codigoCli(c.id) }));

    const canPrint = tipo !== 'ficha' || !!clienteId;

    const buildHtml = (): string => {
        const empresa2 = empresa;
        if (tipo === 'ficha') {
            const c = clientes.find(cl => String(cl.id) === clienteId);
            if (!c) return '';
            return buildFichaClienteHtml(c, equipInstalados, ordens, modelosEquipamento, empresa2);
        } else if (tipo === 'estado') {
            return buildClientesPorEstadoHtml(clientes, ordens, equipInstalados, empresa2);
        } else if (tipo === 'sem_atividade') {
            return buildClientesSemAtividadeHtml(clientes, ordens, dateFrom, dateTo, empresa2);
        } else if (tipo === 'equip_cliente') {
            return buildEquipamentosPorClienteHtml(clientes, equipInstalados, ordens, modelosEquipamento, empresa2);
        } else if (tipo === 'historico') {
            return buildHistoricoIntervClienteHtml(clientes, ordens, equipInstalados, modelosEquipamento, dateFrom, dateTo, empresa2);
        } else if (tipo === 'manut_pendentes') {
            return buildManutencoesPendentesHtml(clientes, equipInstalados, ordens, modelosEquipamento, threshold, empresa2);
        }
        return '';
    };

    const handlePrint = () => {
        const empresa2 = empresa;
        if (tipo === 'ficha') {
            const c = clientes.find(cl => String(cl.id) === clienteId);
            if (!c) return;
            printFichaCliente(c, equipInstalados, ordens, modelosEquipamento, empresa2);
        } else if (tipo === 'estado') {
            printClientesPorEstado(clientes, ordens, equipInstalados, empresa2);
        } else if (tipo === 'sem_atividade') {
            printClientesSemAtividade(clientes, ordens, dateFrom, dateTo, empresa2);
        } else if (tipo === 'equip_cliente') {
            printEquipamentosPorCliente(clientes, equipInstalados, ordens, modelosEquipamento, empresa2);
        } else if (tipo === 'historico') {
            printHistoricoIntervCliente(clientes, ordens, equipInstalados, modelosEquipamento, dateFrom, dateTo, empresa2);
        } else if (tipo === 'manut_pendentes') {
            printManutencoesPendentes(clientes, equipInstalados, ordens, modelosEquipamento, threshold, empresa2);
        }
        onClose();
    };

    const handlePreview = () => {
        const html = buildHtml();
        if (html) setPreviewHtml(html);
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 540 }}>
                <div className="modal-header">
                    <h3 className="modal-title">Relatórios de Clientes</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body">
                    {/* Report type selector */}
                    <div className="form-group">
                        <label className="form-label">Tipo de Relatório</label>
                        <div style={{ border: '1px solid var(--border)', borderRadius: 3 }}>
                            {RELAT_CLI_OPTS.map((opt, i) => (
                                <label key={opt.id} style={{
                                    display: 'flex', alignItems: 'flex-start', gap: 10,
                                    padding: '9px 12px', cursor: 'pointer',
                                    borderBottom: i < RELAT_CLI_OPTS.length - 1 ? '1px solid var(--border)' : undefined,
                                    background: tipo === opt.id ? 'rgba(37,99,235,0.05)' : undefined,
                                }}>
                                    <input type="radio" name="relat_tipo" value={opt.id} checked={tipo === opt.id}
                                        onChange={() => setTipo(opt.id)}
                                        style={{ accentColor: 'var(--blue)', marginTop: 3, flexShrink: 0 }} />
                                    <div>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{opt.label}</div>
                                        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 1 }}>{opt.sub}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Dynamic options */}
                    {tipo === 'ficha' && (
                        <div className="form-group">
                            <label className="form-label req">Cliente</label>
                            <SearchableSelect options={clienteOpts} value={clienteId} onChange={setClienteId} placeholder="Seleccionar cliente..." />
                        </div>
                    )}
                    {(tipo === 'sem_atividade' || tipo === 'historico') && (
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
                    )}
                    {tipo === 'manut_pendentes' && (
                        <div className="form-group">
                            <label className="form-label">Horizonte de Manutenção</label>
                            <select className="form-select" value={threshold} onChange={e => setThreshold(Number(e.target.value))}>
                                <option value={0}>Apenas em atraso</option>
                                <option value={7}>Próximos 7 dias</option>
                                <option value={14}>Próximos 14 dias</option>
                                <option value={30}>Próximos 30 dias</option>
                                <option value={60}>Próximos 60 dias</option>
                                <option value={9999}>Todas as previstas</option>
                            </select>
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="abtn abtn-secondary" type="button" onClick={onClose}>Cancelar</button>
                    <button className="abtn abtn-secondary" type="button" disabled={!canPrint} onClick={handlePreview}><Eye size={12} /> Pré-visualizar</button>
                    <button className="abtn abtn-primary" type="button" disabled={!canPrint} onClick={handlePrint}>
                        <Printer size={12} /> Imprimir Relatório
                    </button>
                </div>
            </div>
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
    const [showRelatorios, setShowRelatorios] = useState(false);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
    const showErr   = (msg: string) => { setToastErr(msg); setTimeout(() => setToastErr(''), 5000); };

    const handleRemove = async (id: number, nome: string) => {
        if (!window.confirm(`Eliminar o cliente "${nome}"? Esta acção não pode ser desfeita.`)) return;
        try {
            await api.delete(`/clientes/${id}`);
            showToast(`Cliente "${nome}" eliminado.`);
            addLog({ usuario: currentUser?.email ?? 'sistema', modulo: 'Clientes', acao: 'Cliente eliminado', detalhes: `Nome: ${nome}`, tipo: 'warning' });
            loadClientes();
        } catch (e: any) {
            showErr(e?.response?.data?.message ?? 'Erro ao eliminar cliente.');
        }
    };

    const loadClientes = useCallback(async () => {
        try {
            const { data } = await api.get(`/clientes`);
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
                await api.put(`/clientes/${editTarget.id}`, data);
                showToast('Cliente actualizado com sucesso.');
            } else {
                await api.post(`/clientes`, data);
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
                <button className="abtn abtn-secondary" type="button" onClick={() => setShowRelatorios(true)}>
                    <Printer size={13} /> Relatórios
                </button>
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

            {showRelatorios && (
                <RelatoriosClienteModal
                    clientes={clientes}
                    onClose={() => setShowRelatorios(false)}
                />
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
