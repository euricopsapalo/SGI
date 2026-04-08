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
