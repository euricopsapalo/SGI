import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Utilizador } from './UtilizadoresPage';

interface Props {
    initial: Utilizador | null;
    onClose: () => void;
    onSave: (data: Omit<Utilizador, 'id' | 'ultimoAcesso' | 'iniciais'>) => void;
}

type FormData = {
    nome: string;
    email: string;
    telefone: string;
    perfil: Utilizador['perfil'];
    ativo: boolean;
    password: string;
    confirmPassword: string;
};

const BLANK: FormData = {
    nome: '', email: '', telefone: '',
    perfil: 'Técnico Campo', ativo: true,
    password: '', confirmPassword: '',
};

const UtilizadorModal: React.FC<Props> = ({ initial, onClose, onSave }) => {
    const [form, setForm] = useState<FormData>(BLANK);
    const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
    const [showPw, setShowPw] = useState(false);
    const [showCpw, setShowCpw] = useState(false);

    const isEdit = Boolean(initial);

    useEffect(() => {
        if (initial) {
            setForm({ ...BLANK, nome: initial.nome, email: initial.email, telefone: initial.telefone, perfil: initial.perfil, ativo: initial.ativo });
        } else {
            setForm(BLANK);
        }
        setErrors({});
    }, [initial]);

    const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm(p => ({ ...p, [key]: e.target.value }));

    const validate = () => {
        const e: typeof errors = {};
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length) { setErrors(errs); return; }
        onSave({ nome: form.nome.trim(), email: form.email.trim(), telefone: form.telefone.trim(), perfil: form.perfil, ativo: form.ativo });
    };

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 520 }}>

                {/* Header */}
                <div className="modal-header">
                    <h3 className="modal-title">{isEdit ? `Editar — ${initial?.nome}` : 'Novo Utilizador'}</h3>
                    <button className="modal-close" onClick={onClose} type="button" aria-label="Fechar">
                        <X size={13} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} noValidate>
                    <div className="modal-body">

                        {/* Nome */}
                        <div className="form-group">
                            <label className="form-label req">Nome Completo</label>
                            <input className={`form-input${errors.nome ? ' err' : ''}`} value={form.nome} onChange={set('nome')} placeholder="Ex: Ana Ferreira" />
                            {errors.nome && <span className="form-error"><AlertCircle size={11} /> {errors.nome}</span>}
                        </div>

                        {/* Email + Telefone */}
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label req">Email</label>
                                <input type="email" className={`form-input${errors.email ? ' err' : ''}`} value={form.email} onChange={set('email')} placeholder="utilizador@aquatex.ao" />
                                {errors.email && <span className="form-error"><AlertCircle size={11} /> {errors.email}</span>}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Telefone</label>
                                <input className="form-input" value={form.telefone} onChange={set('telefone')} placeholder="+244 9XX XXX XXX" />
                            </div>
                        </div>

                        {/* Perfil + Estado */}
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label req">Perfil</label>
                                <select className="form-select" value={form.perfil} onChange={set('perfil') as any}>
                                    <option value="Administrador">Administrador</option>
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

                        {/* Password */}
                        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 'var(--sp-3)' }}>
                            <p className="form-hint" style={{ marginBottom: 'var(--sp-3)', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600 }}>
                                {isEdit ? 'Deixe em branco para manter a password actual.' : 'Password de acesso'}
                            </p>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label req={!isEdit}">Password</label>
                                    <div className="pw-wrap">
                                        <input type={showPw ? 'text' : 'password'} className={`form-input${errors.password ? ' err' : ''}`} value={form.password} onChange={set('password')} placeholder={isEdit ? '(sem alteração)' : '••••••••'} />
                                        <button type="button" className="pw-eye" onClick={() => setShowPw(p => !p)}>
                                            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                    {errors.password && <span className="form-error"><AlertCircle size={11} /> {errors.password}</span>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Confirmar Password</label>
                                    <div className="pw-wrap">
                                        <input type={showCpw ? 'text' : 'password'} className={`form-input${errors.confirmPassword ? ' err' : ''}`} value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="••••••••" />
                                        <button type="button" className="pw-eye" onClick={() => setShowCpw(p => !p)}>
                                            {showCpw ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    </div>
                                    {errors.confirmPassword && <span className="form-error"><AlertCircle size={11} /> {errors.confirmPassword}</span>}
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Footer */}
                    <div className="modal-footer">
                        <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="abtn abtn-primary">{isEdit ? 'Guardar Alterações' : 'Criar Utilizador'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UtilizadorModal;
