import api from './api';
import type { SysLog } from '../contexts/GlobalContext';

/** #210 — registos do sistema, paginados e filtrados no servidor (só admin). */

export interface LogsFiltros {
    pagina?: number;
    porPagina?: number;
    usuario?: string;
    modulo?: string;
    tipo?: SysLog['tipo'] | '';
    q?: string;
    de?: string;
    ate?: string;
}

export interface LogsResposta {
    items: SysLog[];
    total: number;
    pagina: number;
    porPagina: number;
    porTipo: Record<SysLog['tipo'], number>;
    modulos: string[];
}

/** Retira os filtros vazios (o backend rejeita valores inválidos, p.ex. tipo ''). */
export const limparFiltros = (f: LogsFiltros): LogsFiltros => {
    const r: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(f)) {
        if (v === undefined || v === null) continue;
        if (typeof v === 'string' && v.trim() === '') continue;
        r[k] = typeof v === 'string' ? v.trim() : v;
    }
    return r as LogsFiltros;
};

const normLog = (r: any): SysLog => ({
    id: String(r.id),
    timestamp: r.timestamp,
    usuario: r.usuario ?? '',
    modulo: r.modulo ?? '',
    acao: r.acao ?? '',
    detalhes: r.detalhes ?? '',
    tipo: r.tipo,
});

export const listarLogs = async (f: LogsFiltros): Promise<LogsResposta> => {
    const { data } = await api.get('/logs', { params: limparFiltros(f) });
    return { ...data, items: (data.items ?? []).map(normLog) };
};
