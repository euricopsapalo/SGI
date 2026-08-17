import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import ConfirmDialog, { ConfirmVariant } from './ConfirmDialog';

export interface ConfirmOptions {
    title: string;
    message?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: ConfirmVariant;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * #46 — Provider do diálogo de confirmação. Monta um único `ConfirmDialog` na
 * raiz e expõe uma função `confirm(options)` que devolve `Promise<boolean>`
 * (resolve `true` ao confirmar, `false` ao cancelar).
 */
export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [options, setOptions] = useState<ConfirmOptions | null>(null);
    const resolverRef = useRef<((value: boolean) => void) | null>(null);

    const confirm = useCallback<ConfirmFn>((opts) => {
        setOptions(opts);
        return new Promise<boolean>((resolve) => {
            resolverRef.current = resolve;
        });
    }, []);

    const close = useCallback((result: boolean) => {
        resolverRef.current?.(result);
        resolverRef.current = null;
        setOptions(null);
    }, []);

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            <ConfirmDialog
                open={options !== null}
                title={options?.title ?? ''}
                message={options?.message}
                confirmLabel={options?.confirmLabel}
                cancelLabel={options?.cancelLabel}
                variant={options?.variant}
                onConfirm={() => close(true)}
                onCancel={() => close(false)}
            />
        </ConfirmContext.Provider>
    );
};

/**
 * Hook de uso simples:
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Eliminar?', variant: 'danger' }))) return;
 */
export function useConfirm(): ConfirmFn {
    const ctx = useContext(ConfirmContext);
    if (!ctx) {
        throw new Error('useConfirm deve ser usado dentro de <ConfirmProvider>');
    }
    return ctx;
}
