import { createHash } from 'crypto';
import { FUSO_EMPRESA } from '../vendas-config/series.rules';

/**
 * #165 — Regras puras do documento de venda (v11 §4–§5.1): totais, natureza do
 * movimento de conta corrente, vencimento e estado de faturação da OT.
 */

export const round2 = (x: number): number => Math.round((x + Number.EPSILON) * 100) / 100;

export interface LinhaCalculo {
    quantidade: number;
    precoUnitario: number;
    /** Desconto de linha em %. */
    desconto: number;
    taxaIva: number;
}

export interface Totais {
    /** Total líquido de cada linha (qtd × preço − desconto de linha), pela mesma ordem. */
    linhas: number[];
    subtotal: number;
    /** Valor do desconto global. */
    desconto: number;
    valorIva: number;
    total: number;
}

/**
 * Totais do documento. O desconto global (%) aplica-se sobre o subtotal já com
 * os descontos de linha; o IVA incide, linha a linha, sobre a base após os dois
 * descontos (cada linha pode ter taxa diferente).
 */
export function calcularTotais(linhas: LinhaCalculo[], descontoGlobal = 0): Totais {
    const fatorGlobal = 1 - Number(descontoGlobal) / 100;
    const liquidos = linhas.map((l) =>
        round2(Number(l.quantidade) * Number(l.precoUnitario) * (1 - Number(l.desconto ?? 0) / 100)));
    const subtotal = round2(liquidos.reduce((s, v) => s + v, 0));
    const desconto = round2(subtotal * (1 - fatorGlobal));
    const valorIva = round2(linhas.reduce(
        (s, l, i) => s + round2(liquidos[i] * fatorGlobal * Number(l.taxaIva ?? 0) / 100), 0));
    return { linhas: liquidos, subtotal, desconto, valorIva, total: round2(subtotal - desconto + valorIva) };
}

/** Natureza do movimento de CC a partir da natureza configurada no documento. */
export function naturezaMovimento(naturezaDocumento: string | null): 'D' | 'C' {
    return naturezaDocumento === 'A_PAGAR' ? 'C' : 'D';
}

/** Data civil (YYYY-MM-DD) de um instante, no fuso da empresa. */
export function dataLocal(instante: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: FUSO_EMPRESA, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(instante);
}

/** Data de vencimento = data do documento + dias da condição de pagamento do cliente. */
export function dataVencimento(dataDocumento: string, dias = 0): string {
    const d = new Date(`${dataDocumento}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + Number(dias || 0));
    return d.toISOString().slice(0, 10);
}

/** Identificação legível: `FT 2026/1`. */
export function numeroDocumento(codigo: string, serie: string | null | undefined, numero: number | null | undefined): string | null {
    if (numero === null || numero === undefined || !serie) return null;
    return `${codigo} ${serie}/${numero}`;
}

/**
 * #178 — hash do documento: SHA-256 (base64) sobre data, data-hora, identificação,
 * total e o hash do documento anterior da mesma série — à semelhança do SAF-T,
 * qualquer alteração ou falha na sequência deixa de bater certo.
 * Mecanismo próprio do SGI (não é a assinatura certificada pela AGT).
 */
export function hashDocumento(p: {
    dataDocumento: string; dataHora: Date; numeroDocumento: string; total: number; hashAnterior: string | null;
}): string {
    const base = [p.dataDocumento, p.dataHora.toISOString(), p.numeroDocumento, Number(p.total).toFixed(2), p.hashAnterior ?? ''].join(';');
    return createHash('sha256').update(base, 'utf8').digest('base64');
}

/** Os 4 caracteres impressos no rodapé (1.º, 11.º, 21.º e 31.º do hash, como no SAF-T). */
export function codigoHash(hash: string | null | undefined): string | null {
    if (!hash || hash.length < 31) return null;
    return hash[0] + hash[10] + hash[20] + hash[30];
}

export enum EstadoFaturacao {
    NAO_FATURADA = 'Não faturada',
    PENDENTE = 'Pendente',
    PARCIALMENTE_PAGA = 'Parcialmente paga',
    PAGA = 'Paga',
    /** #169 — fatura totalmente estornada (a OT volta a *Não faturada*). */
    ESTORNADA = 'Estornada',
}

/**
 * v11 §4.4 — estado de faturação da OT (dimensão paralela à máquina de estados).
 * Sem documento activo → Não faturada; senão, pelo pendente do movimento de CC.
 * Um documento que não gera movimento em CC (liquidado no acto) conta como pago.
 * #169 — um documento totalmente estornado (NC total) é *Estornada*.
 */
export function estadoFaturacao(
    documentoVendaId: number | null | undefined,
    mov?: { valorOriginal: number; valorPendente: number } | null,
    estornado = false,
): EstadoFaturacao {
    if (!documentoVendaId) return EstadoFaturacao.NAO_FATURADA;
    if (estornado) return EstadoFaturacao.ESTORNADA;
    if (!mov) return EstadoFaturacao.PAGA;
    const pendente = Number(mov.valorPendente);
    if (pendente <= 0) return EstadoFaturacao.PAGA;
    if (pendente >= Number(mov.valorOriginal)) return EstadoFaturacao.PENDENTE;
    return EstadoFaturacao.PARCIALMENTE_PAGA;
}
