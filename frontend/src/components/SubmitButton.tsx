import React from 'react';

/**
 * #49 — Botão de submissão que impede cliques duplicados: enquanto `submitting`
 * fica desabilitado, mostra um spinner e substitui o texto por `loadingLabel`.
 * `aria-busy` comunica o estado a leitores de ecrã.
 */
export interface SubmitButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    submitting: boolean;
    loadingLabel?: string;
    icon?: React.ReactNode;
}

const SubmitButton: React.FC<SubmitButtonProps> = ({
    submitting,
    loadingLabel = 'A guardar…',
    icon,
    children,
    className = 'abtn abtn-primary',
    disabled,
    type = 'submit',
    ...rest
}) => (
    <button
        type={type}
        className={className}
        disabled={submitting || disabled}
        aria-busy={submitting}
        {...rest}
    >
        {submitting
            ? <><span className="abtn__spinner" aria-hidden="true" /> {loadingLabel}</>
            : <>{icon}{children}</>}
    </button>
);

export default SubmitButton;
