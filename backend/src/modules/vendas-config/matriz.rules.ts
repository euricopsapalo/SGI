import type { DocCampo, DocMatrizCampo, DocMatrizCondicao, DocMatrizDominio, DocTipo } from './matriz.entity';

/**
 * #164 — Motor da matriz de configuração (v10 R1/R3/R4, v11 §3).
 *
 * Funções puras: recebem um retrato da matriz (metadados) e das tabelas
 * referenciadas, e devolvem a configuração normalizada ou os erros por campo.
 * Não há aqui nenhuma regra por tipo de documento — tudo vem dos metadados.
 */

export interface MatrizSnapshot {
    tipos: DocTipo[];
    campos: DocCampo[];
    nivel1: DocMatrizCampo[];
    condicoes: DocMatrizCondicao[];
    dominios: DocMatrizDominio[];
}

/** Tabelas referenciadas, reduzidas ao necessário para validar. */
export interface ReferenciasSnapshot {
    documentos: Array<{ id: number; codigo: string; tipoCodigo: string; natureza: string | null; ativo: boolean }>;
    series: Array<{ id: number; documentoConfigId: number }>;
    ccTipos: Array<{ id: number; entidade: string }>;
    ccEstados: Array<{ id: number; ccTipoId: number }>;
    contas: Array<{ id: number; ativo: boolean }>;
}

export type ValoresConfig = Record<string, unknown>;

export interface ResultadoValidacao {
    normalizado: ValoresConfig;
    erros: Record<string, string>;
}

/** Valor por omissão de um campo indisponível. */
export function valorPorOmissao(campo: Pick<DocCampo, 'tipoValor'>): unknown {
    if (campo.tipoValor === 'BOOLEAN') return false;
    if (campo.tipoValor === 'CONTAS_REF') return [];
    return null;
}

function eOmissao(campo: DocCampo, valor: unknown): boolean {
    if (valor === undefined || valor === null) return true;
    if (campo.tipoValor === 'BOOLEAN') return valor === false;
    if (campo.tipoValor === 'CONTAS_REF') return Array.isArray(valor) && valor.length === 0;
    return false;
}

/**
 * Campos disponíveis para um tipo, dados os valores actuais.
 * Nível 1 dá o conjunto base; o nível 2 acrescenta sub-campos cujo campo-pai
 * esteja disponível com o valor indicado, até estabilizar (sub-campos em cadeia).
 */
export function camposDisponiveis(m: MatrizSnapshot, tipoCodigo: string, valores: ValoresConfig): Set<string> {
    const disp = new Set(m.nivel1.filter((n) => n.tipoCodigo === tipoCodigo).map((n) => n.campoCodigo));
    let mudou = true;
    while (mudou) {
        mudou = false;
        for (const c of m.condicoes) {
            if (disp.has(c.campoCodigo) || !disp.has(c.campoPai)) continue;
            if (String(valores[c.campoPai] ?? '') === c.valorPai) {
                disp.add(c.campoCodigo);
                mudou = true;
            }
        }
    }
    return disp;
}

/** Valores elegíveis (nível 3) de um campo ENUM para um tipo. */
export function dominio(m: MatrizSnapshot, tipoCodigo: string, campoCodigo: string): DocMatrizDominio[] {
    return m.dominios.filter((d) => d.tipoCodigo === tipoCodigo && d.campoCodigo === campoCodigo);
}

/**
 * Valida e normaliza a configuração de um documento.
 * - Campo indisponível com valor diferente do de omissão → erro (o tipo restringe, R1).
 * - Campo indisponível → normalizado para o valor de omissão.
 * - Campo disponível: ENUM e referências são obrigatórios; ENUM tem de estar no domínio (nível 3);
 *   referências têm de existir, estar activas e respeitar o tipo exigido (R4).
 */
export function validarConfiguracao(
    m: MatrizSnapshot,
    refs: ReferenciasSnapshot,
    tipoCodigo: string,
    valores: ValoresConfig,
    selfId?: number,
): ResultadoValidacao {
    const erros: Record<string, string> = {};
    const normalizado: ValoresConfig = {};

    if (!m.tipos.some((t) => t.codigo === tipoCodigo)) {
        return { normalizado, erros: { tipoCodigo: `Tipo de documento "${tipoCodigo}" não existe` } };
    }

    const disp = camposDisponiveis(m, tipoCodigo, valores);
    const campos = [...m.campos].sort((a, b) => a.ordem - b.ordem);

    for (const campo of campos) {
        const valor = valores[campo.codigo];
        if (!disp.has(campo.codigo)) {
            if (!eOmissao(campo, valor)) {
                erros[campo.codigo] = `"${campo.descricao}" não está disponível para esta configuração`;
            }
            normalizado[campo.codigo] = valorPorOmissao(campo);
            continue;
        }
        const erro = validarCampo(m, refs, tipoCodigo, campo, valor, valores, selfId);
        if (erro) erros[campo.codigo] = erro;
        normalizado[campo.codigo] = normalizarValor(campo, valor);
    }

    return { normalizado, erros };
}

function normalizarValor(campo: DocCampo, valor: unknown): unknown {
    if (valor === undefined) return valorPorOmissao(campo);
    if (campo.tipoValor === 'CONTAS_REF' && Array.isArray(valor)) return [...new Set(valor.map(Number))];
    return valor;
}

function validarCampo(
    m: MatrizSnapshot,
    refs: ReferenciasSnapshot,
    tipoCodigo: string,
    campo: DocCampo,
    valor: unknown,
    valores: ValoresConfig,
    selfId?: number,
): string | null {
    const nome = campo.descricao;
    const vazio = valor === undefined || valor === null || valor === '';

    switch (campo.tipoValor) {
        case 'BOOLEAN':
            if (!vazio && typeof valor !== 'boolean') return `"${nome}" tem de ser Sim ou Não`;
            return null;

        case 'ENUM': {
            if (vazio) return `"${nome}" é obrigatório`;
            const elegiveis = dominio(m, tipoCodigo, campo.codigo);
            if (!elegiveis.some((d) => d.valor === valor)) {
                return `"${String(valor)}" não é um valor elegível de "${nome}" para este tipo de documento`;
            }
            return null;
        }

        case 'DOC_REF': {
            if (vazio) return `"${nome}" é obrigatório`;
            const alvo = refs.documentos.find((d) => d.id === Number(valor));
            if (!alvo) return `"${nome}": o documento indicado não existe`;
            if (selfId !== undefined && alvo.id === selfId) return `"${nome}": um documento não pode apontar para si próprio`;
            if (!alvo.ativo) return `"${nome}": o documento ${alvo.codigo} está inactivo`;
            if (campo.alvoRegra === 'TIPO_FIXO' && alvo.tipoCodigo !== campo.alvoTipoCodigo) {
                const tipo = m.tipos.find((t) => t.codigo === campo.alvoTipoCodigo)?.descricao ?? campo.alvoTipoCodigo;
                return `"${nome}": tem de ser um documento do tipo ${tipo} (${alvo.codigo} não é)`;
            }
            if (campo.alvoRegra === 'NATUREZA_INVERSA') {
                if (alvo.tipoCodigo !== tipoCodigo) {
                    return `"${nome}": tem de ser um documento do mesmo tipo (${alvo.codigo} não é)`;
                }
                // Só se aplica se o tipo tiver natureza (nível 1/3).
                const naturezas = dominio(m, tipoCodigo, 'natureza');
                if (naturezas.length) {
                    const inverso = naturezas.find((d) => d.valor === valores.natureza)?.inverso;
                    if (!inverso || alvo.natureza !== inverso) {
                        return `"${nome}": tem de ser um documento de natureza inversa (${alvo.codigo} não é)`;
                    }
                }
            }
            return null;
        }

        case 'SERIE_REF': {
            if (vazio) return `"${nome}" é obrigatório`;
            const serie = refs.series.find((s) => s.id === Number(valor));
            if (!serie) return `"${nome}": a série indicada não existe`;
            const docId = campo.campoRef ? Number(valores[campo.campoRef]) : NaN;
            if (campo.campoRef && serie.documentoConfigId !== docId) {
                return `"${nome}": a série não pertence ao documento indicado`;
            }
            return null;
        }

        case 'CC_TIPO_REF': {
            if (vazio) return `"${nome}" é obrigatório`;
            const cc = refs.ccTipos.find((t) => t.id === Number(valor));
            if (!cc) return `"${nome}": o tipo de conta corrente não existe`;
            const entidade = campo.campoRef ? valores[campo.campoRef] : undefined;
            if (entidade && cc.entidade !== entidade) {
                return `"${nome}": a conta corrente não se aplica à entidade ${String(entidade)}`;
            }
            return null;
        }

        case 'CC_ESTADO_REF': {
            if (vazio) return `"${nome}" é obrigatório`;
            const est = refs.ccEstados.find((e) => e.id === Number(valor));
            if (!est) return `"${nome}": o estado indicado não existe`;
            if (campo.campoRef && est.ccTipoId !== Number(valores[campo.campoRef])) {
                return `"${nome}": o estado não pertence à conta corrente indicada`;
            }
            return null;
        }

        case 'CONTAS_REF': {
            if (!Array.isArray(valor) || valor.length === 0) return `"${nome}": indique pelo menos uma conta`;
            for (const id of valor) {
                const conta = refs.contas.find((c) => c.id === Number(id));
                if (!conta) return `"${nome}": a conta ${String(id)} não existe`;
                if (!conta.ativo) return `"${nome}": a conta ${String(id)} está inactiva`;
            }
            return null;
        }
    }
    return null;
}

/** Campos cujo valor define comportamento — bloqueados após a 1.ª utilização (R2). */
export function camposComportamentais(m: MatrizSnapshot): string[] {
    return ['tipoCodigo', ...m.campos.map((c) => c.codigo)];
}

/** Compara dois valores de configuração (arrays de ids sem ordem). */
export function valoresIguais(a: unknown, b: unknown): boolean {
    if (Array.isArray(a) || Array.isArray(b)) {
        const sa = [...((a as unknown[]) ?? [])].map(Number).sort();
        const sb = [...((b as unknown[]) ?? [])].map(Number).sort();
        return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
    }
    return (a ?? null) === (b ?? null);
}
