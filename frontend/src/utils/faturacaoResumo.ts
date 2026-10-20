import type { DocumentoVenda } from '../services/vendas';
import type { Liquidacao } from '../services/tesouraria';

/**
 * #206 — Resumo de faturação a partir dos documentos de venda emitidos (#165)
 * e das liquidações (recibos), em vez da tabela antiga `faturas`.
 *
 * - O valor de cada documento tem sinal: as NC (`natureza = A_PAGAR`) abatem,
 *   como em /vendas/relatorios (#170).
 * - "Em aberto" é uma fatura (não um estorno) Pendente ou Parcialmente paga.
 * - O recebido vem das liquidações (inclui as automáticas das FR, #168); um
 *   estorno de liquidação (ERE) abate.
 */
export interface FaturaResumo {
    id: number;
    otId: string;
    clienteId: string;
    /** Data de emissão (local, YYYY-MM-DD). */
    data: string;
    /** Total com sinal: NC negativo. */
    valor: number;
    emAberto: boolean;
}

/** Data local (WAT) em YYYY-MM-DD — evita o desvio de dia do `toISOString` (UTC). */
export const dataLocal = (iso: string | null | undefined): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso.slice(0, 10);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const resumirDocumentos = (docs: DocumentoVenda[]): FaturaResumo[] =>
    docs.filter(d => d.estado === 'EMITIDO').map(d => {
        const sinal = d.naturezaDocumento === 'A_PAGAR' ? -1 : 1;
        return {
            id: d.id,
            otId: d.otId != null ? String(d.otId) : '',
            clienteId: d.clienteId != null ? String(d.clienteId) : '',
            data: dataLocal(d.dataHora),
            valor: sinal * (Number(d.total) || 0),
            emAberto: !d.documentoOrigemId && (d.estadoFaturacao === 'Pendente' || d.estadoFaturacao === 'Parcialmente paga'),
        };
    });

/** Σ dos documentos emitidos no mês (YYYY-MM), com as NC a abater. */
export const faturadoNoMes = (resumo: FaturaResumo[], mes: string): number =>
    resumo.filter(f => f.data.startsWith(mes)).reduce((s, f) => s + f.valor, 0);

/** Σ recebido no mês (YYYY-MM) pelas liquidações; os estornos de liquidação abatem. */
export const recebidoNoMes = (liquidacoes: Liquidacao[], mes: string): number =>
    liquidacoes
        .filter(l => dataLocal(l.dataHora).startsWith(mes))
        .reduce((s, l) => s + (l.eEstorno ? -1 : 1) * (Number(l.total) || 0), 0);

/** Σ faturado por chave (OT, cliente…). */
export const somarPor = (resumo: FaturaResumo[], chave: (f: FaturaResumo) => string): Map<string, number> => {
    const m = new Map<string, number>();
    for (const f of resumo) {
        const k = chave(f);
        if (k) m.set(k, (m.get(k) ?? 0) + f.valor);
    }
    return m;
};
