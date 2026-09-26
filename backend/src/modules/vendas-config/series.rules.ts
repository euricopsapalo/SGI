/**
 * #164 — Motor de séries (v10 §2.1). Funções puras; a emissão (fase 2) chama
 * `proximaEmissao` com a série bloqueada (`SELECT … FOR UPDATE`).
 *
 * O ano de um instante é calculado no fuso de Luanda (WAT, UTC+1): um documento
 * emitido a 01/01 às 00:30 locais pertence ao ano novo, embora em UTC ainda seja 31/12.
 */

export const FUSO_EMPRESA = 'Africa/Luanda';

export interface SerieEstado {
    codigo: string;
    ano: number;
    limiteInferior: number;
    limiteSuperior: number;
    ultimoNumero: number | null;
    ultimaDataHora: Date | null;
    ativo: boolean;
}

export class SerieInvalidaError extends Error {}

/** Datas inicial e final da série — sempre o ano civil completo (YYYY-MM-DD). */
export function datasDaSerie(ano: number): { dataInicial: string; dataFinal: string } {
    return { dataInicial: `${ano}-01-01`, dataFinal: `${ano}-12-31` };
}

/** Ano civil de um instante, no fuso da empresa. */
export function anoLocal(instante: Date): number {
    return Number(new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_EMPRESA, year: 'numeric' }).format(instante));
}

/** A série já emitiu documentos? (R2 — congela limites e datas). */
export function serieEmUso(s: Pick<SerieEstado, 'ultimoNumero'>): boolean {
    return s.ultimoNumero !== null && s.ultimoNumero !== undefined;
}

/**
 * Valida uma emissão na série e devolve o número a atribuir.
 * 1. Série activa.
 * 2. Data-hora dentro do ano da série.
 * 3. Data-hora estritamente superior à do último documento (sem registo retroactivo).
 * 4. Número seguinte dentro do limite superior — senão é preciso criar nova série.
 */
export function proximaEmissao(s: SerieEstado, dataHora: Date): number {
    if (!s.ativo) throw new SerieInvalidaError(`A série ${s.codigo} está inactiva`);
    if (Number.isNaN(dataHora.getTime())) throw new SerieInvalidaError('Data-hora do documento inválida');

    const ano = anoLocal(dataHora);
    if (ano !== s.ano) {
        const { dataInicial, dataFinal } = datasDaSerie(s.ano);
        throw new SerieInvalidaError(
            `A data do documento está fora do intervalo da série ${s.codigo} (${dataInicial} a ${dataFinal})`,
        );
    }
    if (s.ultimaDataHora && dataHora.getTime() <= new Date(s.ultimaDataHora).getTime()) {
        throw new SerieInvalidaError(
            `A data-hora tem de ser posterior à do último documento da série ${s.codigo} ` +
            `(${new Date(s.ultimaDataHora).toISOString()}). Para registar um documento anterior, use uma série nova.`,
        );
    }
    const numero = (s.ultimoNumero ?? s.limiteInferior) + 1;
    if (numero > s.limiteSuperior) {
        throw new SerieInvalidaError(
            `A série ${s.codigo} atingiu o limite superior (${s.limiteSuperior}). Crie uma nova série.`,
        );
    }
    return numero;
}
