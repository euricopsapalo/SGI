import { round2 } from '../vendas/vendas.rules';

/**
 * #167 — Regras puras da gestão de caixa (v10 §6.4, v11 §5.5).
 */

/** Valor sugerido na abertura: o contado no fecho anterior (0 na primeira abertura). */
export function valorSugerido(ultimoFecho: { valorContado: number | string | null } | null | undefined): number {
    return round2(Number(ultimoFecho?.valorContado ?? 0));
}

export interface ResumoSessao {
    abertura: number;
    entradas: number;
    saidas: number;
    saldoTeorico: number;
}

/**
 * Saldo teórico = abertura (declarado) + entradas − saídas.
 * `movimentos` são os valores com sinal dos movimentos em conta da sessão,
 * excluindo os acertos do fecho (que resultam do próprio apuramento).
 */
export function resumoSessao(valorDeclarado: number | string, movimentos: (number | string)[]): ResumoSessao {
    const abertura = round2(Number(valorDeclarado));
    let entradas = 0;
    let saidas = 0;
    for (const v of movimentos.map(Number)) {
        if (v > 0) entradas += v; else saidas -= v;
    }
    entradas = round2(entradas);
    saidas = round2(saidas);
    return { abertura, entradas, saidas, saldoTeorico: round2(abertura + entradas - saidas) };
}

export type TipoAcerto = 'SOBRA' | 'QUEBRA';

/** Apuramento no fecho: diferença = contado − teórico; > 0 é sobra, < 0 é quebra. */
export function apuramento(saldoTeorico: number, valorContado: number): { diferenca: number; acerto: TipoAcerto | null } {
    const diferenca = round2(Number(valorContado) - Number(saldoTeorico));
    return { diferenca, acerto: diferenca > 0 ? 'SOBRA' : diferenca < 0 ? 'QUEBRA' : null };
}

/** Uma saída não pode deixar a caixa com saldo teórico negativo. Devolve a mensagem de erro, se houver. */
export function validarSaida(valor: number, saldoTeorico: number): string | null {
    const v = round2(Number(valor));
    if (!(v > 0)) return 'O valor da saída tem de ser superior a zero';
    if (v > round2(saldoTeorico)) return `O valor da saída excede o saldo da caixa (${round2(saldoTeorico)})`;
    return null;
}
