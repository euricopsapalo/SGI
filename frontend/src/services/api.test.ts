import api from './api';
import { toastEvents, ToastEvent } from '../utils/errorHandler';
import { AxiosError, AxiosHeaders } from 'axios';

describe('api interceptors', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    describe('request interceptor', () => {
        it('attaches Authorization header when token exists', () => {
            localStorage.setItem('sgi_token', 'test-jwt-token');
            const handler = (api.interceptors.request as any).handlers[0];
            const config = { headers: {} as any };
            const result = handler.fulfilled(config);
            expect(result.headers.Authorization).toBe('Bearer test-jwt-token');
        });

        it('does not attach Authorization header when no token', () => {
            localStorage.removeItem('sgi_token');
            const handler = (api.interceptors.request as any).handlers[0];
            const config = { headers: {} as any };
            const result = handler.fulfilled(config);
            expect(result.headers.Authorization).toBeUndefined();
        });
    });

    describe('response interceptor', () => {
        it('passes through successful responses', () => {
            const handler = (api.interceptors.response as any).handlers[0];
            const response = { status: 200, data: { ok: true } };
            expect(handler.fulfilled(response)).toEqual(response);
        });

        it('removes token on 401 error', async () => {
            localStorage.setItem('sgi_token', 'some-token');
            const handler = (api.interceptors.response as any).handlers[0];

            // Mock window.location
            const origLocation = window.location;
            Object.defineProperty(window, 'location', {
                value: { pathname: '/dashboard', href: '', includes: () => false },
                writable: true,
            });

            const error = { response: { status: 401 } };
            await expect(handler.rejected(error)).rejects.toEqual(error);
            expect(localStorage.getItem('sgi_token')).toBeNull();

            window.location = origLocation;
        });

        it('emits error toast for non-401 errors', async () => {
            const received: ToastEvent[] = [];
            const unsub = toastEvents.subscribe(e => received.push(e));

            const handler = (api.interceptors.response as any).handlers[0];
            const error = new AxiosError('Server Error', 'ERR_BAD_REQUEST', undefined, undefined, {
                status: 500,
                statusText: 'Internal Server Error',
                data: { message: 'Erro interno do servidor' },
                headers: {},
                config: { headers: new AxiosHeaders() },
            });

            await expect(handler.rejected(error)).rejects.toEqual(error);
            expect(received.some(t => t.type === 'error' && t.message === 'Erro interno do servidor')).toBe(true);

            unsub();
        });

        it('emits warning toast on 401', async () => {
            const received: ToastEvent[] = [];
            const unsub = toastEvents.subscribe(e => received.push(e));

            const handler = (api.interceptors.response as any).handlers[0];

            const origLocation = window.location;
            Object.defineProperty(window, 'location', {
                value: { pathname: '/dashboard', href: '', includes: () => false },
                writable: true,
            });

            const error = { response: { status: 401 } };
            await expect(handler.rejected(error)).rejects.toEqual(error);
            expect(received.some(t => t.type === 'warning')).toBe(true);

            window.location = origLocation;
            unsub();
        });
    });
});
