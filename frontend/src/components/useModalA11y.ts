import { useEffect, useRef } from 'react';

/**
 * #45 — Acessibilidade de modais (WCAG 2.1.2 / 2.4.3):
 *  - fecha com a tecla Escape;
 *  - move o foco para o primeiro elemento focável ao abrir (ou para o próprio
 *    container), garantindo ordem de foco previsível.
 *
 * Devolve um ref para colocar no container do modal (ex.: a `div.modal`).
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(onClose: () => void) {
    const ref = useRef<T>(null);
    // guarda a referência mais recente do onClose sem reinstalar o listener
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onCloseRef.current();
            }
        };
        document.addEventListener('keydown', onKey);

        const el = ref.current;
        if (el) {
            const focusable = el.querySelector<HTMLElement>(
                'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
            );
            (focusable ?? el).focus();
        }
        return () => document.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return ref;
}
