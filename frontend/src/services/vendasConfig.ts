import api from './api';

/**
 * #164 — Cliente da configuração do Módulo de Vendas de Intervenções.
 * O ecrã de configuração deriva TUDO o que mostra da matriz (`GET /config/matriz`):
 * que campos aparecem (nível 1), que sub-campos (nível 2) e que valores (nível 3).
 */

export type TipoValor = 'BOOLEAN' | 'ENUM' | 'DOC_REF' | 'SERIE_REF' | 'CC_TIPO_REF' | 'CC_ESTADO_REF' | 'CONTAS_REF';

export interface DocTipo { codigo: string; descricao: string; modulo: string; ordem: number }
export interface DocCampo {
    codigo: string; descricao: string; tipoValor: TipoValor;
    alvoRegra: 'TIPO_FIXO' | 'NATUREZA_INVERSA' | null; alvoTipoCodigo: string | null;
    campoRef: string | null; ordem: number;
}
export interface Matriz {
    tipos: DocTipo[];
    campos: DocCampo[];
    nivel1: { tipoCodigo: string; campoCodigo: string }[];
    condicoes: { campoCodigo: string; campoPai: string; valorPai: string }[];
    dominios: { tipoCodigo: string; campoCodigo: string; valor: string; descricao: string; inverso: string | null; ordem: number }[];
}

export interface Serie {
    id: number; documentoConfigId: number; codigo: string; ano: number;
    limiteInferior: number; limiteSuperior: number;
    ultimoNumero: number | null; ultimaDataHora: string | null;
    porDefeito: boolean; sugereDataSistema: boolean; ativo: boolean;
    dataInicial: string; dataFinal: string; emUso: boolean;
}

export interface DocumentoConfig {
    id: number; codigo: string; descricao: string; tipoCodigo: string; ativo: boolean;
    natureza: string | null; entidadePermitida: string | null; tipoFiscal: string | null;
    geraMovCc: boolean; operaSobreCc: boolean; ccTipoId: number | null; ccEstadoId: number | null;
    ligacaoTesouraria: boolean; ligacaoTesourariaDocId: number | null;
    liquidacaoAutomatica: boolean; liquidacaoAutoDocId: number | null;
    estorno: boolean; estornoDocId: number | null; estornoSerieId: number | null;
    acertoSobraDocId: number | null; acertoQuebraDocId: number | null;
    contasBancariaIds: number[];
    series: Serie[];
    emUso: boolean;
}

export interface CcEstado { id?: number; codigo: string; descricao: string }
export interface CcTipo { id: number; codigo: string; descricao: string; entidade: 'CLIENTE' | 'FORNECEDOR'; estados: CcEstado[] }

export interface ContaBancaria {
    id: number; codigo: string; descricao: string; tipo: 'CAIXA' | 'DO'; moeda: string;
    banco: string | null; numero: string | null; iban: string | null; agencia: string | null;
    titular: string | null; gestor: string | null; contactos: string | null;
    aberta: boolean; ativo: boolean;
}

export interface MotivoEstorno { id: number; codigo: string; descricao: string; ativo: boolean }

export type ValoresConfig = Record<string, unknown>;

/**
 * Campos disponíveis para um tipo, dados os valores actuais — mesmo algoritmo
 * genérico do backend (`matriz.rules.ts`): nível 1 + sub-campos do nível 2 até estabilizar.
 */
export function camposDisponiveis(m: Matriz, tipoCodigo: string, valores: ValoresConfig): Set<string> {
    const disp = new Set(m.nivel1.filter(n => n.tipoCodigo === tipoCodigo).map(n => n.campoCodigo));
    let mudou = true;
    while (mudou) {
        mudou = false;
        for (const c of m.condicoes) {
            if (disp.has(c.campoCodigo) || !disp.has(c.campoPai)) continue;
            if (String(valores[c.campoPai] ?? '') === c.valorPai) { disp.add(c.campoCodigo); mudou = true; }
        }
    }
    return disp;
}

/** Um campo é sub-campo (nível 2) se tiver condição de activação. */
export function eSubCampo(m: Matriz, campoCodigo: string): boolean {
    return m.condicoes.some(c => c.campoCodigo === campoCodigo);
}

export function dominio(m: Matriz, tipoCodigo: string, campoCodigo: string) {
    return m.dominios.filter(d => d.tipoCodigo === tipoCodigo && d.campoCodigo === campoCodigo);
}

export function valorPorOmissao(campo: DocCampo): unknown {
    if (campo.tipoValor === 'BOOLEAN') return false;
    if (campo.tipoValor === 'CONTAS_REF') return [];
    return null;
}

/** Repõe o valor de omissão nos campos que deixaram de estar disponíveis. */
export function limparIndisponiveis(m: Matriz, tipoCodigo: string, valores: ValoresConfig): ValoresConfig {
    const disp = camposDisponiveis(m, tipoCodigo, valores);
    const out = { ...valores };
    for (const c of m.campos) if (!disp.has(c.codigo)) out[c.codigo] = valorPorOmissao(c);
    return out;
}

export const vendasConfigApi = {
    matriz: () => api.get<Matriz>('/config/matriz').then(r => r.data),

    documentos: () => api.get<DocumentoConfig[]>('/config/documentos').then(r => r.data),
    criarDocumento: (dto: ValoresConfig) => api.post<DocumentoConfig>('/config/documentos', dto).then(r => r.data),
    atualizarDocumento: (id: number, dto: ValoresConfig) => api.put<DocumentoConfig>(`/config/documentos/${id}`, dto).then(r => r.data),
    eliminarDocumento: (id: number) => api.delete(`/config/documentos/${id}`),

    criarSerie: (dto: Partial<Serie>) => api.post<Serie>('/config/series', dto).then(r => r.data),
    atualizarSerie: (id: number, dto: Partial<Serie>) => api.put<Serie>(`/config/series/${id}`, dto).then(r => r.data),
    eliminarSerie: (id: number) => api.delete(`/config/series/${id}`),

    ccTipos: () => api.get<CcTipo[]>('/config/cc-tipos').then(r => r.data),
    criarCcTipo: (dto: Omit<CcTipo, 'id'>) => api.post<CcTipo>('/config/cc-tipos', dto).then(r => r.data),
    atualizarCcTipo: (id: number, dto: Partial<CcTipo>) => api.put<CcTipo>(`/config/cc-tipos/${id}`, dto).then(r => r.data),
    eliminarCcTipo: (id: number) => api.delete(`/config/cc-tipos/${id}`),

    contas: () => api.get<ContaBancaria[]>('/config/contas-bancarias').then(r => r.data),
    criarConta: (dto: Partial<ContaBancaria>) => api.post<ContaBancaria>('/config/contas-bancarias', dto).then(r => r.data),
    atualizarConta: (id: number, dto: Partial<ContaBancaria>) => api.put<ContaBancaria>(`/config/contas-bancarias/${id}`, dto).then(r => r.data),
    eliminarConta: (id: number) => api.delete(`/config/contas-bancarias/${id}`),

    motivos: () => api.get<MotivoEstorno[]>('/config/motivos-estorno').then(r => r.data),
    criarMotivo: (dto: Partial<MotivoEstorno>) => api.post<MotivoEstorno>('/config/motivos-estorno', dto).then(r => r.data),
    atualizarMotivo: (id: number, dto: Partial<MotivoEstorno>) => api.put<MotivoEstorno>(`/config/motivos-estorno/${id}`, dto).then(r => r.data),
    eliminarMotivo: (id: number) => api.delete(`/config/motivos-estorno/${id}`),
};
