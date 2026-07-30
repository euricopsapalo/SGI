import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { toastEvents, ToastEvent, ToastType } from '../utils/errorHandler';

/** Erros/avisos ficam mais tempo (mais texto a ler); sucesso/info saem antes. */
const DURATION: Record<ToastType, number> = {
    error: 6000,
    warning: 6000,
    success: 4000,
    info: 4000,
};

const ICON: Record<ToastType, React.FC<{ size?: number }>> = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
};

const GlobalToast: React.FC = () => {
    const [toasts, setToasts] = useState<(ToastEvent & { id: number })[]>([]);

    const dismiss = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addToast = useCallback((event: ToastEvent) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { ...event, id }]);
        setTimeout(() => dismiss(id), DURATION[event.type] ?? 4000);
    }, [dismiss]);

    useEffect(() => toastEvents.subscribe(addToast), [addToast]);

    if (toasts.length === 0) return null;

    return (
        <div className="global-toast-container" data-testid="global-toast-container">
            {toasts.map(t => {
                const IconCmp = ICON[t.type] ?? Info;
                const assertive = t.type === 'error' || t.type === 'warning';
                return (
                    <div
                        key={t.id}
                        className={`global-toast global-toast--${t.type}`}
                        data-testid="global-toast"
                        role={assertive ? 'alert' : 'status'}
                        aria-live={assertive ? 'assertive' : 'polite'}
                    >
                        <span className="global-toast__icon">
                            <IconCmp size={16} />
                        </span>
                        <span className="global-toast__message">{t.message}</span>
                        <button
                            className="global-toast__close"
                            onClick={() => dismiss(t.id)}
                            aria-label="Fechar"
                        >
                            <X size={14} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
};

export default GlobalToast;
