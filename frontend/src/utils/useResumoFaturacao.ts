import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { vendasApi } from '../services/vendas';
import { tesourariaApi } from '../services/tesouraria';
import { resumirDocumentos } from './faturacaoResumo';

/**
 * #206 — Documentos de venda emitidos e liquidações para o Dashboard e os
 * Relatórios. `ativo = false` para perfis sem acesso a Vendas (técnico de
 * campo, #198), que não veem os indicadores de faturação.
 */
export function useResumoFaturacao(ativo = true) {
    const docsQ = useQuery({
        queryKey: ['vendas', 'documentos', 'EMITIDO'],
        queryFn: () => vendasApi.documentos({ estado: 'EMITIDO' }),
        enabled: ativo,
        staleTime: 60_000,
    });
    const liqQ = useQuery({
        queryKey: ['liquidacoes'],
        queryFn: () => tesourariaApi.liquidacoes(),
        enabled: ativo,
        staleTime: 60_000,
    });
    const resumo = useMemo(() => resumirDocumentos(docsQ.data ?? []), [docsQ.data]);
    return { resumo, liquidacoes: liqQ.data ?? [], carregando: docsQ.isLoading || liqQ.isLoading };
}
