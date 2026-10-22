import api from './api';
import type { MovimentoStock, TipoMovimento } from '../contexts/GlobalContext';

/** #221 — movimentos de stock paginados e filtrados no servidor (já não vêm no login). */

export interface MovimentosFiltros {
    pagina?: number;
    porPagina?: number;
    tipo?: TipoMovimento | '';
    artigoId?: number;
    q?: string;
    de?: string;
    ate?: string;
}

export interface MovimentoLinha extends MovimentoStock {
    artigoCodigo: string;
    artigoDescricao: string;
}

export interface MovimentosResposta {
    items: MovimentoLinha[];
    total: number;
    pagina: number;
    porPagina: number;
    porTipo: Record<TipoMovimento, number>;
}

const limpar = (f: MovimentosFiltros) => {
    const r: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(f)) {
        if (v === undefined || v === null) continue;
        if (typeof v === 'string' && v.trim() === '') continue;
        r[k] = typeof v === 'string' ? v.trim() : v;
    }
    return r;
};

export const normMovimentoLinha = (m: any): MovimentoLinha => ({
    ...m,
    id: m.id?.toString(),
    artigoId: m.artigoId?.toString() ?? m.artigo?.id?.toString() ?? '',
    armazemId: m.armazemId ?? '',
    armazemDestinoId: m.armazemDestinoId ?? '',
    quantidade: Number(m.quantidade),
    data: m.data ? String(m.data).split('T')[0] : '',
    artigoCodigo: m.artigo?.codigo ?? '',
    artigoDescricao: m.artigo?.descricao ?? '',
});

export const listarMovimentos = async (f: MovimentosFiltros): Promise<MovimentosResposta> => {
    const { data } = await api.get('/movimentos-stock', { params: limpar(f) });
    return { ...data, items: (data.items ?? []).map(normMovimentoLinha) };
};
