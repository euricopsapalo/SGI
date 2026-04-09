import React, { useState, useEffect, useCallback } from 'react';
import { toastEvents, ToastEvent } from '../utils/errorHandler';

const TOAST_DURATION = 4000;

const GlobalToast: React.FC = () => {
    const [toasts, setToasts] = useState<(ToastEvent & { id: number })[]>([]);

    const addToast = useCallback((event: ToastEvent) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { ...event, id }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, TOAST_DURATION);
    }, []);

    useEffect(() => {
        return toastEvents.subscribe(addToast);
    }, [addToast]);

    if (toasts.length === 0) return null;

    return (
        <div className="global-toast-container" data-testid="global-toast-container">
            {toasts.map(t => (
                <div
                    key={t.id}
                    className={`global-toast global-toast--${t.type}`}
                    data-testid="global-toast"
                    role="alert"
                >
                    <span className="global-toast__icon">
                        {t.type === 'error' ? '\u2716' : t.type === 'warning' ? '\u26A0' : t.type === 'success' ? '\u2714' : '\u2139'}
                    </span>
                    <span className="global-toast__message">{t.message}</span>
                    <button
                        className="global-toast__close"
                        onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                        aria-label="Fechar"
                    >
                        &times;
                    </button>
                </div>
            ))}
        </div>
    );
};

export default GlobalToast;
