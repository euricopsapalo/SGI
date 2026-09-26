/**
 * #178 — Valor por extenso em português (norma europeia/angolana), para faturas e
 * recibos: "Cento e seis mil, novecentos e cinquenta e um Kwanzas e oitenta e
 * sete Cêntimos". Suporta até 999 999 999 999,99.
 */

const UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
    'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezasseis', 'dezassete', 'dezoito', 'dezanove'];
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

/** 0–999 por extenso (0 → ''). */
function ate999(n: number): string {
    if (n === 0) return '';
    if (n === 100) return 'cem';
    const partes: string[] = [];
    const c = Math.floor(n / 100);
    const r = n % 100;
    if (c) partes.push(CENTENAS[c]);
    if (r < 20) { if (r) partes.push(UNIDADES[r]); }
    else {
        partes.push(DEZENAS[Math.floor(r / 10)]);
        if (r % 10) partes.push(UNIDADES[r % 10]);
    }
    return partes.join(' e ');
}

/** Inteiro por extenso (0 → 'zero'). Grupos ligados por "e" quando o seguinte é < 100 ou centena redonda; senão por vírgula. */
export function inteiroPorExtenso(valor: number): string {
    let n = Math.floor(Math.abs(valor));
    if (n === 0) return 'zero';
    const escalas: [number, string, string][] = [
        [1e9, 'mil milhões', 'mil milhões'],
        [1e6, 'milhão', 'milhões'],
        [1e3, 'mil', 'mil'],
        [1, '', ''],
    ];
    const grupos: { valor: number; texto: string }[] = [];
    for (const [escala, singular, plural] of escalas) {
        const g = Math.floor(n / escala);
        n %= escala;
        if (!g) continue;
        let texto: string;
        if (escala === 1) texto = ate999(g);
        else if (escala === 1e3) texto = g === 1 ? 'mil' : `${ate999(g)} mil`;
        else if (escala === 1e9) texto = g === 1 ? 'mil milhões' : `${ate999(g)} ${plural}`;
        else texto = g === 1 ? `um ${singular}` : `${ate999(g)} ${plural}`;
        grupos.push({ valor: g, texto });
    }
    return grupos.reduce((acc, g, i) => {
        if (i === 0) return g.texto;
        const liga = g.valor < 100 || g.valor % 100 === 0 ? ' e ' : ', ';
        return acc + liga + g.texto;
    }, '');
}

export interface NomesMoeda { singular: string; plural: string; centSingular: string; centPlural: string }

export const KWANZA: NomesMoeda = { singular: 'Kwanza', plural: 'Kwanzas', centSingular: 'Cêntimo', centPlural: 'Cêntimos' };

/** Valor monetário por extenso, com a primeira letra maiúscula. */
export function valorPorExtenso(valor: number, moeda: NomesMoeda = KWANZA): string {
    const centimosTotal = Math.round(Math.abs(Number(valor) || 0) * 100);
    const inteiro = Math.floor(centimosTotal / 100);
    const cent = centimosTotal % 100;

    const partes: string[] = [];
    if (inteiro > 0 || cent === 0) {
        const txt = inteiroPorExtenso(inteiro);
        // "um milhão de Kwanzas", "dois milhões de Kwanzas" — "de" quando termina em milhão/milhões redondos.
        const de = inteiro >= 1e6 && inteiro % 1e6 === 0 ? ' de' : '';
        partes.push(`${txt}${de} ${inteiro === 1 ? moeda.singular : moeda.plural}`);
    }
    if (cent > 0) partes.push(`${inteiroPorExtenso(cent)} ${cent === 1 ? moeda.centSingular : moeda.centPlural}`);
    const texto = partes.join(' e ');
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}
