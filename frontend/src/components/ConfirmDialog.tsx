import React, { useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, HelpCircle, X } from 'lucide-react';

export type ConfirmVariant = 'danger' | 'info';

export interface ConfirmDialogProps {
    open: boolean;
    title: string;
    /** Corpo da mensagem. String simples ou nós React. */
    message?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: ConfirmVariant;
    onConfirm: () => void;
    onCancel: () => void;
}

/**
 * #46 — Diálogo de confirmação universal para ações destrutivas/sensíveis.
 * Substitui `window.confirm()`. Acessível: focus trap, Esc fecha, backdrop
 * cancela, foco devolvido ao elemento anterior ao fechar.
 *
 * Uso típico via `useConfirm()`; este componente é o apresentacional.
 */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    open,
    title,
    message,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    variant = 'danger',
    onConfirm,
    onCancel,
}) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    const confirmBtnRef = useRef<HTMLButtonElement>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);

    // Focus trap: mantém o Tab dentro do diálogo enquanto aberto.
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            onCancel();
            return;
        }
        if (e.key !== 'Tab') return;
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }, [onCancel]);

    useEffect(() => {
        if (!open) return;
        previouslyFocused.current = document.activeElement as HTMLElement;
        // Foca o botão de confirmar quando abre.
        const t = window.setTimeout(() => confirmBtnRef.current?.focus(), 0);
        return () => {
            window.clearTimeout(t);
            // Devolve o foco ao elemento que estava ativo antes de abrir.
            previouslyFocused.current?.focus?.();
        };
    }, [open]);

    if (!open) return null;

    const Icon = variant === 'danger' ? AlertTriangle : HelpCircle;

    return (
        <div className="modal-overlay" onMouseDown={onCancel}>
            <div
                ref={dialogRef}
                className="modal confirm-dialog"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
                aria-describedby={message ? 'confirm-dialog-desc' : undefined}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                <div className="modal-header">
                    <span className="modal-title" id="confirm-dialog-title">{title}</span>
                    <button className="modal-close" onClick={onCancel} type="button" aria-label="Fechar">
                        <X size={13} />
                    </button>
                </div>
                <div className="modal-body confirm-dialog__body">
                    <span className={`confirm-dialog__icon confirm-dialog__icon--${variant}`}>
                        <Icon size={22} />
                    </span>
                    {message && (
                        <p className="confirm-dialog__message" id="confirm-dialog-desc">{message}</p>
                    )}
                </div>
                <div className="modal-footer">
                    <button type="button" className="abtn abtn-secondary" onClick={onCancel}>
                        {cancelLabel}
                    </button>
                    <button
                        ref={confirmBtnRef}
                        type="button"
                        className={`abtn ${variant === 'danger' ? 'abtn-danger-solid' : 'abtn-primary'}`}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
