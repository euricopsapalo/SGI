import api from './api';

/**
 * #165 — Cliente do Módulo de Vendas de Intervenções (fase 2): OTs disponíveis,
 * rascunho, emissão de faturas e estado de faturação (v11 §4, §5.1).
 */

export interface OtDisponivel {
    id: number; numero: string | null; descricao: string; naturezaIntervencao: string | null;
    dataFim: string | null; clienteId: number | null; clienteNome: string | null; nrSerie: string | null;
    linhas: number; valorSemIva: number; rascunhoId: number | null;
}

export interface DocumentoVendaLinha {
    id: number; otArtigoId: number | null; artigoId: number | null; descricao: string;
    quantidade: number; precoUnitario: number; desconto: number; codigoIva: string | null; taxaIva: number;
    totalLiquido: number; qtdEstornada: number; ordem: number;
}

export type EstadoDocumentoVenda = 'RASCUNHO' | 'EMITIDO';
export type EstadoFaturacao = 'Não faturada' | 'Pendente' | 'Parcialmente paga' | 'Paga';

export interface DocumentoVenda {
    id: number; documentoConfigId: number; documentoCodigo: string; documentoDescricao: string; tipoFiscal: string | null;
    serieId: number | null; serieCodigo: string | null; numero: number | null; numeroDocumento: string | null;
    dataHora: string | null; estado: EstadoDocumentoVenda;
    clienteId: number; clienteNome: string; clienteNif: string | null;
    otId: number; otNumero: string | null; referencia: string | null; observacoes: string | null;
    modoPagamentoId: number | null; modoPagamentoDescricao: string | null;
    descontoGlobal: number; subtotal: number; desconto: number; valorIva: number; total: number; moeda: string;
    emitidoEm: string | null; createdAt: string;
    valorPendente: number | null; dataVencimento: string | null; estadoFaturacao: EstadoFaturacao | null;
    linhas?: DocumentoVendaLinha[];
    /** Só em rascunho: consumíveis faturáveis da OT (para repor linhas removidas). */
    consumiveis?: ConsumivelOt[];
}

export interface ConsumivelOt {
    otArtigoId: number; artigoId: number | null; descricao: string;
    qtdConsumida: number; precoUnitario: number; taxaIva: number;
}

export interface LinhaRascunho { otArtigoId: number; descricao?: string; quantidade?: number; desconto?: number }
export interface AtualizarRascunho {
    observacoes?: string | null; modoPagamentoId?: number | null; descontoGlobal?: number; linhas?: LinhaRascunho[];
}

export const vendasApi = {
    otsDisponiveis: (semValor = false) =>
        api.get<OtDisponivel[]>('/vendas/ots-disponiveis', { params: semValor ? { semValor: true } : undefined }).then(r => r.data),
    documentos: (params?: { estado?: EstadoDocumentoVenda; otId?: number; clienteId?: number }) =>
        api.get<DocumentoVenda[]>('/vendas/documentos', { params }).then(r => r.data),
    documento: (id: number) => api.get<DocumentoVenda>(`/vendas/documentos/${id}`).then(r => r.data),
    criarRascunho: (otId: number, documentoConfigId: number) =>
        api.post<DocumentoVenda>('/vendas/documentos', { otId, documentoConfigId }).then(r => r.data),
    atualizarRascunho: (id: number, dto: AtualizarRascunho) =>
        api.put<DocumentoVenda>(`/vendas/documentos/${id}`, dto).then(r => r.data),
    eliminarRascunho: (id: number) => api.delete(`/vendas/documentos/${id}`),
    emitir: (id: number, dto: { serieId?: number; dataHora?: string }) =>
        api.post<DocumentoVenda>(`/vendas/documentos/${id}/emitir`, dto).then(r => r.data),
};

/** Perfis (etiqueta do frontend) que podem faturar — espelha o `@Roles` do backend. */
export const PERFIS_FATURACAO = ['Administrador', 'Coordenador', 'Vendedor'];

const round2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

/**
 * Pré-visualização dos totais no editor — mesmo cálculo do backend (`vendas.rules.ts`):
 * desconto de linha → desconto global sobre o subtotal → IVA linha a linha.
 * O valor que conta é sempre o devolvido pelo servidor.
 */
export function calcularTotais(
    linhas: { quantidade: number; precoUnitario: number; desconto: number; taxaIva: number }[],
    descontoGlobal = 0,
) {
    const fator = 1 - (Number(descontoGlobal) || 0) / 100;
    const liquidos = linhas.map(l => round2(Number(l.quantidade) * Number(l.precoUnitario) * (1 - (Number(l.desconto) || 0) / 100)));
    const subtotal = round2(liquidos.reduce((s, v) => s + v, 0));
    const desconto = round2(subtotal * (1 - fator));
    const valorIva = round2(linhas.reduce((s, l, i) => s + round2(liquidos[i] * fator * Number(l.taxaIva) / 100), 0));
    return { linhas: liquidos, subtotal, desconto, valorIva, total: round2(subtotal - desconto + valorIva) };
}

/** Valor para um `<input type="datetime-local">` a partir de um instante (hora local do browser). */
export function paraDataHoraLocal(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
