import React, { useState } from 'react';
import { Check, KeyRound, X } from 'lucide-react';
import api from '../services/api';
import { useGlobal } from '../contexts/GlobalContext';
import { useModalA11y } from './useModalA11y';
import FieldError, { fieldAria } from './FieldError';
import SubmitButton from './SubmitButton';
import { extractErrorMessage, extractFieldErrors, showToast } from '../utils/errorHandler';

/**
 * #219 — O utilizador autenticado altera a sua palavra-passe (`POST /auth/change-password`).
 * A política (mínimo de caracteres, #100) é validada no servidor; os erros aparecem
 * junto ao campo (padrão #49).
 */
type Campo = 'currentPassword' | 'newPassword' | 'confirmacao';

const AlterarPasswordModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { empresaConfig } = useGlobal();
    const min = empresaConfig?.minPasswordLength ?? 8;
    const modalRef = useModalA11y(onClose);
    const [atual, setAtual] = useState('');
    const [nova, setNova] = useState('');
    const [confirmacao, setConfirmacao] = useState('');
    const [errors, setErrors] = useState<Partial<Record<Campo, string>>>({});
    const [erroGeral, setErroGeral] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const validar = () => {
        const e: Partial<Record<Campo, string>> = {};
        if (!atual) e.currentPassword = 'Indique a password atual.';
        if (nova.length < min) e.newPassword = `A password tem de ter pelo menos ${min} caracteres.`;
        if (confirmacao !== nova) e.confirmacao = 'A confirmação não coincide com a nova password.';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const submeter = async (ev: React.FormEvent) => {
        ev.preventDefault();
        if (submitting || !validar()) return;
        setErroGeral('');
        setSubmitting(true);
        try {
            await api.post('/auth/change-password', { currentPassword: atual, newPassword: nova });
            showToast('Palavra-passe alterada. Use a nova no próximo início de sessão.', 'success');
            onClose();
        } catch (err) {
            const fe = extractFieldErrors(err);
            if (Object.keys(fe).length) setErrors(fe as Partial<Record<Campo, string>>);
            else setErroGeral(extractErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    const campo = (id: Campo, label: string, valor: string, set: (v: string) => void, autoComplete: string) => (
        <div className="form-group">
            <label className="form-label req" htmlFor={`pw-${id}`}>{label}</label>
            <input id={`pw-${id}`} type="password" className={`form-input${errors[id] ? ' err' : ''}`}
                value={valor} autoComplete={autoComplete}
                onChange={e => { set(e.target.value); if (errors[id]) setErrors(p => ({ ...p, [id]: undefined })); }}
                {...fieldAria(`pw-${id}-err`, errors[id])} />
            <FieldError id={`pw-${id}-err`} message={errors[id]} />
        </div>
    );

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 420 }} ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="pw-modal-title" tabIndex={-1}>
                <div className="modal-header">
                    <h3 className="modal-title" id="pw-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <KeyRound size={15} /> Alterar palavra-passe
                    </h3>
                    <button className="modal-close" aria-label="Fechar" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <form onSubmit={submeter} noValidate>
                    <div className="modal-body">
                        {campo('currentPassword', 'Password atual', atual, setAtual, 'current-password')}
                        {campo('newPassword', `Nova password (mínimo ${min} caracteres)`, nova, setNova, 'new-password')}
                        {campo('confirmacao', 'Confirmar nova password', confirmacao, setConfirmacao, 'new-password')}
                        {erroGeral && <div className="form-error" role="alert">{erroGeral}</div>}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="abtn abtn-secondary" onClick={onClose} disabled={submitting}>Cancelar</button>
                        <SubmitButton submitting={submitting} icon={<Check size={12} />}>Alterar</SubmitButton>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AlterarPasswordModal;
