import { round2 } from './vendas.rules';

/**
 * #170 — Relatórios de Vendas (v11 fase 7): regras puras de agregação.
 * As NC (natureza `A_PAGAR`) entram a negativo; FT/FR/ND a positivo.
 */

export interface DocRelatorio {
    id: number; numeroDocumento: string; codigo: string; natureza: string | null; data: string;
    clienteId: number; clienteNome: string; clienteNif: string | null;
    otId: number | null; otNumero: string | null;
    subtotal: number; desconto: number; valorIva: number; total: number;
}

export interface LinhaIvaRelatorio {
    natureza: string | null; codigoIva: string | null; taxaIva: number; totalLiquido: number; descontoGlobal: number;
}

export interface PendenteRelatorio {
    clienteId: number; clienteNome: string; clienteNif: string | null;
    natureza: 'D' | 'C'; dataVencimento: string; valorPendente: number;
}

/** Sinal do documento: NC (a pagar ao cliente) abate; os restantes somam. */
export const sinal = (natureza: string | null): 1 | -1 => (natureza === 'A_PAGAR' ? -1 : 1);

/** Valores agregados de um conjunto de documentos. */
export interface Acumulado { documentos: number; faturado: number; creditos: number; iva: number; liquido: number }
const vazio = (): Acumulado => ({ documentos: 0, faturado: 0, creditos: 0, iva: 0, liquido: 0 });

function acumular(a: Acumulado, d: DocRelatorio) {
    const s = sinal(d.natureza);
    a.documentos += 1;
    if (s > 0) a.faturado = round2(a.faturado + Number(d.total));
    else a.creditos = round2(a.creditos + Number(d.total));
    a.iva = round2(a.iva + s * Number(d.valorIva));
    a.liquido = round2(a.liquido + s * Number(d.total));
}

function agrupar<K, T extends Acumulado>(docs: DocRelatorio[], chave: (d: DocRelatorio) => K, novo: (d: DocRelatorio) => T): T[] {
    const grupos = new Map<K, T>();
    for (const d of docs) {
        const k = chave(d);
        const g = grupos.get(k) ?? novo(d);
        acumular(g, d);
        grupos.set(k, g);
    }
    return [...grupos.values()];
}

/** Faturação por mês (YYYY-MM), por ordem cronológica. */
export const porPeriodo = (docs: DocRelatorio[]) =>
    agrupar(docs, (d) => d.data.slice(0, 7), (d) => ({ mes: d.data.slice(0, 7), ...vazio() }))
        .sort((a, b) => a.mes.localeCompare(b.mes));

/** Faturação por cliente, do maior valor líquido para o menor. */
export const porCliente = (docs: DocRelatorio[]) =>
    agrupar(docs, (d) => d.clienteId, (d) => ({ clienteId: d.clienteId, nome: d.clienteNome, nif: d.clienteNif, ...vazio() }))
        .sort((a, b) => b.liquido - a.liquido || a.nome.localeCompare(b.nome));

/** Faturação por OT, com os documentos que a faturaram/estornaram. */
export function porOt(docs: DocRelatorio[]) {
    const comOt = docs.filter((d) => d.otId != null);
    const grupos = agrupar(comOt, (d) => d.otId, (d) => ({
        otId: d.otId as number, otNumero: d.otNumero, clienteNome: d.clienteNome, numeros: [] as string[], ...vazio(),
    }));
    for (const g of grupos) g.numeros = comOt.filter((d) => d.otId === g.otId).map((d) => d.numeroDocumento);
    return grupos.sort((a, b) => (b.otNumero ?? '').localeCompare(a.otNumero ?? ''));
}

/** IVA por código/taxa (incidência após desconto global), com as NC a abater. */
export function ivaPorTaxa(linhas: LinhaIvaRelatorio[]) {
    const grupos = new Map<string, { codigoIva: string | null; taxa: number; incidencia: number; valor: number }>();
    for (const l of linhas) {
        const taxa = Number(l.taxaIva);
        const chave = `${l.codigoIva ?? ''}|${taxa}`;
        const base = round2(sinal(l.natureza) * Number(l.totalLiquido) * (1 - Number(l.descontoGlobal || 0) / 100));
        const g = grupos.get(chave) ?? { codigoIva: l.codigoIva, taxa, incidencia: 0, valor: 0 };
        g.incidencia = round2(g.incidencia + base);
        g.valor = round2(g.valor + round2(base * taxa / 100));
        grupos.set(chave, g);
    }
    return [...grupos.values()].sort((a, b) => b.taxa - a.taxa);
}

/** Dias entre o vencimento e a data de referência (negativo = ainda não venceu). */
export function diasAtraso(dataVencimento: string, hoje: string): number {
    return Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${dataVencimento}T00:00:00Z`)) / 86_400_000);
}

const ESCALOES = ['naoVencido', 'ate30', 'ate60', 'ate90', 'mais90'] as const;
type Escalao = typeof ESCALOES[number];

export function escalao(dias: number): Escalao {
    if (dias <= 0) return 'naoVencido';
    if (dias <= 30) return 'ate30';
    if (dias <= 60) return 'ate60';
    if (dias <= 90) return 'ate90';
    return 'mais90';
}

/**
 * Contas a receber por cliente, por antiguidade do vencimento. Os créditos em
 * aberto (saldo a favor do cliente, `C`) abatem ao total e ficam em coluna própria.
 */
export function contasReceber(pendentes: PendenteRelatorio[], hoje: string) {
    type Linha = Record<Escalao, number> & {
        clienteId: number; nome: string; nif: string | null; documentos: number; saldoFavor: number; total: number;
    };
    const grupos = new Map<number, Linha>();
    for (const p of pendentes) {
        const v = Number(p.valorPendente);
        if (v <= 0) continue;
        const g = grupos.get(p.clienteId) ?? {
            clienteId: p.clienteId, nome: p.clienteNome, nif: p.clienteNif, documentos: 0,
            naoVencido: 0, ate30: 0, ate60: 0, ate90: 0, mais90: 0, saldoFavor: 0, total: 0,
        };
        g.documentos += 1;
        if (p.natureza === 'C') {
            g.saldoFavor = round2(g.saldoFavor + v);
            g.total = round2(g.total - v);
        } else {
            const e = escalao(diasAtraso(p.dataVencimento, hoje));
            g[e] = round2(g[e] + v);
            g.total = round2(g.total + v);
        }
        grupos.set(p.clienteId, g);
    }
    const linhas = [...grupos.values()].sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
    const soma = (k: Escalao | 'saldoFavor' | 'total' | 'documentos') => round2(linhas.reduce((s, l) => s + l[k], 0));
    return {
        linhas,
        totais: {
            documentos: soma('documentos'), naoVencido: soma('naoVencido'), ate30: soma('ate30'), ate60: soma('ate60'),
            ate90: soma('ate90'), mais90: soma('mais90'), saldoFavor: soma('saldoFavor'), total: soma('total'),
        },
    };
}

/** Totais do período (o mesmo acumulado das tabelas, sobre todos os documentos). */
export function totaisPeriodo(docs: DocRelatorio[]) {
    const a = vazio();
    for (const d of docs) acumular(a, d);
    return a;
}
