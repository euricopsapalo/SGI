import api from './api';
import type { ClienteImpressao, EmpresaImpressao, Via } from './vendas';

/**
 * #174 / #166 — Cliente da conta corrente e da tesouraria: pendentes filtráveis,
 * liquidações (`RE` → `MC`) e extrato (v10 §6.1–6.5).
 */

export interface PendentesFiltros {
    documento?: string;
    ot?: string;
    clienteId?: number;
    cliente?: string;
    dataTipo?: 'documento' | 'vencimento';
    de?: string;
    ate?: string;
    vencidosAte?: string;
    ccTipoId?: number;
    ccEstadoId?: number;
    ordem?: 'dataDocumento' | 'dataVencimento' | 'cliente' | 'valorPendente';
    direcao?: 'asc' | 'desc';
    pagina?: number;
    porPagina?: number;
}

export interface Pendente {
    movimentoCcId: number; natureza: 'D' | 'C';
    documentoVendaId: number | null; numeroDocumento: string | null;
    dataDocumento: string; dataVencimento: string; dataIntroducao: string; diasAtraso: number;
    clienteId: number; clienteNome: string; clienteNif: string | null;
    otId: number | null; otNumero: string | null;
    valorOriginal: number; valorPendente: number;
    ccTipoId: number; ccEstadoId: number; estadoCodigo: string | null;
    modoPagamentoId: number | null; modoPagamentoDescricao: string | null;
}

export interface PendentesResposta {
    items: Pendente[];
    pagina: number;
    porPagina: number;
    totais: { documentos: number; valorOriginal: number; valorPendente: number; vencido: number };
}

export interface LinhaLiquidacaoPedido { movimentoCcId: number; valorPago: number; desconto?: number }
export interface LiquidacaoPedido {
    documentoConfigId: number; clienteId: number; contaBancariaId: number;
    serieId?: number; dataHora?: string; observacoes?: string;
    /** #178 — referência do meio de pagamento (n.º de cheque/transferência). */
    referenciaPagamento?: string;
    linhas: LinhaLiquidacaoPedido[];
}

export interface Liquidacao {
    id: number; documentoConfigId: number; documentoCodigo: string; numeroDocumento: string;
    serieId: number; numero: number; dataHora: string;
    clienteId: number; clienteNome: string; contaBancariaId: number; contaCodigo: string; contaDescricao: string;
    total: number; desconto: number; moeda: string; observacoes: string | null; createdAt: string;
    linhas?: {
        id: number; movimentoCcId: number; valorPago: number; desconto: number; pendenteAnterior: number;
        numeroDocumento: string | null; otNumero: string | null; valorOriginal: number;
    }[];
    movimentosConta?: { id: number; numeroDocumento: string; valor: number; modoPagamentoDescricao: string | null; dataHora: string }[];
}

export interface LinhaExtrato {
    tipo: 'DOCUMENTO' | 'LIQUIDACAO'; id: number; data: string; dataExtrato: string;
    documento: string; otNumero: string | null; debito: number; credito: number; desconto: number; saldo: number;
}

export interface Extrato {
    cliente: { id: number; nome: string; nif: string | null };
    de: string | null; ate: string | null;
    saldoAnterior: number; saldoFinal: number;
    linhas: LinhaExtrato[];
    totais: { debito: number; credito: number; desconto: number };
}

/** Só os filtros preenchidos (a API rejeita valores vazios em campos de data). */
const limpo = <T extends object>(o: T) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Partial<T>;

export const tesourariaApi = {
    pendentes: (f: PendentesFiltros) => api.get<PendentesResposta>('/cc/pendentes', { params: limpo(f) }).then(r => r.data),
    extrato: (clienteId: number, de?: string, ate?: string) =>
        api.get<Extrato>('/cc/extrato', { params: limpo({ clienteId, de, ate }) }).then(r => r.data),
    liquidacoes: (clienteId?: number) => api.get<Liquidacao[]>('/liquidacoes', { params: limpo({ clienteId }) }).then(r => r.data),
    liquidacao: (id: number) => api.get<Liquidacao>(`/liquidacoes/${id}`).then(r => r.data),
    liquidar: (dto: LiquidacaoPedido) => api.post<Liquidacao>('/liquidacoes', dto).then(r => r.data),
    /** #178 — dados para imprimir o recibo (conta a impressão: Original / Segunda via). */
    imprimir: (id: number) => api.post<ReciboImpressao>(`/liquidacoes/${id}/imprimir`).then(r => r.data),
};

/* ── #167 — Gestão de caixa ─────────────────────────────────── */

export interface SessaoCaixa {
    id: number; estado: 'ABERTA' | 'FECHADA';
    contaBancariaId: number; contaCodigo?: string;
    aberturaDocumento: string | null; abertaEm: string;
    valorSugerido: number; valorDeclarado: number;
    entradas: number; saidas: number; saldoTeorico: number;
    fechoDocumento: string | null; fechadaEm: string | null;
    valorContado: number | null; diferenca: number | null;
    acertoDocumento: string | null; acertoValor: number | null;
    observacoesAbertura: string | null; observacoesFecho: string | null;
    movimentos?: {
        id: number; numeroDocumento: string | null; documentoDescricao: string | null;
        origemTipo: 'LIQUIDACAO' | 'SAIDA_CAIXA' | 'ACERTO_CAIXA'; origemId: number; origemDocumento: string | null;
        descricao: string | null; modoPagamentoDescricao: string | null; valor: number; dataHora: string;
    }[];
}

export interface EstadoCaixa {
    conta: { id: number; codigo: string; descricao: string; moeda: string; ativo: boolean; aberta: boolean };
    valorSugerido: number;
    sessao: SessaoCaixa | null;
    ultimoFecho: SessaoCaixa | null;
}

export const caixaApi = {
    listar: () => api.get<EstadoCaixa[]>('/caixa').then(r => r.data),
    caixa: (contaId: number) => api.get<EstadoCaixa>(`/caixa/${contaId}`).then(r => r.data),
    sessoes: (contaId: number) => api.get<SessaoCaixa[]>(`/caixa/${contaId}/sessoes`).then(r => r.data),
    sessao: (id: number) => api.get<SessaoCaixa>(`/caixa/sessoes/${id}`).then(r => r.data),
    abrir: (contaId: number, dto: { valorDeclarado: number; observacoes?: string }) =>
        api.post<SessaoCaixa>(`/caixa/${contaId}/abrir`, dto).then(r => r.data),
    saida: (contaId: number, dto: { valor: number; motivo: string }) =>
        api.post<SessaoCaixa>(`/caixa/${contaId}/saida`, dto).then(r => r.data),
    fechar: (contaId: number, dto: { valorContado: number; observacoes?: string }) =>
        api.post<SessaoCaixa>(`/caixa/${contaId}/fechar`, dto).then(r => r.data),
};

/** Diferença do fecho (contado − teórico): sobra > 0, quebra < 0 — espelha `apuramento` do backend. */
export function apuramentoCaixa(saldoTeorico: number, valorContado: number): { diferenca: number; acerto: 'SOBRA' | 'QUEBRA' | null } {
    const diferenca = Math.round((valorContado - saldoTeorico + Number.EPSILON) * 100) / 100;
    return { diferenca, acerto: diferenca > 0 ? 'SOBRA' : diferenca < 0 ? 'QUEBRA' : null };
}

export interface ReciboImpressao {
    via: Via;
    empresa: EmpresaImpressao;
    cliente: ClienteImpressao | null;
    documento: {
        descricao: string; codigo: string; tipoFiscal: string | null; numeroDocumento: string | null;
        dataHora: string; data: string; moeda: string; observacoes: string | null;
    };
    total: number;
    meios: { movimento: string | null; descricao: string | null; numero: string | null; balcao: string | null; valor: number }[];
    documentos: {
        numeroDocumento: string; prestacao: number; valorDocumento: number; valorAtribuido: number;
        desconto: number; retencao: number; pendente: number;
    }[];
    totais: { valorDocumento: number; valorAtribuido: number; desconto: number; retencao: number; pendente: number };
}

/** Filtros de pendentes ⇄ query string (os filtros ficam no URL — #174). */
export const CHAVES_FILTRO: (keyof PendentesFiltros)[] = [
    'documento', 'ot', 'clienteId', 'dataTipo', 'de', 'ate', 'vencidosAte', 'ordem', 'direcao', 'pagina',
];

export function filtrosDeUrl(sp: URLSearchParams): PendentesFiltros {
    const f: PendentesFiltros = {};
    for (const k of CHAVES_FILTRO) {
        const v = sp.get(k);
        if (!v) continue;
        (f as Record<string, unknown>)[k] = k === 'clienteId' || k === 'pagina' ? Number(v) : v;
    }
    return f;
}

export function filtrosParaUrl(f: PendentesFiltros, base: URLSearchParams): URLSearchParams {
    const sp = new URLSearchParams(base);
    for (const k of CHAVES_FILTRO) {
        const v = f[k];
        if (v === undefined || v === null || v === '') sp.delete(k);
        else sp.set(k, String(v));
    }
    return sp;
}

/**
 * Selecção para liquidar: só pendentes a débito e de um único cliente
 * (um recebimento é por entidade — v10 §6.3). Devolve o motivo de recusa, se houver.
 */
export function podeSelecionar(selecionados: Pendente[], p: Pendente): string | null {
    if (p.natureza !== 'D') return 'Só se recebem documentos a débito';
    if (selecionados.length && selecionados[0].clienteId !== p.clienteId) {
        return 'Um recebimento é de um só cliente — conclua ou limpe a selecção actual';
    }
    return null;
}
