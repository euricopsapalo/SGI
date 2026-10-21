import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import api from '../services/api';
import { GlobalProvider, useGlobal } from './GlobalContext';

jest.mock('../services/api', () => ({
    __esModule: true,
    default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const mockApi = api as unknown as { get: jest.Mock; post: jest.Mock };

const montar = () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={qc}><GlobalProvider>{children}</GlobalProvider></QueryClientProvider>
    );
    return renderHook(() => useGlobal(), { wrapper });
};

/** #212 — as criações esperam pelo servidor, propagam o erro e não metem placeholders no estado. */
describe('criações no GlobalContext (#212)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockApi.get.mockResolvedValue({ data: [] });
    });

    it('com o servidor a recusar, rejeita e não acrescenta nenhum registo', async () => {
        const erro = Object.assign(new Error('400'), { response: { status: 400, data: { message: 'codigo should not be empty' } } });
        mockApi.post.mockRejectedValue(erro);
        const { result } = montar();

        await act(async () => {
            await expect(result.current.addArtigo({ codigo: '' } as any)).rejects.toBe(erro);
            await expect(result.current.addFornecedor({ nome: 'X' } as any)).rejects.toBe(erro);
            await expect(result.current.addModelo({ nome: 'M' } as any)).rejects.toBe(erro);
            await expect(result.current.addArmazem({ codigo: 'A' } as any)).rejects.toBe(erro);
            await expect(result.current.addEncomenda({ numero: 'N-1', linhas: [], rececoes: [] } as any)).rejects.toBe(erro);
            await expect(result.current.addMovimento({ artigoId: '1', tipo: 'entrada', quantidade: 1 } as any)).rejects.toBe(erro);
            await expect(result.current.addCliente({ nome: 'C' } as any)).rejects.toBe(erro);
        });

        const semId = (xs: { id: string }[]) => xs.filter(x => x.id === '');
        expect(semId(result.current.artigos)).toEqual([]);
        expect(semId(result.current.fornecedores)).toEqual([]);
        expect(semId(result.current.modelosEquipamento)).toEqual([]);
        expect(semId(result.current.armazens)).toEqual([]);
        expect(semId(result.current.encomendas)).toEqual([]);
        // #221 — os movimentos já não estão no contexto (o addMovimento rejeita acima e não guarda nada).
        expect(semId(result.current.clientes)).toEqual([]);
    });

    it('com sucesso, devolve e guarda o registo do servidor (com o id real)', async () => {
        mockApi.post.mockResolvedValue({ data: { id: 42, codigo: 'ARM-09', nome: 'Armazém 9', ativo: true } });
        const { result } = montar();

        let criado: any;
        await act(async () => { criado = await result.current.addArmazem({ codigo: 'ARM-09', nome: 'Armazém 9', ativo: true } as any); });

        expect(criado.id).toBe('42');
        expect(result.current.armazens.map(a => a.id)).toContain('42');
    });
});
