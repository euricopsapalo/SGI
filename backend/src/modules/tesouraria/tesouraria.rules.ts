import { round2 } from '../vendas/vendas.rules';

/**
 * #166/#174 — Regras puras de tesouraria e conta corrente (v10 §6.1–6.5).
 */

export interface MovimentoLiquidavel {
    id: number;
    clienteId: number;
    ccTipoId: number;
    ccEstadoId: number;
    natureza: 'D' | 'C';
    valorPendente: number;
    modoPagamentoId: number | null;
}

export interface LinhaPedida { movimentoCcId: number; valorPago: number; desconto?: number }

/**
 * Valida as linhas de uma liquidação contra os movimentos (lidos sob bloqueio).
 * - o movimento existe, é do cliente, da conta/estado sobre que o documento opera e a débito;
 * - valor pago + desconto > 0 e ≤ pendente actual (o pendente nunca fica negativo);
 * - sem movimentos repetidos.
 * Devolve erros no formato `linhas.N.campo` (para o frontend mostrar junto à linha).
 */
export function validarLinhasLiquidacao(
    linhas: LinhaPedida[],
    movimentos: Map<number, MovimentoLiquidavel>,
    ctx: { clienteId: number; ccTipoId: number | null; ccEstadoId: number | null },
): Record<string, string> {
    const erros: Record<string, string> = {};
    const vistos = new Set<number>();
    linhas.forEach((l, i) => {
        const k = `linhas.${i}`;
        const m = movimentos.get(l.movimentoCcId);
        if (vistos.has(l.movimentoCcId)) { erros[`${k}.movimentoCcId`] = 'Documento repetido na liquidação'; return; }
        vistos.add(l.movimentoCcId);
        if (!m) { erros[`${k}.movimentoCcId`] = 'Pendente não encontrado'; return; }
        if (m.clienteId !== ctx.clienteId) { erros[`${k}.movimentoCcId`] = 'O pendente é de outro cliente'; return; }
        if (m.ccTipoId !== ctx.ccTipoId || m.ccEstadoId !== ctx.ccEstadoId) {
            erros[`${k}.movimentoCcId`] = 'O pendente não está na conta corrente/estado sobre que este documento opera';
            return;
        }
        if (m.natureza !== 'D') { erros[`${k}.movimentoCcId`] = 'Só se recebem movimentos a débito'; return; }
        const pago = Number(l.valorPago ?? 0);
        const desconto = Number(l.desconto ?? 0);
        if (pago < 0 || desconto < 0 || round2(pago + desconto) <= 0) {
            erros[`${k}.valorPago`] = 'Indique o valor a pagar';
        } else if (round2(pago + desconto) > round2(Number(m.valorPendente))) {
            erros[`${k}.valorPago`] = `O valor a pagar (com desconto) excede o pendente (${round2(Number(m.valorPendente))})`;
        }
    });
    return erros;
}

/** Valor pago por modo de pagamento — um Movimento em conta por modo (o modo qualifica o movimento). */
export function valorPorModo(
    linhas: LinhaPedida[],
    movimentos: Map<number, MovimentoLiquidavel>,
): Map<number | null, number> {
    const out = new Map<number | null, number>();
    for (const l of linhas) {
        const modo = movimentos.get(l.movimentoCcId)?.modoPagamentoId ?? null;
        out.set(modo, round2((out.get(modo) ?? 0) + Number(l.valorPago ?? 0)));
    }
    return out;
}

/** #187 — Modos de pagamento em numerário (código `movimento` da tabela `modos_pagamento`). */
export const MOVIMENTOS_NUMERARIO = ['NUM', 'PGNUM'];

export const eNumerario = (movimento: string | null | undefined) =>
    !!movimento && MOVIMENTOS_NUMERARIO.includes(movimento.trim().toUpperCase());

/** Dias em atraso face ao vencimento (0 se ainda não venceu). Datas `YYYY-MM-DD`. */
export function diasAtraso(dataVencimento: string, hoje: string): number {
    const ms = Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${dataVencimento}T00:00:00Z`);
    return ms > 0 ? Math.round(ms / 86_400_000) : 0;
}

/**
 * #174 — Interpreta o filtro "n.º de documento": texto livre (ex.: `FT 2026/1`,
 * `2026/1`) pesquisado sobre a identificação completa, e — se for só dígitos —
 * também o número exacto.
 */
export function termoNumeroDocumento(q: string | undefined): { texto: string; numero: number | null } | null {
    const t = (q ?? '').trim();
    if (!t) return null;
    return { texto: t, numero: /^\d+$/.test(t) ? Number(t) : null };
}

export interface LinhaExtrato {
    data: string;
    documento: string;
    debito: number;
    credito: number;
    desconto: number;
}

/** v10 §6.5 — saldo corrido (débito − crédito) a partir do saldo anterior. */
export function saldoCorrido<T extends LinhaExtrato>(linhas: T[], saldoAnterior = 0): (T & { saldo: number })[] {
    let saldo = round2(saldoAnterior);
    return linhas.map((l) => {
        saldo = round2(saldo + Number(l.debito) - Number(l.credito));
        return { ...l, saldo };
    });
}
