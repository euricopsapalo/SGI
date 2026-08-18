import { QueryClient } from '@tanstack/react-query';

/**
 * #43 — Cliente React Query partilhado.
 *
 * `staleTime` de 5 min evita refetches duplicados ao navegar entre páginas
 * (os dados ficam "fresh" e servidos da cache). As mutações invalidam as
 * queries afetadas para trazer a verdade do servidor.
 */
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 min
            gcTime: 30 * 60 * 1000,   // 30 min em cache antes de garbage-collect
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});

/** Chaves de cache das entidades de estado-servidor migradas (#43). */
export const queryKeys = {
    clientes: ['clientes'] as const,
    tecnicos: ['tecnicos'] as const,
    fornecedores: ['fornecedores'] as const,
    artigos: ['artigos'] as const,
    ordens: ['ordens'] as const,
};
