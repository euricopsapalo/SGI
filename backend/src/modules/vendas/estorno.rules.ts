import { round2 } from './vendas.rules';

/**
 * #169 — Regras puras do estorno (v11 §5.3, v10 §7): quantidades estornáveis,
 * abate do pendente do documento de origem e documento "totalmente estornado".
 */

export interface LinhaEstornavel {
    id: number;
    quantidade: number | string;
    qtdEstornada: number | string;
}

export interface LinhaEstornoPedida {
    linhaId: number;
    quantidade: number;
    motivoEstornoId: number;
}

/** Quantidade que ainda se pode estornar numa linha. */
export const qtdEstornavel = (l: LinhaEstornavel): number =>
    Math.round((Number(l.quantidade) - Number(l.qtdEstornada)) * 1000) / 1000;

/**
 * Valida as linhas pedidas contra as linhas do documento de origem (lidas sob bloqueio):
 * a linha pertence ao documento, não se repete, a quantidade é > 0 e ≤ ao que falta
 * estornar, e o motivo existe e está activo. Erros no formato `linhas.N.campo`.
 */
export function validarLinhasEstorno(
    pedidas: LinhaEstornoPedida[],
    origem: Map<number, LinhaEstornavel>,
    motivosAtivos: Set<number>,
): Record<string, string> {
    const erros: Record<string, string> = {};
    const vistas = new Set<number>();
    pedidas.forEach((p, i) => {
        const k = `linhas.${i}`;
        const l = origem.get(p.linhaId);
        if (!l) { erros[`${k}.linhaId`] = 'A linha não pertence ao documento a estornar'; return; }
        if (vistas.has(p.linhaId)) { erros[`${k}.linhaId`] = 'Linha repetida no estorno'; return; }
        vistas.add(p.linhaId);
        const falta = qtdEstornavel(l);
        if (!(Number(p.quantidade) > 0)) {
            erros[`${k}.quantidade`] = 'Indique a quantidade a estornar';
        } else if (Number(p.quantidade) > falta) {
            erros[`${k}.quantidade`] = falta > 0
                ? `A quantidade excede a ainda por estornar (${falta})`
                : 'A linha já foi totalmente estornada';
        }
        if (!motivosAtivos.has(p.motivoEstornoId)) erros[`${k}.motivoEstornoId`] = 'Indique um motivo de estorno válido';
    });
    return erros;
}

/** Depois de aplicadas as quantidades, todas as linhas ficam totalmente estornadas? */
export function totalmenteEstornado(linhas: LinhaEstornavel[]): boolean {
    return linhas.length > 0 && linhas.every((l) => qtdEstornavel(l) <= 0);
}

/**
 * v11 §5.3 — o estorno abate automaticamente o pendente do documento de origem;
 * o que sobrar (origem já paga, total ou parcialmente) fica pendente no próprio
 * estorno — na NC é o saldo a favor do cliente.
 */
export function abaterPendente(pendenteOrigem: number, valorEstorno: number) {
    const abatido = round2(Math.max(0, Math.min(Number(pendenteOrigem), Number(valorEstorno))));
    return {
        abatido,
        pendenteOrigem: round2(Number(pendenteOrigem) - abatido),
        pendenteEstorno: round2(Number(valorEstorno) - abatido),
    };
}
