import { AxiosError, AxiosHeaders } from 'axios';
import { extractErrorMessage, showToast, toastEvents, ToastEvent } from './errorHandler';

describe('extractErrorMessage', () => {
    it('extracts message string from axios response data', () => {
        const error = new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
            status: 400,
            statusText: 'Bad Request',
            data: { message: 'Campo obrigatório em falta.' },
            headers: {},
            config: { headers: new AxiosHeaders() },
        });
        expect(extractErrorMessage(error)).toBe('Campo obrigatório em falta.');
    });

    it('extracts first message from array', () => {
        const error = new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
            status: 400,
            statusText: 'Bad Request',
            data: { message: ['Nome é obrigatório', 'Email inválido'] },
            headers: {},
            config: { headers: new AxiosHeaders() },
        });
        expect(extractErrorMessage(error)).toBe('Nome é obrigatório');
    });

    it('returns permission message for 403', () => {
        const error = new AxiosError('Forbidden', 'ERR_BAD_REQUEST', undefined, undefined, {
            status: 403,
            statusText: 'Forbidden',
            data: {},
            headers: {},
            config: { headers: new AxiosHeaders() },
        });
        expect(extractErrorMessage(error)).toBe('Sem permissão para esta operação.');
    });

    it('returns not found message for 404', () => {
        const error = new AxiosError('Not Found', 'ERR_BAD_REQUEST', undefined, undefined, {
            status: 404,
            statusText: 'Not Found',
            data: {},
            headers: {},
            config: { headers: new AxiosHeaders() },
        });
        expect(extractErrorMessage(error)).toBe('Recurso não encontrado.');
    });

    it('returns conflict message for 409', () => {
        const error = new AxiosError('Conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
            status: 409,
            statusText: 'Conflict',
            data: {},
            headers: {},
            config: { headers: new AxiosHeaders() },
        });
        expect(extractErrorMessage(error)).toBe('Conflito — registo duplicado ou em uso.');
    });

    it('returns validation message for 422', () => {
        const error = new AxiosError('Unprocessable', 'ERR_BAD_REQUEST', undefined, undefined, {
            status: 422,
            statusText: 'Unprocessable Entity',
            data: {},
            headers: {},
            config: { headers: new AxiosHeaders() },
        });
        expect(extractErrorMessage(error)).toBe('Dados inválidos. Verifique os campos.');
    });

    it('returns server error message for 500+', () => {
        const error = new AxiosError('Internal Server Error', 'ERR_BAD_REQUEST', undefined, undefined, {
            status: 500,
            statusText: 'Internal Server Error',
            data: {},
            headers: {},
            config: { headers: new AxiosHeaders() },
        });
        expect(extractErrorMessage(error)).toBe('Erro no servidor. Tente novamente mais tarde.');
    });

    it('returns network error message for ERR_NETWORK', () => {
        const error = new AxiosError('Network Error', 'ERR_NETWORK');
        expect(extractErrorMessage(error)).toBe('Sem ligação ao servidor. Verifique a sua rede.');
    });

    it('returns timeout message for ECONNABORTED', () => {
        const error = new AxiosError('timeout', 'ECONNABORTED');
        expect(extractErrorMessage(error)).toBe('O pedido excedeu o tempo limite.');
    });

    it('extracts message from plain Error', () => {
        const error = new Error('Something went wrong');
        expect(extractErrorMessage(error)).toBe('Something went wrong');
    });

    it('returns fallback for unknown error types', () => {
        expect(extractErrorMessage('random string')).toBe('Ocorreu um erro inesperado.');
        expect(extractErrorMessage(null)).toBe('Ocorreu um erro inesperado.');
        expect(extractErrorMessage(42)).toBe('Ocorreu um erro inesperado.');
    });

    it('prioritizes response message over status code', () => {
        const error = new AxiosError('Server Error', 'ERR_BAD_REQUEST', undefined, undefined, {
            status: 500,
            statusText: 'Internal Server Error',
            data: { message: 'Base de dados indisponível.' },
            headers: {},
            config: { headers: new AxiosHeaders() },
        });
        expect(extractErrorMessage(error)).toBe('Base de dados indisponível.');
    });
});

describe('toastEvents', () => {
    it('emits events to subscribers', () => {
        const received: ToastEvent[] = [];
        const unsub = toastEvents.subscribe(e => received.push(e));

        toastEvents.emit({ message: 'Test toast', type: 'info' });
        expect(received).toHaveLength(1);
        expect(received[0]).toEqual({ message: 'Test toast', type: 'info' });

        unsub();
    });

    it('stops receiving events after unsubscribe', () => {
        const received: ToastEvent[] = [];
        const unsub = toastEvents.subscribe(e => received.push(e));

        toastEvents.emit({ message: 'First', type: 'success' });
        unsub();
        toastEvents.emit({ message: 'Second', type: 'error' });

        expect(received).toHaveLength(1);
        expect(received[0].message).toBe('First');
    });

    it('supports multiple subscribers', () => {
        const a: ToastEvent[] = [];
        const b: ToastEvent[] = [];
        const unsub1 = toastEvents.subscribe(e => a.push(e));
        const unsub2 = toastEvents.subscribe(e => b.push(e));

        toastEvents.emit({ message: 'Broadcast', type: 'warning' });

        expect(a).toHaveLength(1);
        expect(b).toHaveLength(1);

        unsub1();
        unsub2();
    });
});

describe('showToast', () => {
    it('emits a toast event with default type info', () => {
        const received: ToastEvent[] = [];
        const unsub = toastEvents.subscribe(e => received.push(e));

        showToast('Hello');
        expect(received).toHaveLength(1);
        expect(received[0]).toEqual({ message: 'Hello', type: 'info' });

        unsub();
    });

    it('emits a toast event with specified type', () => {
        const received: ToastEvent[] = [];
        const unsub = toastEvents.subscribe(e => received.push(e));

        showToast('Erro grave', 'error');
        expect(received[0]).toEqual({ message: 'Erro grave', type: 'error' });

        unsub();
    });
});
