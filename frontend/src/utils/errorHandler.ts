import { AxiosError } from 'axios';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastEvent {
    message: string;
    type: ToastType;
}

type ToastListener = (event: ToastEvent) => void;

const listeners: Set<ToastListener> = new Set();

export const toastEvents = {
    subscribe(listener: ToastListener) {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
    },
    emit(event: ToastEvent) {
        listeners.forEach(fn => fn(event));
    },
};

export function showToast(message: string, type: ToastType = 'info') {
    toastEvents.emit({ message, type });
}

/**
 * #49 — Extrai o mapa de erros de validação por campo devolvido pelo backend
 * (`error.response.data.errors`, ver `buildValidationPipe`). Devolve `{}` se a
 * resposta não trouxer erros por campo. As chaves podem vir aninhadas
 * (`enderecos.0.morada`); o consumidor decide como as mapear aos seus inputs.
 */
export function extractFieldErrors(error: unknown): Record<string, string> {
    if (error instanceof AxiosError) {
        const errors = error.response?.data?.errors;
        if (errors && typeof errors === 'object' && !Array.isArray(errors)) {
            const out: Record<string, string> = {};
            for (const [k, v] of Object.entries(errors as Record<string, unknown>)) {
                if (typeof v === 'string') out[k] = v;
            }
            return out;
        }
    }
    return {};
}

export function extractErrorMessage(error: unknown): string {
    if (error instanceof AxiosError) {
        const data = error.response?.data;
        if (data?.message) {
            return Array.isArray(data.message) ? data.message[0] : data.message;
        }
        if (error.response?.status === 403) return 'Sem permissão para esta operação.';
        if (error.response?.status === 404) return 'Recurso não encontrado.';
        if (error.response?.status === 409) return 'Conflito — registo duplicado ou em uso.';
        if (error.response?.status === 422) return 'Dados inválidos. Verifique os campos.';
        if (error.response?.status && error.response.status >= 500) return 'Erro no servidor. Tente novamente mais tarde.';
        if (error.code === 'ERR_NETWORK') return 'Sem ligação ao servidor. Verifique a sua rede.';
        if (error.code === 'ECONNABORTED') return 'O pedido excedeu o tempo limite.';
    }
    if (error instanceof Error) return error.message;
    return 'Ocorreu um erro inesperado.';
}
