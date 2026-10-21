import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import api from '../services/api';
import { GlobalProvider, useGlobal } from './GlobalContext';

jest.mock('../services/api', () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const mockApi = api as unknown as { get: jest.Mock; post: jest.Mock };

const arrancarComo = async (role: string) => {
    localStorage.setItem('sgi_token', 'token-de-teste');
    mockApi.post.mockImplementation(async (url: string) =>
        url === '/auth/me' ? { data: { user: { nome: 'X', email: 'x@aquatex.ao', role } } } : { data: {} });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={qc}><GlobalProvider>{children}</GlobalProvider></QueryClientProvider>
    );
    renderHook(() => useGlobal(), { wrapper });
    // espera pelo lote do login (configuração é pedida em todos os perfis)
    await waitFor(() => expect(mockApi.get).toHaveBeenCalledWith('/configuracao'));
    await waitFor(() => expect(mockApi.get).toHaveBeenCalledWith('/ordens'));
    return mockApi.get.mock.calls.map(c => c[0] as string);
};

/** #221 — o login não carrega os movimentos e só pede o que o perfil pode ver. */
describe('carregamento inicial (#221)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        mockApi.get.mockResolvedValue({ data: [] });
    });

    it('nenhum perfil carrega os movimentos de stock no login', async () => {
        const urls = await arrancarComo('admin');
        expect(urls).not.toContain('/movimentos-stock');
        expect(urls).toEqual(expect.arrayContaining(['/compras', '/faturas-fornecedor', '/fornecedores']));
    });

    it('o técnico de campo não pede o que o backend lhe recusa (403)', async () => {
        const urls = await arrancarComo('campo');
        for (const proibido of ['/movimentos-stock', '/compras', '/faturas-fornecedor', '/fornecedores']) {
            expect(urls).not.toContain(proibido);
        }
        expect(urls).toEqual(expect.arrayContaining(['/artigos', '/armazens', '/ordens']));
    });

    it('o lote do login corre uma só vez, depois de se saber o perfil', async () => {
        const urls = await arrancarComo('coordenador');
        expect(urls.filter(u => u === '/configuracao')).toHaveLength(1);
    });
});
