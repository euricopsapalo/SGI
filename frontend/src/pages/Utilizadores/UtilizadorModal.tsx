import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Link } from 'lucide-react';
import { Utilizador } from './UtilizadoresPage';
import { Tecnico } from '../../contexts/GlobalContext';
import SearchableSelect from '../../components/SearchableSelect';
import FieldError, { fieldAria } from '../../components/FieldError';
import SubmitButton from '../../components/SubmitButton';
import { useModalA11y } from '../../components/useModalA11y';
import { extractFieldErrors } from '../../utils/errorHandler';

interface Props {
    initial: Utilizador | null;
    tecnicos: Tecnico[];
    onClose: () => void;
    onSave: (data: Omit<Utilizador, 'id' | 'ultimoAcesso' | 'iniciais'> & { password?: string }) => Promise<void>;
}

type FormData = {
    nome: string;
    email: string;
    telefone: string;
    perfil: Utilizador['perfil'];
    ativo: boolean;
    password: string;
    confirmPassword: string;
    tecnicoId: string;
    tecnicoNome: string;
};

const BLANK: FormData = {
    nome: '', email: '', telefone: '',
    perfil: 'Técnico Campo', ativo: true,
    password: '', confirmPassword: '',
    tecnicoId: '', tecnicoNome: '',
};

const UtilizadorModal: React.FC<Props> = ({ initial, tecnicos, onClose, onSave }) => {
    const [form, setForm] = useState<FormData>(BLANK);
    const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
    const [submitting, setSubmitting] = useState(false);
    const [showPw, setShowPw] = useState(false);
    const [showCpw, setShowCpw] = useState(false);
    const modalRef = useModalA11y<HTMLDivElement>(onClose);

    const isEdit = Boolean(initial);
    const isTecnicoCampo = form.perfil === 'Técnico Campo';

    useEffect(() => {
        if (initial) {
            setForm({
                ...BLANK,
                nome: initial.nome,
                email: initial.email,
                telefone: initial.telefone,
                perfil: initial.perfil,
                ativo: initial.ativo,
                tecnicoId: initial.tecnicoId ?? '',
                tecnicoNome: initial.tecnicoNome ?? '',
            });
        } else {
            setForm(BLANK);
        }
        setErrors({});
    }, [initial]);

    const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm(p => ({ ...p, [key]: e.target.value }));

    const handlePerfilChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const perfil = e.target.value as Utilizador['perfil'];
        // Clear technician link when switching away from Técnico Campo
        setForm(p => ({ ...p, perfil, ...(perfil !== 'Técnico Campo' ? { tecnicoId: '', tecnicoNome: '' } : {}) }));
    };

    const handleTecnicoSelect = (tecnicoId: string) => {
        const tec = tecnicos.find(t => t.id === tecnicoId);
        if (!tec) {
            setForm(p => ({ ...p, tecnicoId: '', tecnicoNome: '' }));
            return;
        }
        setForm(p => ({
            ...p,
            tecnicoId: tec.id,
            tecnicoNome: tec.nome,
            nome: tec.nome,
            email: tec.email,
            telefone: tec.telefone,
        }));
        setErrors(prev => ({ ...prev, tecnicoId: undefined, nome: undefined, email: undefined }));
    };

    const validate = () => {
        const e: typeof errors = {};
        // Issue #68 — associação a Técnico passa a ser opcional: o utilizador
        // Técnico Campo pode ser criado primeiro e vinculado depois (ou via
        // criação de Técnico na página /tecnicos, que cria utilizador+técnico
        // atomicamente).
        if (!form.nome.trim()) e.nome = 'Nome obrigatório.';
        if (!form.email.trim()) e.email = 'Email obrigatório.';
        else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Email inválido.';
        if (!isEdit || form.password) {
            if (!isEdit && !form.password) e.password = 'Password obrigatória.';
            else if (form.password && form.password.length < 6) e.password = 'Mínimo 6 caracteres.';
            if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords não coincidem.';
        }
        return e;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        const errs = validate();
        if (Object.keys(errs).length) { setErrors(errs); return; }
        setSubmitting(true);
        try {
            await onSave({
                nome: form.nome.trim(),
                email: form.email.trim(),
                telefone: form.telefone.trim(),
                perfil: form.perfil,
                ativo: form.ativo,
                tecnicoId: form.tecnicoId || undefined,
                tecnicoNome: form.tecnicoNome || undefined,
                password: form.password || undefined,
            });
        } catch (err) {
            // #49 — validação inline a partir dos erros do backend
            const fe = extractFieldErrors(err);
            if (Object.keys(fe).length) setErrors(prev => ({ ...prev, ...fe }));
        } finally {
            setSubmitting(false);
        }
    };

    const tecOptions = tecnicos
        .filter(t => t.ativo)
        .map(t => ({ value: t.id, label: t.nome, sub: t.email }));

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 540 }} ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="user-modal-title" tabIndex={-1}>

                {/* Header */}
                <div className="modal-header">
                    <h3 className="modal-title" id="user-modal-title">{isEdit ? `Editar — ${initial?.nome}` : 'Novo Utilizador'}</h3>
                    <button className="modal-close" onClick={onClose} type="button" aria-label="Fechar">
                        <X size={13} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} noValidate>
                    <div className="modal-body">

                        {/* Perfil + Estado */}
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label req">Perfil</label>
                                <select className="form-select" value={form.perfil} onChange={handlePerfilChange}>
                                    <option value="Administrador">Administrador</option>
                                    <option value="Coordenador">Coordenador de Intervenções</option>
                                    <option value="Técnico Suporte">Técnico Suporte</option>
                                    <option value="Técnico Campo">Técnico Campo</option>
                                    <option value="Vendedor">Vendedor</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                                <label className="form-label">Estado da Conta</label>
                                <div className="toggle-row">
                                    <div className="toggle-info">
                                        <div className="toggle-title">{form.ativo ? 'Ativo' : 'Inativo'}</div>
                                        <div className="toggle-desc">{form.ativo ? 'Pode aceder ao sistema' : 'Acesso bloqueado'}</div>
                                    </div>
                                    <label className="toggle">
                                        <input type="checkbox" checked={form.ativo} onChange={e => setForm(p => ({ ...p, ativo: e.target.checked }))} />
                                        <span className="toggle-slider" />
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Technician selector — only for Técnico Campo */}
                        {isTecnicoCampo && (
                            <div className="form-group" style={{ padding: '10px 12px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 4, marginBottom: 4 }}>
                                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <Link size={12} /> Técnico de Campo Associado <span style={{ color: '#64748b', fontWeight: 400 }}>(opcional)</span>
                                </label>
                                <SearchableSelect
                                    options={tecOptions}
                                    value={form.tecnicoId}
                                    onChange={handleTecnicoSelect}
                                    placeholder="Seleccionar técnico existente (opcional)..."
                                />
                                {form.tecnicoId ? (
                                    <div style={{ marginTop: 6, fontSize: '0.75rem', color: '#1d4ed8' }}>
                                        Dados preenchidos automaticamente a partir do técnico seleccionado.
                                    </div>
                                ) : (
                                    <div style={{ marginTop: 6, fontSize: '0.75rem', color: '#475569' }}>
                                        Pode deixar em branco. Para criar técnico e utilizador de uma só vez use a página <strong>Técnicos → Novo</strong>.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Nome */}
                        <div className="form-group">
                            <label className="form-label req">Nome Completo</label>
                            <input
                                className={`form-input${errors.nome ? ' err' : ''}`}
                                value={form.nome}
                                onChange={set('nome')}
                                placeholder="Ex: Ana Ferreira"
                                readOnly={isTecnicoCampo && !!form.tecnicoId}
                                {...fieldAria('user-nome-err', errors.nome)}
                            />
                            <FieldError id="user-nome-err" message={errors.nome} />
                        </div>

                        {/* Email + Telefone */}
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label req">Email</label>
                                <input
                                    type="email"
                                    className={`form-input${errors.email ? ' err' : ''}`}
                                    value={form.email}
                                    onChange={set('email')}
                                    placeholder="utilizador@aquatex.ao"
                                    readOnly={isTecnicoCampo && !!form.tecnicoId}
                                    {...fieldAria('user-email-err', errors.email)}
                                />
                                <FieldError id="user-email-err" message={errors.email} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Telefone</label>
                                <input
                                    className="form-input"
                                    value={form.telefone}
                                    onChange={set('telefone')}
                                    placeholder="+244 9XX XXX XXX"
                                    readOnly={isTecnicoCampo && !!form.tecnicoId}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 'var(--sp-3)' }}>
                            <p className="form-hint" style={{ marginBottom: 'var(--sp-3)', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
                                {isEdit ? 'Deixe em branco para manter a password actual.' : 'Password de acesso'}
                            </p>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Password</label>
                                    <div className="pw-wrap">
                                        <input type={showPw ? 'text' : 'password'} className={`form-input${errors.password ? ' err' : ''}`} value={form.password} onChange={set('password')} placeholder={isEdit ? '(sem alteração)' : '••••••••'} {...fieldAria('user-password-err', errors.password)} />
                                        <button type="button" className="pw-eye" onClick={() => setShowPw(p => !p)}>
                                            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                    <FieldError id="user-password-err" message={errors.password} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Confirmar Password</label>
                                    <div className="pw-wrap">
                                        <input type={showCpw ? 'text' : 'password'} className={`form-input${errors.confirmPassword ? ' err' : ''}`} value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="••••••••" {...fieldAria('user-confirmPassword-err', errors.confirmPassword)} />
                                        <button type="button" className="pw-eye" onClick={() => setShowCpw(p => !p)}>
                                            {showCpw ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                    <FieldError id="user-confirmPassword-err" message={errors.confirmPassword} />
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Footer */}
                    <div className="modal-footer">
                        <button type="button" className="abtn abtn-secondary" onClick={onClose} disabled={submitting}>Cancelar</button>
                        <SubmitButton submitting={submitting}>{isEdit ? 'Guardar Alterações' : 'Criar Utilizador'}</SubmitButton>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UtilizadorModal;
