import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../services/queryClient';
import api from '../services/api';

/* ══════════════════════════════════════════════════════════════
   INTERFACES
══════════════════════════════════════════════════════════════ */

// ── System Tables ──────────────────────────────────────────
export interface TipoTrabalho { id: string; codigo: string; descricao: string; }
export interface TipoDocumento { id: string; codigo: string; descricao: string; }
export interface TipoOT { id: string; codigo: string; descricao: string; }
export interface FuncaoTecnico { id: string; codigo: string; descricao: string; custo: number; }
export interface Moeda { id: string; codigo: string; descricao: string; simbolo: string; }
export interface Pais { id: string; nome: string; codigo: string; }
export interface Provincia { id: string; nome: string; paisId: string; }
export interface Municipio { id: string; nome: string; provinciaId: string; }
export interface TaxaIva { id: string; codigo: string; descricao: string; taxa: number; /** #178 */ motivoIsencao?: string | null; }
export interface ClasseArtigo { id: string; descricao: string; }
export interface FamiliaArtigo { id: string; descricao: string; }
export interface DocumentoCompra { id: string; codigo: string; descricao: string; }

// ── Entities ───────────────────────────────────────────────
export interface Cliente {
    id: string; tipo: 'empresa' | 'particular'; nome: string;
    nif: string; email: string; telefone: string; morada: string;
    municipio: string; provincia: string; ativo: boolean;
    provinciaId?: string; municipioId?: string;
    condicaoPagamentoId?: string; modoPagamentoId?: string;
}
export interface Tecnico {
    id: string; nome: string; telefone: string; email: string;
    funcaoId: string; custoHora: number; ativo: boolean;
    provinciaId?: string; municipioId?: string;
}
export interface CurrentUser { nome: string; email: string; role: string; tecnicoId?: string; tecnicoNome?: string; }
export interface SysLog { id: string; timestamp: string; usuario: string; modulo: string; acao: string; detalhes: string; tipo: 'info' | 'warning' | 'error'; }
export interface Fornecedor {
    id: string; nome: string; nif: string; telefone: string;
    email: string; morada: string; ativo: boolean;
    provinciaId?: string; municipioId?: string;
    condicaoPagamentoId?: string; modoPagamentoId?: string;
}

// ── Equipment (Parque) ─────────────────────────────────────
export interface ModeloEquipamento {
    id: string; nome: string; marca: string; tipo: 'maquina' | 'filtro';
}
export type EstadoEquip = 'ativo' | 'com_problema' | 'inativo';
export interface EquipInstalado {
    id: string; clienteId: string; modeloId: string; nrSerie: string;
    dataInstalacao: string; estado: EstadoEquip;
    dataUltimaManutencao?: string; dataProximaManutencao?: string;
    localizacao?: string;
}

// ── Maintenance Plans ──────────────────────────────────────
export interface PlanoMaoObra { funcaoId: string; custo: number; }
export interface PlanoArtigo { artigoId: string; quantidade: number; preco: number; }
export interface PlanoManutencao {
    id: string; equipInstaladoId: string; descricao: string;
    tipoTrabalhoId: string;
    periodicidade: string; previsaoTempo: number;
    maosDeObra: PlanoMaoObra[];
    artigos: PlanoArtigo[];
    ativo: boolean;
}

// ── Work Orders ────────────────────────────────────────────
export type OTEstado = 'Registada' | 'Programada' | 'Adiada' | 'Confirmada' | 'Em execução' | 'Finalizada';
export type OTTipo = 'pontual' | 'periodica';

export const OT_ESTADOS: OTEstado[] = ['Registada', 'Programada', 'Adiada', 'Confirmada', 'Em execução', 'Finalizada'];

/** Transições permitidas (espelho da máquina backend RF-OT-001 §3.1). Usado como fallback. */
export const OT_TRANSICOES: Record<OTEstado, OTEstado[]> = {
    'Registada': ['Programada'],
    'Programada': ['Confirmada', 'Adiada'],
    'Adiada': ['Programada'],
    'Confirmada': ['Em execução', 'Adiada'],
    'Em execução': ['Finalizada'],
    'Finalizada': [],
};

/** Buckets para listagens/contagens legadas. */
export const otAberta     = (e: OTEstado) => e === 'Registada' || e === 'Programada' || e === 'Adiada' || e === 'Confirmada';
export const otEmExecucao = (e: OTEstado) => e === 'Em execução';
export const otConcluida  = (e: OTEstado) => e === 'Finalizada';

export const OT_ESTADO_COR: Record<OTEstado, string> = {
    'Registada': '#6b7280',
    'Programada': '#2563eb',
    'Adiada': '#f97316',
    'Confirmada': '#7c3aed',
    'Em execução': '#eab308',
    'Finalizada': '#16a34a',
};
export interface OTMaoObra { funcao: string; custo: number; hora: string; }
export interface OTArtigo { artigoId: string; descricao: string; quantidade: number; preco: number; codigoIva?: string; taxaIva?: number; qtdPrevista?: number; qtdReservada?: number; qtdConsumida?: number; paraReposicao?: boolean; }
/** RF-OT-004 §4 — aviso de falta de stock devolvido ao confirmar. */
export interface AvisoStock { artigoId: number; descricao: string; previsto: number; reservado: number; emFalta: number; }
export interface OTReprogramacao { id: string; dataAnterior?: string; novaData?: string; motivo: string; criadoEm: string; usuario?: string; }
/** RF-OT-002 §3.1 + #75 — natureza da intervenção (classificação única da OT). */
export type NaturezaIntervencao = 'Manutenção' | 'Substituição de filtro' | 'Reparação de avaria' | 'Inspeção' | 'Montagem / Instalação';
export const NATUREZAS_INTERVENCAO: NaturezaIntervencao[] = ['Manutenção', 'Substituição de filtro', 'Reparação de avaria', 'Inspeção', 'Montagem / Instalação'];

/** RF-OT-002 §3.1 — prioridade. */
export type OTPrioridade = 'Normal' | 'Alta' | 'Urgente';
export const OT_PRIORIDADES: OTPrioridade[] = ['Normal', 'Alta', 'Urgente'];

export interface OrdemTrabalho {
    id: string; tipo: OTTipo; equipInstaladoId: string; clienteId: string;
    descricao: string; previsaoTempo: number; periodicidade?: string;
    planoId?: string;
    /** Derivado das FKs (executadoPor/registadoPor) — não é persistido (issue #76). */
    responsavel?: string;
    maosDeObra: OTMaoObra[];
    artigos: OTArtigo[];
    orgao?: string; sintoma?: string; causa?: string;
    dataInicio?: string;
    dataFim?: string;
    estado: OTEstado;
    assinadaCliente?: boolean;
    transicoesPossiveis?: OTEstado[];
    reprogramacoes: OTReprogramacao[];
    // RF-OT-002 §3.1
    numero?: string;
    naturezaIntervencao?: NaturezaIntervencao;
    prioridade?: OTPrioridade;
    dataRegisto?: string;
    registadoPorId?: string;
    registadoPorNome?: string;
    executadoPorId?: string;
    executadoPorNome?: string;
    /** #165 (v11 §4.4) — derivado no GET: Não faturada / Pendente / Parcialmente paga / Paga. */
    estadoFaturacao?: 'Não faturada' | 'Pendente' | 'Parcialmente paga' | 'Paga';
    documentoVendaNumero?: string;
    // RF-OT-003 §4 — ciclo confirmar/adiar + janela 6 meses
    dataAgendada?: string;
    dataExecucao?: string;
    adiamentos?: number;
    janelaFim?: string;
    requerAprovacaoAdiar?: boolean;
    aprovadoPorId?: string;
    aprovadoPorNome?: string;
    // RF-OT-005 §3.4 — custo previsto vs. real (peças + mão de obra)
    custoPrevisto?: number;
    custoReal?: number;
    // RF-OT-006 — assinatura e cadeia periódica
    assinaturaRef?: string;
    geradaDeOtId?: string;
    otSeguinteId?: string;
}

// ── Warehouse ──────────────────────────────────────────────
export interface Armazem {
    id: string; codigo: string; nome: string; descricao?: string; ativo: boolean;
}

// ── Stock Movements ────────────────────────────────────────
export type TipoMovimento = 'entrada' | 'saida' | 'ajuste' | 'transferencia' | 'devolucao';
export interface MovimentoStock {
    id: string; artigoId: string; tipo: TipoMovimento;
    quantidade: number; armazemId?: string; armazemDestinoId?: string;
    referencia?: string; usuario?: string; observacao?: string; data: string;
}

// ── Stock per Warehouse ────────────────────────────────────
export interface StockArmazem {
    id: string;
    artigoId: string;
    armazem: { id: string; codigo: string; nome: string };
    quantidade: number;
    stockMinimo: number;
}

// ── Stock ──────────────────────────────────────────────────
export interface Artigo {
    id: string; codigo: string; descricao: string;
    classe: string; familia: string; imagem?: string;
    precoUnitario: number; moeda: string;
    existencia: number; stockReservado: number; nivelMaximo: number; stockSeguranca: number;
    custoMedio: number; precoCusto: number; codigoArmazem: string;
    stockEncomendado: number; stockDisponivel?: number; emRuptura?: boolean;
    inativo: boolean; critico: boolean; observacao?: string;
    codigoIva?: string;
    stockInicial: number; unidadeMedida: string;
    refFornecedor?: string; dataUltimaEntrada?: string; dataUltimaSaida?: string;
}

// ── Purchase Orders ────────────────────────────────────────
export type EncomendaEstado = 'Aberta' | 'Aprovada' | 'Parcial' | 'Recebida' | 'Cancelada' | 'Faturada';
export interface EncomendaLinha {
    artigoId: string; codigo: string; descricao: string;
    qtdEncomendada: number; qtdRecebida: number;
    unidade: string; custoUnit: number; desconto: number;
    codigoIva?: string; taxaIva?: number;
}
export interface RececaoItem {
    id: string; artigoId: string; codigo: string; descricao: string; qtd: number; unidade: string;
}
export type RececaoEstado = 'Ativa' | 'Anulada';
export interface Rececao {
    id: string; encomendaId: string; dataHora: string;
    operador: string; armazem: string; guiaRemessa: string;
    estado: RececaoEstado; observacoes?: string;
    itens: RececaoItem[];
}
export interface Encomenda {
    id: string; numero: string; fornecedorId: string;
    data: string; dataEntrega: string; condicoesPagamento: string;
    responsavel: string; moeda: string; descricao: string; observacoes?: string;
    estado: EncomendaEstado; linhas: EncomendaLinha[];
    rececoes: Rececao[];
}

// ── Payment tables ─────────────────────────────────────────
export interface CondicaoPagamento { id: string; descricao: string; numDias: number; desconto: number; }
export interface ModoPagamento { id: string; movimento: string; descricao: string; }

// ── Supplier Invoices ──────────────────────────────────────
export interface LinhaFaturaFornecedor {
    id?: string; produtoId?: string; idLinhaEncomenda?: string;
    descricaoCustomizada?: string; quantidade: number; unidadeVenda: string;
    precoUnitarioNet: number; taxaIva: number; valorIva: number;
    codigoIsencao?: string; valorTotalLinha: number;
}
export type TipoNotaCredito = 'Devolucao' | 'AcertoPreco';
export type EstadoDocumentoVNC = 'NA' | 'Rascunho' | 'AguardaAprovacao' | 'Validado';
export interface VncFaturaAssociada {
    id?: string;
    faturaAssociadaId: string;
    faturaAssociada?: { id: string; numFaturaExterno: string; tipoDocumento: string; };
}
export interface FaturaFornecedor {
    id: string; fornecedorId: string; idEncomenda?: string;
    tipoDocumento: string; numFaturaExterno: string;
    dataEmissao: string; dataVencimento?: string; dataRegistoSistema?: string;
    totalLiquido: number; totalIva: number; totalRetencao: number; totalFinal: number;
    moeda: string; taxaCambio: number; estadoPagamento: string;
    condicaoPagamentoId?: string; modoPagamentoId?: string;
    observacoes?: string; descricao?: string;
    tipoNotaCredito?: TipoNotaCredito | null;
    estadoDocumento: EstadoDocumentoVNC;
    faturasAssociadas?: VncFaturaAssociada[];
    dataPagamento?: string | null;
    referenciaPagamento?: string | null;
    linhas: LinhaFaturaFornecedor[];
}

// ── Invoices ───────────────────────────────────────────────
export type FaturaEstado = 'Pendente' | 'Paga' | 'Anulada' | 'Emitido';
export interface FaturaLinha { descricao: string; quantidade: number; precoUnit: number; }
export interface Fatura {
    id: string; tipoDocumento: string; otId: string; clienteId: string; dataEmissao: string;
    linhas: FaturaLinha[];
    precoServico: number; taxaIva: number;
    valorSubtotal: number; valorIva: number; valorTotal: number;
    moeda: string; estado: FaturaEstado; observacoes?: string;
    dataPagamento?: string; motivoAnulacao?: string; comprovativo?: string; nrSerieEquip?: string;
}

// ── Empresa Config ─────────────────────────────────────────
export interface EmpresaConfig {
    id?: string; nome: string; nif: string; morada: string; telefone: string;
    email: string; website?: string; logoUrl?: string; iban: string; banco: string;
    moeda: string; taxaIva: number; latitude?: number; longitude?: number;
    rodapeDocumentos?: string; casasDecimais?: number; formatoData?: string;
    // #178 — identificação legal impressa nas faturas e recibos
    fax?: string; capitalSocial?: string; conservatoriaRegisto?: string; matricula?: string;
    // Segurança (issue #100)
    minPasswordLength?: number; sessionExpiryMinutes?: number;
    twoFactorEnabled?: boolean; accessLogEnabled?: boolean;
    // Comissões (issue #101)
    comissaoMontagem?: number; comissaoPreventiva?: number; comissaoCorretiva?: number;
    comissaoRemota?: number; comissaoVendaPercentagem?: number;
}

/* ══════════════════════════════════════════════════════════════
   DEFAULT EMPTY STATE (until loaded from backend API)
══════════════════════════════════════════════════════════════ */
const EMPRESA_CONFIG_DEFAULT: EmpresaConfig = {
    nome: '', nif: '', morada: '', telefone: '', email: '',
    iban: '', banco: '', moeda: 'AOA', taxaIva: 0,
};

/* ══════════════════════════════════════════════════════════════
   NORMALIZATION HELPERS
══════════════════════════════════════════════════════════════ */
const norm = (item: any) => ({ ...item, id: item.id?.toString() });
const normProvincia = (p: any): Provincia => ({ id: p.id?.toString(), nome: p.nome, paisId: p.pais?.id?.toString() ?? '' });
const normMunicipio = (m: any): Municipio => ({ id: m.id?.toString(), nome: m.nome, provinciaId: m.provincia?.id?.toString() ?? '' });
const normFuncaoTecnico = (f: any): FuncaoTecnico => ({ id: f.id?.toString(), codigo: f.codigo, descricao: f.descricao, custo: Number(f.custo) });
const normArtigo = (a: any): Artigo => ({ ...a, id: a.id?.toString(), classe: a.classe ?? '', familia: a.familia ?? '', precoUnitario: Number(a.precoUnitario), existencia: Number(a.existencia), stockReservado: Number(a.stockReservado ?? 0), nivelMaximo: Number(a.nivelMaximo), stockSeguranca: Number(a.stockSeguranca), custoMedio: Number(a.custoMedio), precoCusto: Number(a.precoCusto ?? 0), stockEncomendado: Number(a.stockEncomendado ?? 0), stockInicial: Number(a.stockInicial ?? 0), unidadeMedida: a.unidadeMedida ?? 'UN', refFornecedor: a.refFornecedor ?? undefined, dataUltimaEntrada: a.dataUltimaEntrada ?? undefined, dataUltimaSaida: a.dataUltimaSaida ?? undefined });
const normMovimento = (m: any): MovimentoStock => ({
    ...m,
    id: m.id?.toString(),
    artigoId: m.artigoId?.toString() ?? m.artigo?.id?.toString() ?? '',
    armazemId: m.armazemId ?? '',
    armazemDestinoId: m.armazemDestinoId ?? '',
    quantidade: Number(m.quantidade),
    data: m.data ? String(m.data).split('T')[0] : '',
});

const normCliente = (c: any): Cliente => {
    const principal = (c.enderecos ?? []).find((e: any) => e.principal) ?? c.enderecos?.[0];
    return {
        id: c.id?.toString(), tipo: c.tipo, nome: c.nome, nif: c.nif ?? '',
        email: c.email ?? '', telefone: c.telefone ?? '',
        morada: principal?.morada ?? '', municipio: principal?.cidade ?? '',
        provincia: '', ativo: c.ativo ?? true,
        provinciaId: principal?.provinciaId != null ? String(principal.provinciaId) : undefined,
        municipioId: principal?.municipioId != null ? String(principal.municipioId) : undefined,
    };
};

const normEquip = (e: any): EquipInstalado => ({
    id: e.id?.toString(), clienteId: e.cliente?.id?.toString() ?? e.clienteId?.toString() ?? '',
    modeloId: e.modelo?.id?.toString() ?? e.modeloId?.toString() ?? '',
    nrSerie: e.nrSerie, dataInstalacao: e.dataInstalacao, estado: e.estado,
    dataUltimaManutencao: e.dataUltimaManutencao, dataProximaManutencao: e.dataProximaManutencao,
    localizacao: e.localizacao,
});

const normPlano = (p: any): PlanoManutencao => ({
    id: p.id?.toString(),
    equipInstaladoId: p.equipInstalado?.id?.toString() ?? p.equipInstaladoId?.toString() ?? '',
    descricao: p.descricao, tipoTrabalhoId: p.tipoTrabalhoId?.toString() ?? '',
    periodicidade: p.periodicidade, previsaoTempo: Number(p.previsaoTempo), ativo: p.ativo ?? true,
    maosDeObra: (p.maosObra ?? []).map((m: any) => ({ funcaoId: m.funcaoId?.toString() ?? '', custo: Number(m.custo) })),
    artigos: (p.artigos ?? []).map((a: any) => ({ artigoId: a.artigoId?.toString() ?? '', quantidade: Number(a.quantidade), preco: Number(a.preco) })),
});

/** Mapeia estados legados (modelo de 4 estados) para a máquina de 6 estados. */
const normEstado = (e: any): OTEstado => {
    switch (e) {
        case 'Programado': return 'Programada';
        case 'Em curso':   return 'Em execução';
        case 'Terminado':
        case 'Encerrado':  return 'Finalizada';
        default:           return (OT_ESTADOS.includes(e) ? e : 'Registada') as OTEstado;
    }
};

const normOrdem = (o: any): OrdemTrabalho => ({
    id: o.id?.toString(), tipo: o.tipo, clienteId: o.cliente?.id?.toString() ?? o.clienteId?.toString() ?? '',
    equipInstaladoId: o.equipInstaladoId?.toString() ?? '', descricao: o.descricao,
    previsaoTempo: Number(o.previsaoTempo), periodicidade: o.periodicidade,
    planoId: o.planoId?.toString(),
    responsavel: o.executadoPor?.nome ?? o.registadoPor?.nome ?? '', maosDeObra: (o.maosObra ?? []).map((m: any) => ({ funcao: m.funcao, custo: Number(m.custo), hora: m.hora })),
    artigos: (o.artigos ?? []).map((a: any) => ({ artigoId: a.artigoId?.toString() ?? '', descricao: a.descricao, quantidade: Number(a.quantidade), preco: Number(a.preco), codigoIva: a.codigoIva ?? undefined, taxaIva: a.taxaIva != null ? Number(a.taxaIva) : undefined, qtdPrevista: a.qtdPrevista != null ? Number(a.qtdPrevista) : undefined, qtdReservada: a.qtdReservada != null ? Number(a.qtdReservada) : undefined, qtdConsumida: a.qtdConsumida != null ? Number(a.qtdConsumida) : undefined, paraReposicao: a.paraReposicao ?? undefined })),
    orgao: o.orgao, sintoma: o.sintoma, causa: o.causa,
    dataInicio: o.dataInicio, dataFim: o.dataFim,
    estado: normEstado(o.estado),
    assinadaCliente: !!o.assinadaCliente,
    transicoesPossiveis: o.transicoesPossiveis ?? OT_TRANSICOES[normEstado(o.estado)] ?? [],
    // RF-OT-002
    numero: o.numero,
    naturezaIntervencao: o.naturezaIntervencao,
    prioridade: o.prioridade,
    dataRegisto: o.dataRegisto,
    registadoPorId: o.registadoPorId?.toString() ?? o.registadoPor?.id?.toString(),
    registadoPorNome: o.registadoPor?.nome,
    executadoPorId: o.executadoPorId?.toString() ?? o.executadoPor?.id?.toString(),
    executadoPorNome: o.executadoPor?.nome,
    // #165 — estado de faturação (dimensão paralela, só leitura)
    estadoFaturacao: o.estadoFaturacao ?? undefined,
    documentoVendaNumero: o.documentoVendaNumero ?? undefined,
    // RF-OT-003
    dataAgendada: o.dataAgendada,
    dataExecucao: o.dataExecucao,
    adiamentos: typeof o.adiamentos === 'number' ? o.adiamentos : Number(o.adiamentos ?? 0),
    janelaFim: o.janelaFim,
    requerAprovacaoAdiar: !!o.requerAprovacaoAdiar,
    aprovadoPorId: o.aprovadoPorId?.toString() ?? o.aprovadoPor?.id?.toString(),
    aprovadoPorNome: o.aprovadoPor?.nome,
    // RF-OT-005
    custoPrevisto: o.custoPrevisto != null ? Number(o.custoPrevisto) : undefined,
    custoReal: o.custoReal != null ? Number(o.custoReal) : undefined,
    // RF-OT-006
    assinaturaRef: o.assinaturaRef ?? undefined,
    geradaDeOtId: o.geradaDeOtId?.toString() ?? o.geradaDe?.id?.toString(),
    otSeguinteId: o.otSeguinteId?.toString(),
    reprogramacoes: (o.reprogramacoes ?? []).map((r: any) => ({
        id: r.id?.toString(), dataAnterior: r.dataAnterior, novaData: r.novaData,
        motivo: r.motivo ?? '', criadoEm: r.criadoEm ?? '', usuario: r.usuario,
    })),
});

const normRececao = (r: any): Rececao => ({
    id: r.id?.toString(),
    encomendaId: r.encomenda?.id?.toString() ?? r.encomendaId?.toString() ?? '',
    dataHora: r.dataHora,
    operador: r.operador ?? '',
    armazem: r.armazem ?? '',
    guiaRemessa: r.guiaRemessa ?? '',
    estado: r.estado ?? 'Ativa',
    observacoes: r.observacoes,
    itens: (r.itens ?? []).map((i: any): RececaoItem => ({
        id: i.id?.toString(), artigoId: i.artigoId?.toString() ?? '',
        codigo: i.codigo, descricao: i.descricao,
        qtd: Number(i.qtd), unidade: i.unidade ?? 'UN',
    })),
});

const normStockArmazem = (s: any): StockArmazem => ({
    id: s.id?.toString(),
    artigoId: s.artigo?.id?.toString() ?? '',
    armazem: { id: s.armazem?.id?.toString() ?? '', codigo: s.armazem?.codigo ?? '', nome: s.armazem?.nome ?? '' },
    quantidade: Number(s.quantidade),
    stockMinimo: Number(s.stockMinimo),
});

const normEncomenda = (e: any): Encomenda => ({
    id: e.id?.toString(), numero: e.numero,
    fornecedorId: e.fornecedor?.id?.toString() ?? e.fornecedorId?.toString() ?? '',
    data: e.data, dataEntrega: e.dataEntrega, condicoesPagamento: e.condicoesPagamento ?? '',
    responsavel: e.responsavel ?? '', moeda: e.moeda ?? 'AOA', descricao: e.descricao ?? '',
    observacoes: e.observacoes, estado: e.estado,
    rececoes: (e.rececoes ?? []).map(normRececao),
    linhas: (e.linhas ?? []).map((l: any) => ({
        artigoId: l.artigoId?.toString() ?? '', codigo: l.codigo, descricao: l.descricao,
        qtdEncomendada: Number(l.qtdEncomendada), qtdRecebida: Number(l.qtdRecebida),
        unidade: l.unidade ?? 'UN', custoUnit: Number(l.custoUnit), desconto: Number(l.desconto),
    })),
});

const normFaturaFornecedor = (f: any): FaturaFornecedor => ({
    id: f.id?.toString(),
    fornecedorId: f.fornecedor?.id?.toString() ?? f.fornecedorId?.toString() ?? '',
    idEncomenda: f.idEncomenda?.toString() ?? undefined,
    tipoDocumento: f.tipoDocumento ?? '',
    numFaturaExterno: f.numFaturaExterno ?? '',
    dataEmissao: f.dataEmissao ?? '',
    dataVencimento: f.dataVencimento ?? undefined,
    dataRegistoSistema: f.dataRegistoSistema ?? undefined,
    totalLiquido: Number(f.totalLiquido ?? 0),
    totalIva: Number(f.totalIva ?? 0),
    totalRetencao: Number(f.totalRetencao ?? 0),
    totalFinal: Number(f.totalFinal ?? 0),
    moeda: f.moeda ?? 'AOA',
    taxaCambio: Number(f.taxaCambio ?? 1),
    estadoPagamento: f.estadoPagamento ?? 'Pendente',
    condicaoPagamentoId: f.condicaoPagamentoId != null ? String(f.condicaoPagamentoId) : undefined,
    modoPagamentoId: f.modoPagamentoId != null ? String(f.modoPagamentoId) : undefined,
    observacoes: f.observacoes ?? undefined,
    descricao: f.descricao ?? undefined,
    tipoNotaCredito: (f.tipoNotaCredito ?? null) as TipoNotaCredito | null,
    estadoDocumento: (f.estadoDocumento ?? 'NA') as EstadoDocumentoVNC,
    dataPagamento: f.dataPagamento ?? null,
    referenciaPagamento: f.referenciaPagamento ?? null,
    faturasAssociadas: (f.faturasAssociadas ?? []).map((a: any): VncFaturaAssociada => ({
        id: a.id?.toString(),
        faturaAssociadaId: a.faturaAssociadaId?.toString() ?? a.faturaAssociada?.id?.toString() ?? '',
        faturaAssociada: a.faturaAssociada ? {
            id: a.faturaAssociada.id?.toString(),
            numFaturaExterno: a.faturaAssociada.numFaturaExterno,
            tipoDocumento: a.faturaAssociada.tipoDocumento,
        } : undefined,
    })),
    linhas: (f.linhas ?? []).map((l: any): LinhaFaturaFornecedor => ({
        id: l.id?.toString(),
        produtoId: l.produtoId?.toString() ?? undefined,
        idLinhaEncomenda: l.idLinhaEncomenda?.toString() ?? undefined,
        descricaoCustomizada: l.descricaoCustomizada ?? undefined,
        quantidade: Number(l.quantidade),
        unidadeVenda: l.unidadeVenda ?? 'UN',
        precoUnitarioNet: Number(l.precoUnitarioNet),
        taxaIva: Number(l.taxaIva),
        valorIva: Number(l.valorIva),
        codigoIsencao: l.codigoIsencao ?? undefined,
        valorTotalLinha: Number(l.valorTotalLinha),
    })),
});

const normFatura = (f: any): Fatura => ({
    id: f.id?.toString(), tipoDocumento: f.tipoDocumento ?? 'FAT',
    otId: f.otId?.toString() ?? '', clienteId: f.cliente?.id?.toString() ?? f.clienteId?.toString() ?? '',
    dataEmissao: f.dataEmissao, precoServico: Number(f.precoServico),
    taxaIva: Number(f.taxaIva ?? 14), valorSubtotal: Number(f.valorSubtotal),
    valorIva: Number(f.valorIva), valorTotal: Number(f.valorTotal),
    moeda: f.moeda ?? 'AOA', estado: f.estado ?? 'Pendente',
    observacoes: f.observacoes, dataPagamento: f.dataPagamento,
    motivoAnulacao: f.motivoAnulacao, comprovativo: f.comprovativo, nrSerieEquip: f.nrSerieEquip,
    linhas: (f.linhas ?? []).map((l: any) => ({ descricao: l.descricao, quantidade: Number(l.quantidade), precoUnit: Number(l.precoUnit) })),
});

/* ══════════════════════════════════════════════════════════════
   CONTEXT DEFINITION
══════════════════════════════════════════════════════════════ */

interface GlobalContextType {
    // System tables
    tiposTrabalho: TipoTrabalho[]; addTipoTrabalho: (t: Omit<TipoTrabalho, 'id'>) => void; updateTipoTrabalho: (id: string, t: Partial<TipoTrabalho>) => void; removeTipoTrabalho: (id: string) => void;
    tiposOT: TipoOT[]; addTipoOT: (t: Omit<TipoOT, 'id'>) => void; updateTipoOT: (id: string, t: Partial<TipoOT>) => void; removeTipoOT: (id: string) => void;
    funcoesTecnico: FuncaoTecnico[]; addFuncaoTecnico: (f: Omit<FuncaoTecnico, 'id'>) => void; updateFuncaoTecnico: (id: string, f: Partial<FuncaoTecnico>) => void; removeFuncaoTecnico: (id: string) => void;
    moedas: Moeda[]; addMoeda: (m: Omit<Moeda, 'id'>) => void; updateMoeda: (id: string, m: Partial<Moeda>) => void; removeMoeda: (id: string) => void;
    tiposDocumento: TipoDocumento[]; addTipoDocumento: (t: Omit<TipoDocumento, 'id'>) => void; updateTipoDocumento: (id: string, t: Partial<TipoDocumento>) => void; removeTipoDocumento: (id: string) => void;
    paises: Pais[]; provincias: Provincia[]; municipios: Municipio[];
    taxasIva: TaxaIva[]; addTaxaIva: (t: Omit<TaxaIva, 'id'>) => void; updateTaxaIva: (id: string, t: Partial<TaxaIva>) => void; removeTaxaIva: (id: string) => void;
    classesArtigo: ClasseArtigo[]; addClasseArtigo: (c: Omit<ClasseArtigo, 'id'>) => void; updateClasseArtigo: (id: string, c: Partial<ClasseArtigo>) => void; removeClasseArtigo: (id: string) => void;
    familiasArtigo: FamiliaArtigo[]; addFamiliaArtigo: (f: Omit<FamiliaArtigo, 'id'>) => void; updateFamiliaArtigo: (id: string, f: Partial<FamiliaArtigo>) => void; removeFamiliaArtigo: (id: string) => void;
    documentosCompra: DocumentoCompra[]; addDocumentoCompra: (d: Omit<DocumentoCompra, 'id'>) => void; updateDocumentoCompra: (id: string, d: Partial<DocumentoCompra>) => void; removeDocumentoCompra: (id: string) => void;
    condicoesPagamento: CondicaoPagamento[]; addCondicaoPagamento: (c: Omit<CondicaoPagamento, 'id'>) => void; updateCondicaoPagamento: (id: string, c: Partial<CondicaoPagamento>) => void; removeCondicaoPagamento: (id: string) => void;
    modosPagamento: ModoPagamento[]; addModoPagamento: (m: Omit<ModoPagamento, 'id'>) => void; updateModoPagamento: (id: string, m: Partial<ModoPagamento>) => void; removeModoPagamento: (id: string) => void;
    // Finance config
    taxaIvaGlobal: number; setTaxaIvaGlobal: (v: number) => void;
    // Empresa config
    empresaConfig: EmpresaConfig; updateEmpresaConfig: (c: Partial<EmpresaConfig>) => Promise<void>;
    // Formatadores globais (derivados de empresaConfig + moedas)
    simboloMoeda: string;
    fmt: (n: number) => string;
    fmtMoney: (v: number, moedaCodigo?: string) => string;
    fmtDate: (iso?: string) => string;
    // Auth
    currentUser: CurrentUser | null; setCurrentUser: (u: CurrentUser | null) => void; logout: () => void;
    // Logs
    logs: SysLog[]; addLog: (l: Omit<SysLog, 'id' | 'timestamp'>) => void;
    // Entities
    clientes: Cliente[]; addCliente: (c: Omit<Cliente, 'id'>) => Cliente; updateCliente: (id: string, c: Partial<Cliente>) => void; removeCliente: (id: string) => Promise<void>;
    tecnicos: Tecnico[]; addTecnico: (t: Omit<Tecnico, 'id'> & { password?: string; passwordConfirm?: string }) => Promise<Tecnico>; updateTecnico: (id: string, t: Partial<Tecnico>) => Promise<void>; removeTecnico: (id: string) => Promise<void>;
    fornecedores: Fornecedor[]; addFornecedor: (f: Omit<Fornecedor, 'id'>) => Fornecedor; updateFornecedor: (id: string, f: Partial<Fornecedor>) => void; removeFornecedor: (id: string) => Promise<void>;
    // Equipment
    modelosEquipamento: ModeloEquipamento[]; addModelo: (m: Omit<ModeloEquipamento, 'id'>) => ModeloEquipamento; updateModelo: (id: string, m: Partial<ModeloEquipamento>) => void; removeModelo: (id: string) => Promise<void>;
    equipInstalados: EquipInstalado[]; addEquipInstalado: (e: Omit<EquipInstalado, 'id'>) => Promise<EquipInstalado>; updateEquipInstalado: (id: string, e: Partial<EquipInstalado>) => void; removeEquipInstalado: (id: string) => Promise<void>;
    // Plans
    planos: PlanoManutencao[]; addPlano: (p: Omit<PlanoManutencao, 'id'>) => PlanoManutencao; updatePlano: (id: string, p: Partial<PlanoManutencao>) => void; removePlano: (id: string) => void;
    // Work Orders
    ordens: OrdemTrabalho[]; addOrdem: (o: Omit<OrdemTrabalho, 'id'>) => Promise<OrdemTrabalho>; updateOrdem: (id: string, o: Partial<OrdemTrabalho>) => void; removeOrdem: (id: string) => void;
    agendarOT: (id: string, dataAgendada?: string) => Promise<void>;
    confirmarOT: (id: string, opts?: { dataExecucao: string; executadoPorId?: string }) => Promise<AvisoStock[]>;
    adiarOT: (id: string, opts?: { novaData: string; motivo: string; aprovadoPor?: string; aprovacaoMotivo?: string }) => Promise<void>;
    iniciarOT: (id: string, dataInicio?: string) => Promise<void>;
    registarConsumoOT: (id: string, linhas: { artigoId?: number; quantidade: number; descricao?: string }[]) => Promise<void>;
    finalizarOT: (id: string, opts?: { assinadaCliente: boolean; dataFim?: string; assinaturaRef?: string }) => Promise<{ otGeradaId?: string }>;
    reprogramarOT: (id: string, novaData: string, dataAnterior?: string, motivo?: string) => Promise<void>;
    // Warehouse
    armazens: Armazem[]; addArmazem: (a: Omit<Armazem, 'id'>) => Armazem; updateArmazem: (id: string, a: Partial<Armazem>) => void;
    // Stock
    artigos: Artigo[]; addArtigo: (a: Omit<Artigo, 'id'>) => Artigo; updateArtigo: (id: string, a: Partial<Artigo>) => void; adjustExistencia: (id: string, delta: number) => void; adjustReservado: (id: string, delta: number) => void;
    stockArmazem: StockArmazem[]; upsertStockArmazem: (artigoId: string, armazemId: string, quantidade: number, stockMinimo: number) => Promise<void>; removeStockArmazem: (saId: string) => Promise<void>;
    movimentosStock: MovimentoStock[]; addMovimento: (m: Omit<MovimentoStock, 'id'>) => MovimentoStock;
    // Purchases
    encomendas: Encomenda[]; addEncomenda: (e: Omit<Encomenda, 'id'>) => Encomenda; updateEncomenda: (id: string, e: Partial<Encomenda>) => void;
    criarRececao: (encId: string, recebidas: { artigoId: string; qtd: number }[], guiaRemessa: string, operador: string, armazem: string) => Promise<Encomenda>;
    anularRececao: (rececaoId: string) => Promise<Encomenda>;
    // Invoices
    faturas: Fatura[]; addFatura: (f: Omit<Fatura, 'id'>) => Fatura; updateFatura: (id: string, f: Partial<Fatura>) => void;
    // Supplier Invoices
    faturasFornecedor: FaturaFornecedor[]; addFaturaFornecedor: (f: Omit<FaturaFornecedor, 'id'> & { faturasAssociadasIds?: string[] }) => Promise<FaturaFornecedor>; updateFaturaFornecedor: (id: string, f: Partial<FaturaFornecedor>) => void; updateEstadoVNC: (id: string, estado: string, usuario?: string) => Promise<void>;
    // Reload
    loadingData: boolean;
    reloadData: () => Promise<void>;
    refreshClientes: () => Promise<void>;
}

const GlobalContext = createContext<GlobalContextType | null>(null);

export const useGlobal = () => {
    const ctx = useContext(GlobalContext);
    if (!ctx) throw new Error('useGlobal deve ser usado dentro do GlobalProvider');
    return ctx;
};

export const GlobalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUserState] = useState<CurrentUser | null>(null);
    const setCurrentUser = (u: CurrentUser | null) => setCurrentUserState(u);
    const logout = () => {
        localStorage.removeItem('sgi_token');
        setCurrentUserState(null);
    };

    // Restore session from JWT token on mount
    useEffect(() => {
        const token = localStorage.getItem('sgi_token');
        if (token && !currentUser) {
            api.post('/auth/me').then(({ data }) => {
                const ROLE_MAP: Record<string, string> = {
                    admin: 'Administrador', suporte: 'Suporte', coordenador: 'Coordenador',
                    campo: 'Técnico de Campo', vendedor: 'Vendedor',
                };
                const u = data.user;
                setCurrentUserState({
                    nome: u.nome,
                    email: u.email,
                    role: ROLE_MAP[u.role] || u.role,
                    tecnicoId: u.tecnicoId ? String(u.tecnicoId) : undefined,
                    tecnicoNome: u.tecnicoNome,
                });
            }).catch(() => {
                localStorage.removeItem('sgi_token');
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [logs, setLogs] = useState<SysLog[]>([]);

    /* ── Log helper — fire-and-forget ───────────────────────── */
    const currentUserRef = React.useRef<CurrentUser | null>(null);
    React.useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
    const log = (modulo: string, acao: string, detalhes = '', tipo: SysLog['tipo'] = 'info') => {
        const usuario = currentUserRef.current?.email ?? 'sistema';
        api.post(`/logs`, { usuario, modulo, acao, detalhes, tipo })
            .then(({ data }) => setLogs(p => [norm(data) as SysLog, ...p]))
            .catch(() => {});
    };

    const [taxaIvaGlobal, setTaxaIvaGlobal] = useState<number>(0);
    const [empresaConfig, setEmpresaConfig] = useState<EmpresaConfig>(EMPRESA_CONFIG_DEFAULT);
    const [tiposTrabalho, setTiposTrabalho] = useState<TipoTrabalho[]>([]);
    const [tiposDocumento, setTiposDocumento] = useState<TipoDocumento[]>([]);
    const [tiposOT, setTiposOT] = useState<TipoOT[]>([]);
    const [funcoesTecnico, setFuncoesTecnico] = useState<FuncaoTecnico[]>([]);
    const [moedas, setMoedas] = useState<Moeda[]>([]);
    const [paises, setPaises] = useState<Pais[]>([]);
    const [provincias, setProvincias] = useState<Provincia[]>([]);
    const [municipios, setMunicipios] = useState<Municipio[]>([]);
    // #43 — Estas 5 entidades passam a ser geridas pelo React Query (cache +
    // dedup entre páginas + invalidação nas mutações). Os `setX` são shims sobre
    // `setQueryData`, mantendo intactos os ~40 call-sites internos (value/updater)
    // e a fachada pública `useGlobal()`.
    const qc = useQueryClient();
    const authEnabled = !!currentUser;
    // Fábrica de setters estáveis (dep [qc]) que escrevem na cache do React Query;
    // aceitam value ou updater, tal como um setState.
    function useCacheSetter<T>(key: readonly unknown[]) {
        return React.useCallback((u: React.SetStateAction<T[]>) =>
            qc.setQueryData<T[]>(key, (old = []) =>
                typeof u === 'function' ? (u as (p: T[]) => T[])(old) : u), [key]);
    }

    const clientesQ = useQuery<Cliente[]>({ queryKey: queryKeys.clientes, enabled: authEnabled, queryFn: async () => (await api.get(`/clientes`)).data.map(normCliente) });
    const clientes = useMemo<Cliente[]>(() => clientesQ.data ?? [], [clientesQ.data]);
    const setClientes = useCacheSetter<Cliente>(queryKeys.clientes);

    const tecnicosQ = useQuery<Tecnico[]>({ queryKey: queryKeys.tecnicos, enabled: authEnabled, queryFn: async () => (await api.get(`/tecnicos`)).data.map(norm) });
    const tecnicos = useMemo<Tecnico[]>(() => tecnicosQ.data ?? [], [tecnicosQ.data]);
    const setTecnicos = useCacheSetter<Tecnico>(queryKeys.tecnicos);

    const fornecedoresQ = useQuery<Fornecedor[]>({ queryKey: queryKeys.fornecedores, enabled: authEnabled, queryFn: async () => (await api.get(`/fornecedores`)).data.map(norm) });
    const fornecedores = useMemo<Fornecedor[]>(() => fornecedoresQ.data ?? [], [fornecedoresQ.data]);
    const setFornecedores = useCacheSetter<Fornecedor>(queryKeys.fornecedores);

    const ordensQ = useQuery<OrdemTrabalho[]>({ queryKey: queryKeys.ordens, enabled: authEnabled, queryFn: async () => (await api.get(`/ordens`)).data.map(normOrdem) });
    const ordens = useMemo<OrdemTrabalho[]>(() => ordensQ.data ?? [], [ordensQ.data]);
    const setOrdens = useCacheSetter<OrdemTrabalho>(queryKeys.ordens);

    const artigosQ = useQuery<Artigo[]>({ queryKey: queryKeys.artigos, enabled: authEnabled, queryFn: async () => (await api.get(`/artigos`)).data.map(normArtigo) });
    const artigos = useMemo<Artigo[]>(() => artigosQ.data ?? [], [artigosQ.data]);
    const setArtigos = useCacheSetter<Artigo>(queryKeys.artigos);

    // #48 — true até o carregamento inicial de dados terminar (para skeletons).
    // Combina o lote legado com o carregamento inicial das queries do React Query.
    const [loadingBatch, setLoadingBatch] = useState(true);
    const loadingData = loadingBatch
        || (authEnabled && (clientesQ.isLoading || tecnicosQ.isLoading || fornecedoresQ.isLoading || ordensQ.isLoading || artigosQ.isLoading));
    const [modelosEquipamento, setModelosEquipamento] = useState<ModeloEquipamento[]>([]);
    const [equipInstalados, setEquipInstalados] = useState<EquipInstalado[]>([]);
    const [planos, setPlanos] = useState<PlanoManutencao[]>([]);
    const [armazens, setArmazens] = useState<Armazem[]>([]);
    const [taxasIva, setTaxasIva] = useState<TaxaIva[]>([]);
    const [classesArtigo, setClassesArtigo] = useState<ClasseArtigo[]>([]);
    const [familiasArtigo, setFamiliasArtigo] = useState<FamiliaArtigo[]>([]);
    const [documentosCompra, setDocumentosCompra] = useState<DocumentoCompra[]>([]);
    const [condicoesPagamento, setCondicoesPagamento] = useState<CondicaoPagamento[]>([]);
    const [modosPagamento, setModosPagamento] = useState<ModoPagamento[]>([]);
    const [faturasFornecedor, setFaturasFornecedor] = useState<FaturaFornecedor[]>([]);
    const [stockArmazem, setStockArmazem] = useState<StockArmazem[]>([]);
    const [movimentosStock, setMovimentosStock] = useState<MovimentoStock[]>([]);
    const [encomendas, setEncomendas] = useState<Encomenda[]>([]);
    const [faturas, setFaturas] = useState<Fatura[]>([]);

    /* ── Initial data load ──────────────────────────────────── */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const reloadData = React.useCallback(async () => {
            setLoadingBatch(true);
            // #43 — clientes/tecnicos/fornecedores/ordens/artigos são geridos pelo
            // React Query; invalidamos as suas queries e removemo-los deste lote
            // (placeholders para preservar os índices posicionais).
            qc.invalidateQueries({ queryKey: queryKeys.clientes });
            qc.invalidateQueries({ queryKey: queryKeys.tecnicos });
            qc.invalidateQueries({ queryKey: queryKeys.fornecedores });
            qc.invalidateQueries({ queryKey: queryKeys.ordens });
            qc.invalidateQueries({ queryKey: queryKeys.artigos });
            const ok = (r: PromiseSettledResult<any>) =>
                r.status === 'fulfilled' ? r.value.data : [];
            const skip = Promise.resolve({ data: [] as any[] });

            const results = await Promise.allSettled([
                api.get(`/tipos-trabalho`),       // 0
                api.get(`/tipos-documento`),      // 1
                api.get(`/tipos-ot`),             // 2
                api.get(`/funcoes-tecnico`),      // 3
                api.get(`/moedas`),               // 4
                api.get(`/paises`),               // 5
                api.get(`/provincias`),           // 6
                api.get(`/municipios`),           // 7
                skip,                             // 8  clientes → React Query
                skip,                             // 9  tecnicos → React Query
                skip,                             // 10 fornecedores → React Query
                api.get(`/modelos-equipamento`),  // 11
                api.get(`/equip-instalados`),     // 12
                api.get(`/planos`),               // 13
                skip,                             // 14 ordens → React Query
                api.get(`/armazens`),             // 15
                skip,                             // 16 artigos → React Query
                api.get(`/movimentos-stock`),      // 17
                api.get(`/compras`),            // 18
                api.get(`/faturas`),               // 19
                api.get(`/logs`),                  // 20
                api.get(`/configuracao`),          // 21
                api.get(`/artigos/stock-armazem`), // 22
                api.get(`/taxas-iva`),              // 23
                api.get(`/classes-artigo`),         // 24
                api.get(`/familias-artigo`),        // 25
                api.get(`/documentos-compra`),      // 26
                api.get(`/faturas-fornecedor`),     // 27
                api.get(`/condicoes-pagamento`),    // 28
                api.get(`/modos-pagamento`),        // 29
            ]);

            try { setTiposTrabalho(ok(results[0]).map(norm)); } catch {}
            try { setTiposDocumento(ok(results[1]).map(norm)); } catch {}
            try { setTiposOT(ok(results[2]).map(norm)); } catch {}
            try { setFuncoesTecnico(ok(results[3]).map(normFuncaoTecnico)); } catch {}
            try { setMoedas(ok(results[4]).map(norm)); } catch {}
            try { setPaises(ok(results[5]).map(norm)); } catch {}
            try { setProvincias(ok(results[6]).map(normProvincia)); } catch {}
            try { setMunicipios(ok(results[7]).map(normMunicipio)); } catch {}
            // #43 — clientes[8]/tecnicos[9]/fornecedores[10]/ordens[14]/artigos[16]
            // são geridos pelo React Query (ver useQuery acima); não são tratados aqui.
            try { setModelosEquipamento(ok(results[11]).map(norm)); } catch {}
            try { setEquipInstalados(ok(results[12]).map(normEquip)); } catch {}
            try { setPlanos(ok(results[13]).map(normPlano)); } catch {}
            try { setArmazens(ok(results[15]).map(norm)); } catch {}
            try { setMovimentosStock(ok(results[17]).map(normMovimento)); } catch {}
            try { setEncomendas(ok(results[18]).map(normEncomenda)); } catch {}
            try { setFaturas(ok(results[19]).map(normFatura)); } catch {}
            try { setLogs(ok(results[20]).map(norm)); } catch {}
            try { setStockArmazem(ok(results[22]).map(normStockArmazem)); } catch {}
            try { setTaxasIva(ok(results[23]).map((r: any) => ({ ...norm(r), taxa: Number(r.taxa) }))); } catch {}
            try { setClassesArtigo(ok(results[24]).map(norm)); } catch {}
            try { setFamiliasArtigo(ok(results[25]).map(norm)); } catch {}
            try { setDocumentosCompra(ok(results[26]).map(norm)); } catch {}
            try { setFaturasFornecedor(ok(results[27]).map(normFaturaFornecedor)); } catch {}
            try { setCondicoesPagamento(ok(results[28]).map((r: any) => ({ ...norm(r), numDias: Number(r.numDias), desconto: Number(r.desconto) }))); } catch {}
            try { setModosPagamento(ok(results[29]).map(norm)); } catch {}
            try {
                const cfgData = results[21].status === 'fulfilled' ? results[21].value.data : null;
                if (cfgData) {
                    const c = cfgData;
                    const ec: EmpresaConfig = {
                        id: c.id?.toString(), nome: c.nome, nif: c.nif ?? '', morada: c.morada ?? '',
                        telefone: c.telefone ?? '', email: c.email ?? '', website: c.website,
                        logoUrl: c.logoUrl, iban: c.iban ?? '', banco: c.banco ?? '',
                        moeda: c.moeda ?? 'AOA', taxaIva: Number(c.taxaIva ?? 0),
                        latitude: c.latitude ? Number(c.latitude) : undefined,
                        longitude: c.longitude ? Number(c.longitude) : undefined,
                        rodapeDocumentos: c.rodapeDocumentos,
                        fax: c.fax ?? '', capitalSocial: c.capitalSocial ?? '',
                        conservatoriaRegisto: c.conservatoriaRegisto ?? '', matricula: c.matricula ?? '',
                        casasDecimais: c.casasDecimais !== undefined ? Number(c.casasDecimais) : 2,
                        formatoData: c.formatoData ?? 'DD/MM/YYYY',
                        minPasswordLength: c.minPasswordLength !== undefined ? Number(c.minPasswordLength) : 8,
                        sessionExpiryMinutes: c.sessionExpiryMinutes !== undefined ? Number(c.sessionExpiryMinutes) : 60,
                        twoFactorEnabled: !!c.twoFactorEnabled,
                        accessLogEnabled: c.accessLogEnabled !== undefined ? !!c.accessLogEnabled : true,
                        comissaoMontagem: c.comissaoMontagem !== undefined ? Number(c.comissaoMontagem) : 80,
                        comissaoPreventiva: c.comissaoPreventiva !== undefined ? Number(c.comissaoPreventiva) : 40,
                        comissaoCorretiva: c.comissaoCorretiva !== undefined ? Number(c.comissaoCorretiva) : 50,
                        comissaoRemota: c.comissaoRemota !== undefined ? Number(c.comissaoRemota) : 25,
                        comissaoVendaPercentagem: c.comissaoVendaPercentagem !== undefined ? Number(c.comissaoVendaPercentagem) : 3,
                    };
                    setEmpresaConfig(ec);
                    setTaxaIvaGlobal(Number(c.taxaIva ?? 0));
                }
            } catch {}
            setLoadingBatch(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Only load data when authenticated (token exists)
    useEffect(() => {
        const token = localStorage.getItem('sgi_token');
        if (token) reloadData();
    }, [reloadData, currentUser]);

    /* ── Logs ───────────────────────────────────────────────── */
    const addLog = async (l: Omit<SysLog, 'id' | 'timestamp'>) => {
        try {
            const { data } = await api.post(`/logs`, l);
            const n = norm(data) as SysLog;
            setLogs(p => [n, ...p]);
        } catch (e) {
            // Interceptor handles toast display
        }
    };

    /* ── System tables ──────────────────────────────────────── */
    const addTipoTrabalho = async (t: Omit<TipoTrabalho, 'id'>) => {
        try {
            const { data } = await api.post(`/tipos-trabalho`, t);
            setTiposTrabalho(p => [...p, norm(data)]);
        } catch (e) { throw e; }
    };
    const updateTipoTrabalho = async (id: string, t: Partial<TipoTrabalho>) => {
        try {
            await api.put(`/tipos-trabalho/${id}`, t);
            setTiposTrabalho(p => p.map(x => x.id === id ? { ...x, ...t } : x));
        } catch (e) { throw e; }
    };
    const removeTipoTrabalho = async (id: string) => {
        try {
            await api.delete(`/tipos-trabalho/${id}`);
            setTiposTrabalho(p => p.filter(x => x.id !== id));
        } catch (e) { throw e; }
    };

    const addTipoOT = async (t: Omit<TipoOT, 'id'>) => {
        try {
            const { data } = await api.post(`/tipos-ot`, t);
            setTiposOT(p => [...p, norm(data)]);
        } catch (e) { throw e; }
    };
    const updateTipoOT = async (id: string, t: Partial<TipoOT>) => {
        try {
            await api.put(`/tipos-ot/${id}`, t);
            setTiposOT(p => p.map(x => x.id === id ? { ...x, ...t } : x));
        } catch (e) { throw e; }
    };
    const removeTipoOT = async (id: string) => {
        try {
            await api.delete(`/tipos-ot/${id}`);
            setTiposOT(p => p.filter(x => x.id !== id));
        } catch (e) { throw e; }
    };

    const addFuncaoTecnico = async (f: Omit<FuncaoTecnico, 'id'>) => {
        try {
            const { data } = await api.post(`/funcoes-tecnico`, f);
            setFuncoesTecnico(p => [...p, norm(data)]);
        } catch (e) { throw e; }
    };
    const updateFuncaoTecnico = async (id: string, f: Partial<FuncaoTecnico>) => {
        try {
            await api.put(`/funcoes-tecnico/${id}`, f);
            setFuncoesTecnico(p => p.map(x => x.id === id ? { ...x, ...f } : x));
        } catch (e) { throw e; }
    };
    const removeFuncaoTecnico = async (id: string) => {
        try {
            await api.delete(`/funcoes-tecnico/${id}`);
            setFuncoesTecnico(p => p.filter(x => x.id !== id));
        } catch (e) { throw e; }
    };

    const addMoeda = async (m: Omit<Moeda, 'id'>) => {
        try {
            const { data } = await api.post(`/moedas`, m);
            setMoedas(p => [...p, norm(data)]);
        } catch (e) { throw e; }
    };
    const updateMoeda = async (id: string, m: Partial<Moeda>) => {
        try {
            await api.put(`/moedas/${id}`, m);
            setMoedas(p => p.map(x => x.id === id ? { ...x, ...m } : x));
        } catch (e) { throw e; }
    };
    const removeMoeda = async (id: string) => {
        try {
            await api.delete(`/moedas/${id}`);
            setMoedas(p => p.filter(x => x.id !== id));
        } catch (e) { throw e; }
    };

    const addTipoDocumento = async (t: Omit<TipoDocumento, 'id'>) => {
        try {
            const { data } = await api.post(`/tipos-documento`, t);
            setTiposDocumento(p => [...p, norm(data)]);
        } catch (e) { throw e; }
    };
    const updateTipoDocumento = async (id: string, t: Partial<TipoDocumento>) => {
        try {
            await api.put(`/tipos-documento/${id}`, t);
            setTiposDocumento(p => p.map(x => x.id === id ? { ...x, ...t } : x));
        } catch (e) { throw e; }
    };
    const removeTipoDocumento = async (id: string) => {
        try {
            await api.delete(`/tipos-documento/${id}`);
            setTiposDocumento(p => p.filter(x => x.id !== id));
        } catch (e) { throw e; }
    };

    const addTaxaIva = async (t: Omit<TaxaIva, 'id'>) => {
        try {
            const { data } = await api.post(`/taxas-iva`, t);
            setTaxasIva(p => [...p, { ...norm(data), taxa: Number(data.taxa) }]);
        } catch (e) { throw e; }
    };
    const updateTaxaIva = async (id: string, t: Partial<TaxaIva>) => {
        try {
            await api.put(`/taxas-iva/${id}`, t);
            setTaxasIva(p => p.map(x => x.id === id ? { ...x, ...t } : x));
        } catch (e) { throw e; }
    };
    const removeTaxaIva = async (id: string) => {
        try {
            await api.delete(`/taxas-iva/${id}`);
            setTaxasIva(p => p.filter(x => x.id !== id));
        } catch (e) { throw e; }
    };

    const addClasseArtigo = async (c: Omit<ClasseArtigo, 'id'>) => {
        try {
            const { data } = await api.post(`/classes-artigo`, c);
            setClassesArtigo(p => [...p, norm(data) as ClasseArtigo]);
        } catch (e) { throw e; }
    };
    const updateClasseArtigo = async (id: string, c: Partial<ClasseArtigo>) => {
        try {
            await api.put(`/classes-artigo/${id}`, c);
            setClassesArtigo(p => p.map(x => x.id === id ? { ...x, ...c } : x));
        } catch (e) { throw e; }
    };
    const removeClasseArtigo = async (id: string) => {
        try {
            await api.delete(`/classes-artigo/${id}`);
            setClassesArtigo(p => p.filter(x => x.id !== id));
        } catch (e) { throw e; }
    };

    const addFamiliaArtigo = async (f: Omit<FamiliaArtigo, 'id'>) => {
        try {
            const { data } = await api.post(`/familias-artigo`, f);
            setFamiliasArtigo(p => [...p, norm(data) as FamiliaArtigo]);
        } catch (e) { throw e; }
    };
    const updateFamiliaArtigo = async (id: string, f: Partial<FamiliaArtigo>) => {
        try {
            await api.put(`/familias-artigo/${id}`, f);
            setFamiliasArtigo(p => p.map(x => x.id === id ? { ...x, ...f } : x));
        } catch (e) { throw e; }
    };
    const removeFamiliaArtigo = async (id: string) => {
        try {
            await api.delete(`/familias-artigo/${id}`);
            setFamiliasArtigo(p => p.filter(x => x.id !== id));
        } catch (e) { throw e; }
    };

    const addDocumentoCompra = async (d: Omit<DocumentoCompra, 'id'>) => {
        try {
            const { data } = await api.post(`/documentos-compra`, d);
            setDocumentosCompra(p => [...p, norm(data) as DocumentoCompra]);
        } catch (e) { throw e; }
    };
    const updateDocumentoCompra = async (id: string, d: Partial<DocumentoCompra>) => {
        try {
            await api.put(`/documentos-compra/${id}`, d);
            setDocumentosCompra(p => p.map(x => x.id === id ? { ...x, ...d } : x));
        } catch (e) { throw e; }
    };
    const removeDocumentoCompra = async (id: string) => {
        try {
            await api.delete(`/documentos-compra/${id}`);
            setDocumentosCompra(p => p.filter(x => x.id !== id));
        } catch (e) { throw e; }
    };

    const addCondicaoPagamento = async (c: Omit<CondicaoPagamento, 'id'>) => {
        try {
            const { data } = await api.post(`/condicoes-pagamento`, c);
            setCondicoesPagamento(p => [...p, { ...norm(data), numDias: Number(data.numDias), desconto: Number(data.desconto) } as CondicaoPagamento]);
        } catch (e) { throw e; }
    };
    const updateCondicaoPagamento = async (id: string, c: Partial<CondicaoPagamento>) => {
        try {
            await api.put(`/condicoes-pagamento/${id}`, c);
            setCondicoesPagamento(p => p.map(x => x.id === id ? { ...x, ...c } : x));
        } catch (e) { throw e; }
    };
    const removeCondicaoPagamento = async (id: string) => {
        try {
            await api.delete(`/condicoes-pagamento/${id}`);
            setCondicoesPagamento(p => p.filter(x => x.id !== id));
        } catch (e) { throw e; }
    };

    const addModoPagamento = async (m: Omit<ModoPagamento, 'id'>) => {
        try {
            const { data } = await api.post(`/modos-pagamento`, m);
            setModosPagamento(p => [...p, norm(data) as ModoPagamento]);
        } catch (e) { throw e; }
    };
    const updateModoPagamento = async (id: string, m: Partial<ModoPagamento>) => {
        try {
            await api.put(`/modos-pagamento/${id}`, m);
            setModosPagamento(p => p.map(x => x.id === id ? { ...x, ...m } : x));
        } catch (e) { throw e; }
    };
    const removeModoPagamento = async (id: string) => {
        try {
            await api.delete(`/modos-pagamento/${id}`);
            setModosPagamento(p => p.filter(x => x.id !== id));
        } catch (e) { throw e; }
    };

    const addFaturaFornecedor = async (f: Omit<FaturaFornecedor, 'id'> & { faturasAssociadasIds?: string[] }): Promise<FaturaFornecedor> => {
        const { faturasAssociadasIds, ...rest } = f as any;
        const { data } = await api.post(`/faturas-fornecedor`, {
            ...rest,
            fornecedorId: f.fornecedorId,
            linhas: f.linhas,
            faturasAssociadas: (faturasAssociadasIds ?? [])
                .map((id: string) => ({ faturaAssociadaId: Number(id) })),
            tipoNotaCredito: f.tipoNotaCredito ?? null,
            estadoDocumento: f.estadoDocumento ?? 'NA',
        });
        const n = normFaturaFornecedor(data);
        setFaturasFornecedor(p => [n, ...p]);
        log('Compras', 'Documento registado',
            `${n.tipoDocumento} Nº ${n.numFaturaExterno} | Total: ${n.totalFinal} ${n.moeda}` +
            (n.tipoDocumento === 'VNC'
                ? ` | Tipo NC: ${n.tipoNotaCredito ?? '—'} | Criado em Rascunho (sem impacto em stock)`
                : ` | Stock e custo médio actualizados`));
        // Reload artigos to reflect updated stock/custoMedio (VFA/VFR only; VNC defers to validation)
        if (f.tipoDocumento !== 'VNC') {
            try {
                const { data: arts } = await api.get(`/artigos`);
                setArtigos(arts.map(normArtigo));
            } catch {}
        }
        return n;
    };
    const updateFaturaFornecedor = async (id: string, f: Partial<FaturaFornecedor>) => {
        try {
            await api.put(`/faturas-fornecedor/${id}`, f);
            setFaturasFornecedor(p => p.map(x => x.id === id ? { ...x, ...f } : x));
            if (f.estadoPagamento === 'Paga') {
                log('Compras', 'Pagamento registado',
                    `Doc ID: ${id} | Referência: ${f.referenciaPagamento ?? '—'} | Data: ${f.dataPagamento ?? '—'}`, 'info');
            }
        } catch (e) { throw e; }
    };
    const updateEstadoVNC = async (id: string, estado: string, usuario?: string) => {
        const { data } = await api.patch(`/faturas-fornecedor/${id}/estado`, { estado, usuario });
        const n = normFaturaFornecedor(data);
        setFaturasFornecedor(p => p.map(x => x.id === id ? n : x));
        log('Compras', 'VNC — estado actualizado',
            `Nº ${n.numFaturaExterno} | Tipo NC: ${n.tipoNotaCredito ?? '—'} | ${n.estadoDocumento}` +
            (estado === 'Validado' && n.tipoNotaCredito === 'Devolucao' ? ' | Stock reduzido (devolução)' : ''),
            estado === 'Validado' ? 'warning' : 'info');
        // Reload stock when Validado (Devolução reduces existencia)
        if (estado === 'Validado') {
            try {
                const { data: arts } = await api.get(`/artigos`);
                setArtigos(arts.map(normArtigo));
            } catch {}
        }
    };

    const refreshClientes = React.useCallback(async () => {
        try {
            const { data } = await api.get(`/clientes`);
            setClientes(data.map(normCliente));
        } catch {}
    }, [setClientes]);

    /* ── Entities ───────────────────────────────────────────── */
    const addCliente = (c: Omit<Cliente, 'id'>): Cliente => {
        const placeholder: Cliente = { ...c, id: '' };
        api.post(`/clientes`, c)
            .then(({ data }) => {
                const n = normCliente(data);
                setClientes(p => [...p, n]);
                log('Clientes', 'Cliente criado', `Nome: ${c.nome}`);
            })
            .catch(() => {});
        return placeholder;
    };
    const updateCliente = async (id: string, c: Partial<Cliente>) => {
        try {
            await api.put(`/clientes/${id}`, c);
            setClientes(p => p.map(x => x.id === id ? { ...x, ...c } : x));
            log('Clientes', 'Cliente actualizado', `ID: ${id}`);
        } catch (e) { throw e; }
    };
    const removeCliente = async (id: string) => {
        const nome = clientes.find(x => x.id === id)?.nome ?? id;
        await api.delete(`/clientes/${id}`);
        setClientes(p => p.filter(x => x.id !== id));
        log('Clientes', 'Cliente eliminado', `Nome: ${nome}`, 'warning');
    };

    // Issue #68: await + propaga erro; sem toast otimista.
    const addTecnico = async (t: Omit<Tecnico, 'id'> & { password?: string; passwordConfirm?: string }): Promise<Tecnico> => {
        const { data } = await api.post(`/tecnicos`, t);
        const n = norm(data) as Tecnico;
        setTecnicos(p => [...p, n]);
        log('Técnicos', 'Técnico criado', `Nome: ${t.nome}`);
        return n;
    };
    const updateTecnico = async (id: string, t: Partial<Tecnico>) => {
        try {
            await api.put(`/tecnicos/${id}`, t);
            setTecnicos(p => p.map(x => x.id === id ? { ...x, ...t } : x));
            log('Técnicos', 'Técnico actualizado', `ID: ${id}`);
        } catch (e) { throw e; }
    };
    const removeTecnico = async (id: string) => {
        const nome = tecnicos.find(x => x.id === id)?.nome ?? id;
        await api.delete(`/tecnicos/${id}`);
        setTecnicos(p => p.filter(x => x.id !== id));
        log('Técnicos', 'Técnico eliminado', `Nome: ${nome}`, 'warning');
    };

    const addFornecedor = (f: Omit<Fornecedor, 'id'>): Fornecedor => {
        const placeholder: Fornecedor = { ...f, id: '' };
        api.post(`/fornecedores`, f)
            .then(({ data }) => {
                const n = norm(data) as Fornecedor;
                setFornecedores(p => [...p, n]);
                log('Fornecedores', 'Fornecedor criado', `Nome: ${f.nome}`);
            })
            .catch(() => {});
        return placeholder;
    };
    const updateFornecedor = async (id: string, f: Partial<Fornecedor>) => {
        try {
            await api.put(`/fornecedores/${id}`, f);
            setFornecedores(p => p.map(x => x.id === id ? { ...x, ...f } : x));
            log('Fornecedores', 'Fornecedor actualizado', `ID: ${id}`);
        } catch (e) { throw e; }
    };
    const removeFornecedor = async (id: string) => {
        const nome = fornecedores.find(x => x.id === id)?.nome ?? id;
        await api.delete(`/fornecedores/${id}`);
        setFornecedores(p => p.filter(x => x.id !== id));
        log('Fornecedores', 'Fornecedor eliminado', `Nome: ${nome}`, 'warning');
    };

    /* ── Equipment ──────────────────────────────────────────── */
    const addModelo = (m: Omit<ModeloEquipamento, 'id'>): ModeloEquipamento => {
        const placeholder: ModeloEquipamento = { ...m, id: '' };
        api.post(`/modelos-equipamento`, m)
            .then(({ data }) => {
                const n = norm(data) as ModeloEquipamento;
                setModelosEquipamento(p => [...p, n]);
            })
            .catch(() => {});
        return placeholder;
    };
    const updateModelo = async (id: string, m: Partial<ModeloEquipamento>) => {
        try {
            await api.put(`/modelos-equipamento/${id}`, m);
            setModelosEquipamento(p => p.map(x => x.id === id ? { ...x, ...m } : x));
        } catch (e) { throw e; }
    };
    const removeModelo = async (id: string) => {
        const nome = modelosEquipamento.find(x => x.id === id)?.nome ?? id;
        await api.delete(`/modelos-equipamento/${id}`);
        setModelosEquipamento(p => p.filter(x => x.id !== id));
        log('Parque', 'Modelo eliminado', `Nome: ${nome}`, 'warning');
    };

    const addEquipInstalado = async (e: Omit<EquipInstalado, 'id'>): Promise<EquipInstalado> => {
        // Propaga o erro (ex.: nº de série duplicado → 409) em vez de o engolir (#93),
        // devolvendo o equipamento já com o id real do backend.
        const { data } = await api.post(`/equip-instalados`, e);
        const n = normEquip(data);
        setEquipInstalados(p => [...p, n]);
        return n;
    };
    const updateEquipInstalado = async (id: string, e: Partial<EquipInstalado>) => {
        try {
            await api.put(`/equip-instalados/${id}`, e);
            setEquipInstalados(p => p.map(x => x.id === id ? { ...x, ...e } : x));
        } catch (e) { throw e; }
    };
    const removeEquipInstalado = async (id: string) => {
        const nrSerie = equipInstalados.find(x => x.id === id)?.nrSerie ?? id;
        await api.delete(`/equip-instalados/${id}`);
        setEquipInstalados(p => p.filter(x => x.id !== id));
        log('Parque', 'Equipamento eliminado', `Nº série: ${nrSerie}`, 'warning');
    };

    /* ── Plans ──────────────────────────────────────────────── */
    const addPlano = (p: Omit<PlanoManutencao, 'id'>): PlanoManutencao => {
        const placeholder: PlanoManutencao = { ...p, id: '' };
        api.post(`/planos`, p)
            .then(({ data }) => {
                const n = normPlano(data);
                setPlanos(prev => [...prev, n]);
            })
            .catch(() => {});
        return placeholder;
    };
    const updatePlano = async (id: string, p: Partial<PlanoManutencao>) => {
        try {
            await api.put(`/planos/${id}`, p);
            setPlanos(prev => prev.map(x => x.id === id ? { ...x, ...p } : x));
        } catch (e) { throw e; }
    };
    const removePlano = async (id: string) => {
        try {
            await api.delete(`/planos/${id}`);
            setPlanos(prev => prev.filter(x => x.id !== id));
        } catch (e) { throw e; }
    };

    /* ── Work Orders ────────────────────────────────────────── */
    const addOrdem = async (o: Omit<OrdemTrabalho, 'id'>): Promise<OrdemTrabalho> => {
        // Remove campos que o CreateOrdemTrabalhoDto não aceita (#158): o backend
        // usa forbidNonWhitelisted, por isso um `id` no payload (ex.: id:'' vindo
        // de chamadas com `as any`) rebentava com "property id should not exist".
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, reprogramacoes, maosDeObra, ...rest } = o as any;
        const payload = { ...rest, ...(maosDeObra !== undefined ? { maosObra: maosDeObra } : {}) };
        const { data } = await api.post(`/ordens`, payload);
        const n = normOrdem(data);
        setOrdens(p => [...p, n]);
        log('Ordens de Trabalho', 'OT criada', `Tipo: ${o.tipo} | ${o.descricao?.slice(0, 60)}`);
        return n;
    };
    const updateOrdem = async (id: string, o: Partial<OrdemTrabalho>) => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { reprogramacoes, maosDeObra, ...rest } = o as any;
            const payload = { ...rest, ...(maosDeObra !== undefined ? { maosObra: maosDeObra } : {}) };
            const { data: updated } = await api.put(`/ordens/${id}`, payload);
            setOrdens(p => p.map(x => x.id === id ? normOrdem(updated) : x));
            log('Ordens de Trabalho', 'OT actualizada', `ID: ${id}`);
        } catch (e) { throw e; }
    };
    const removeOrdem = async (id: string) => {
        try {
            await api.delete(`/ordens/${id}`);
            setOrdens(p => p.filter(x => x.id !== id));
        } catch (e) { throw e; }
    };

    // ── Máquina de estados RF-OT-001 ─────────────────────────────────
    const refreshStock = async () => {
        const [artigosRes, movRes] = await Promise.all([
            api.get(`/artigos`),
            api.get(`/movimentos-stock`),
        ]);
        setArtigos(artigosRes.data.map(normArtigo));
        setMovimentosStock(movRes.data.map(normMovimento));
    };

    // RF-OT-003 §3.4 — Registada/Adiada → Programada
    const agendarOT = async (id: string, dataAgendada?: string) => {
        const usuario = currentUserRef.current?.email ?? 'sistema';
        const { data } = await api.put(`/ordens/${id}/agendar`, { dataAgendada, usuario });
        setOrdens(p => p.map(x => x.id === id ? normOrdem(data) : x));
        log('Ordens de Trabalho', 'OT agendada', `ID: ${id} → Programada${dataAgendada ? ` (${dataAgendada})` : ''}`);
    };

    // RF-OT-003 §3.2 — Programada → Confirmada
    const confirmarOT = async (id: string, opts?: { dataExecucao: string; executadoPorId?: string }) => {
        const usuario = currentUserRef.current?.email ?? 'sistema';
        const body: any = { usuario };
        if (opts?.dataExecucao) body.dataExecucao = opts.dataExecucao;
        if (opts?.executadoPorId) body.executadoPorId = Number(opts.executadoPorId);
        const { data } = await api.put(`/ordens/${id}/confirmar`, body);
        setOrdens(p => p.map(x => x.id === id ? normOrdem(data) : x));
        const avisosStock: AvisoStock[] = data?.avisosStock ?? [];
        log('Ordens de Trabalho', 'OT confirmada', `ID: ${id}${opts?.dataExecucao ? ` (execução: ${opts.dataExecucao})` : ''}${avisosStock.length ? ` — ${avisosStock.length} peça(s) em reposição` : ''}`, avisosStock.length ? 'warning' : 'info');
        return avisosStock;
    };

    // RF-OT-003 §3.3 — Programada/Confirmada → Adiada
    const adiarOT = async (id: string, opts?: { novaData: string; motivo: string; aprovadoPor?: string; aprovacaoMotivo?: string }) => {
        const usuario = currentUserRef.current?.email ?? 'sistema';
        const body: any = { usuario };
        if (opts?.novaData) body.novaData = opts.novaData;
        if (opts?.motivo) body.motivo = opts.motivo;
        if (opts?.aprovadoPor) body.aprovadoPor = Number(opts.aprovadoPor);
        if (opts?.aprovacaoMotivo) body.aprovacaoMotivo = opts.aprovacaoMotivo;
        const { data } = await api.put(`/ordens/${id}/adiar`, body);
        setOrdens(p => p.map(x => x.id === id ? normOrdem(data) : x));
        log('Ordens de Trabalho', 'OT adiada', `ID: ${id} → ${opts?.novaData ?? ''}; Motivo: ${opts?.motivo ?? ''}`, 'warning');
    };

    const iniciarOT = async (id: string, dataInicio?: string) => {
        const usuario = currentUserRef.current?.email ?? 'sistema';
        const { data } = await api.put(`/ordens/${id}/iniciar`, { dataInicio, usuario });
        setOrdens(p => p.map(x => x.id === id ? normOrdem(data) : x));
        log('Ordens de Trabalho', 'OT iniciada', `ID: ${id} → Em execução`);
    };

    // RF-OT-005 §3.2 — regista o consumo real de peças (só em execução)
    const registarConsumoOT = async (id: string, linhas: { artigoId?: number; quantidade: number; descricao?: string }[]) => {
        const usuario = currentUserRef.current?.email ?? 'sistema';
        const { data } = await api.put(`/ordens/${id}/consumo`, { linhas, usuario });
        setOrdens(p => p.map(x => x.id === id ? normOrdem(data) : x));
        log('Ordens de Trabalho', 'Consumo registado', `ID: ${id} — ${linhas.length} linha(s)`);
    };

    // RF-OT-006 §3.1 — finalizar exige assinatura do cliente; periódica gera a seguinte.
    const finalizarOT = async (id: string, opts?: { assinadaCliente: boolean; dataFim?: string; assinaturaRef?: string }) => {
        const usuario = currentUserRef.current?.email ?? 'sistema';
        await api.put(`/ordens/${id}/finalizar`, {
            dataFim: opts?.dataFim,
            assinadaCliente: opts?.assinadaCliente ?? true,
            assinaturaRef: opts?.assinaturaRef,
            usuario,
        });
        const { data: all } = await api.get(`/ordens`);
        const ordensNorm = all.map(normOrdem);
        setOrdens(ordensNorm);
        log('Ordens de Trabalho', 'OT finalizada', `ID: ${id}`);
        // RF-OT-005 §3.3 — a baixa definitiva de stock ocorre no fecho.
        await refreshStock();
        // RF-OT-006 §3.2 — devolve a OT periódica gerada, se existir.
        const gerada = ordensNorm.find((o: OrdemTrabalho) => o.geradaDeOtId === id);
        return { otGeradaId: gerada?.id };
    };

    const updateEmpresaConfig = async (c: Partial<EmpresaConfig>) => {
        try {
            const { data } = await api.put(`/configuracao`, c);
            const ec: EmpresaConfig = {
                id: data.id?.toString(), nome: data.nome, nif: data.nif ?? '', morada: data.morada ?? '',
                telefone: data.telefone ?? '', email: data.email ?? '', website: data.website,
                logoUrl: data.logoUrl, iban: data.iban ?? '', banco: data.banco ?? '',
                moeda: data.moeda ?? 'AOA', taxaIva: Number(data.taxaIva ?? 0),
                latitude: data.latitude ? Number(data.latitude) : undefined,
                longitude: data.longitude ? Number(data.longitude) : undefined,
                rodapeDocumentos: data.rodapeDocumentos,
                fax: data.fax ?? '', capitalSocial: data.capitalSocial ?? '',
                conservatoriaRegisto: data.conservatoriaRegisto ?? '', matricula: data.matricula ?? '',
                casasDecimais: data.casasDecimais !== undefined ? Number(data.casasDecimais) : 2,
                formatoData: data.formatoData ?? 'DD/MM/YYYY',
                minPasswordLength: data.minPasswordLength !== undefined ? Number(data.minPasswordLength) : 8,
                sessionExpiryMinutes: data.sessionExpiryMinutes !== undefined ? Number(data.sessionExpiryMinutes) : 60,
                twoFactorEnabled: !!data.twoFactorEnabled,
                accessLogEnabled: data.accessLogEnabled !== undefined ? !!data.accessLogEnabled : true,
                comissaoMontagem: data.comissaoMontagem !== undefined ? Number(data.comissaoMontagem) : 80,
                comissaoPreventiva: data.comissaoPreventiva !== undefined ? Number(data.comissaoPreventiva) : 40,
                comissaoCorretiva: data.comissaoCorretiva !== undefined ? Number(data.comissaoCorretiva) : 50,
                comissaoRemota: data.comissaoRemota !== undefined ? Number(data.comissaoRemota) : 25,
                comissaoVendaPercentagem: data.comissaoVendaPercentagem !== undefined ? Number(data.comissaoVendaPercentagem) : 3,
            };
            setEmpresaConfig(ec);
            setTaxaIvaGlobal(Number(data.taxaIva ?? 0));
        } catch (e) { throw e; }
    };

    const reprogramarOT = async (id: string, novaData: string, dataAnterior?: string, motivo?: string) => {
        try {
            const usuario = currentUserRef.current?.email ?? 'sistema';
            const { data } = await api.post(`/ordens/${id}/reprogramar`, { novaData, dataAnterior, motivo, usuario });
            const updated = normOrdem(data);
            setOrdens(p => p.map(x => x.id === id ? updated : x));
            log('Ordens de Trabalho', 'OT reprogramada', `ID: ${id} → ${novaData}; Motivo: ${motivo ?? ''}`, 'warning');
        } catch (e) { throw e; }
    };


    /* ── Warehouse ──────────────────────────────────────────── */
    const addArmazem = (a: Omit<Armazem, 'id'>): Armazem => {
        const placeholder: Armazem = { ...a, id: '' };
        api.post(`/armazens`, a)
            .then(({ data }) => {
                const n = norm(data) as Armazem;
                setArmazens(p => [...p, n]);
            })
            .catch(() => {});
        return placeholder;
    };
    const updateArmazem = async (id: string, a: Partial<Armazem>) => {
        try {
            await api.put(`/armazens/${id}`, a);
            setArmazens(p => p.map(x => x.id === id ? { ...x, ...a } : x));
        } catch (e) { throw e; }
    };

    /* ── Stock ──────────────────────────────────────────────── */
    const addArtigo = (a: Omit<Artigo, 'id'>): Artigo => {
        const placeholder: Artigo = { ...a, id: '' };
        api.post(`/artigos`, a)
            .then(({ data }) => {
                const n = normArtigo(data);
                setArtigos(p => [...p, n]);
            })
            .catch(() => {});
        return placeholder;
    };
    const updateArtigo = async (id: string, a: Partial<Artigo>) => {
        try {
            await api.put(`/artigos/${id}`, a);
            setArtigos(p => p.map(x => x.id === id ? { ...x, ...a } : x));
        } catch (e) { throw e; }
    };
    const adjustExistencia = async (id: string, delta: number) => {
        try {
            await api.put(`/artigos/${id}/ajuste`, { delta });
            setArtigos(p => p.map(x => x.id === id ? { ...x, existencia: x.existencia + delta } : x));
        } catch (e) { throw e; }
    };

    const adjustReservado = async (id: string, delta: number) => {
        try {
            await api.put(`/artigos/${id}/reserva`, { delta });
            setArtigos(p => p.map(x => x.id === id ? { ...x, stockReservado: Math.max(0, x.stockReservado + delta) } : x));
        } catch (e) { /* interceptor handles toast */ }
    };

    const upsertStockArmazem = async (artigoId: string, armazemId: string, quantidade: number, stockMinimo: number) => {
        const { data } = await api.post(`/artigos/${artigoId}/stock-armazem`, { armazemId: Number(armazemId), quantidade, stockMinimo });
        const entry = normStockArmazem(data);
        setStockArmazem(p => {
            const idx = p.findIndex(x => x.id === entry.id);
            return idx >= 0 ? p.map((x, i) => i === idx ? entry : x) : [...p, entry];
        });
    };

    const removeStockArmazem = async (saId: string) => {
        await api.delete(`/artigos/stock-armazem/${saId}`);
        setStockArmazem(p => p.filter(x => x.id !== saId));
    };

    const addMovimento = (m: Omit<MovimentoStock, 'id'>): MovimentoStock => {
        const placeholder: MovimentoStock = { ...m, id: '' };
        const tipoLabel: Record<string, string> = {
            entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste',
            transferencia: 'Transferência', devolucao: 'Devolução',
        };
        api.post(`/movimentos-stock`, m)
            .then(({ data }) => {
                setMovimentosStock(p => [...p, normMovimento(data)]);
            })
            .catch(() => {});
        const artCodigo = artigos.find(a => a.id === m.artigoId)?.codigo ?? m.artigoId;
        const qtdStr = m.quantidade > 0 ? `+${m.quantidade}` : String(m.quantidade);
        const armazemStr = m.armazemDestinoId
            ? ` (${m.armazemId} → ${m.armazemDestinoId})`
            : m.armazemId ? ` [${m.armazemId}]` : '';
        const obs = m.observacao ? ` — ${m.observacao}` : '';
        log('Stock', `${tipoLabel[m.tipo] ?? m.tipo}: ${artCodigo}`,
            `Qtd: ${qtdStr}${armazemStr}${obs}`);
        return placeholder;
    };

    /* ── Purchases ──────────────────────────────────────────── */
    const addEncomenda = (e: Omit<Encomenda, 'id'>): Encomenda => {
        const placeholder: Encomenda = { ...e, id: '' };
        api.post(`/compras`, e)
            .then(({ data }) => {
                const n = normEncomenda(data);
                setEncomendas(p => [...p, n]);
                // Refresh artigos so stockEncomendado reflects new PO
                api.get(`/artigos`).then(r => setArtigos(r.data.map(normArtigo)));
            })
            .catch(() => {});
        return placeholder;
    };
    const updateEncomenda = async (id: string, e: Partial<Encomenda>) => {
        try {
            await api.put(`/compras/${id}`, e);
            setEncomendas(p => p.map(x => x.id === id ? { ...x, ...e } : x));
            // When cancelling, backend releases stockEncomendado — refresh artigos
            if (e.estado === 'Cancelada') {
                api.get(`/artigos`).then(r => setArtigos(r.data.map(normArtigo)));
            }
        } catch (e) { throw e; }
    };
    const criarRececao = async (
        encId: string,
        recebidas: { artigoId: string; qtd: number }[],
        guiaRemessa: string,
        operador: string,
        armazem: string,
    ): Promise<Encomenda> => {
        const { data } = await api.post(`/compras/${encId}/receber`, {
            recebidas, guiaRemessa, operador, armazem,
        });
        const enc = normEncomenda(data);
        setEncomendas(p => p.map(x => x.id === encId ? enc : x));
        const artRes = await api.get(`/artigos`);
        setArtigos(artRes.data.map(normArtigo));
        log('Encomendas', 'Receção registada', `Encomenda ${encId} · GR: ${guiaRemessa} · ${recebidas.length} linha(s)`);
        return enc;
    };

    const anularRececao = async (rececaoId: string): Promise<Encomenda> => {
        const { data } = await api.post(`/compras/rececoes/${rececaoId}/anular`);
        const enc = normEncomenda(data);
        setEncomendas(p => p.map(x => x.id === enc.id ? enc : x));
        const artRes = await api.get(`/artigos`);
        setArtigos(artRes.data.map(normArtigo));
        log('Encomendas', 'Receção anulada', `Receção ID: ${rececaoId}`);
        return enc;
    };

    /* ── Invoices ───────────────────────────────────────────── */
    const addFatura = (f: Omit<Fatura, 'id'>): Fatura => {
        const placeholder: Fatura = { ...f, id: '' };
        api.post(`/faturas`, f)
            .then(({ data }) => {
                const n = normFatura(data);
                setFaturas(p => [...p, n]);
                log('Faturação', 'Documento emitido', `Tipo: ${f.tipoDocumento} | Total: ${f.valorTotal} ${f.moeda}`);
            })
            .catch(() => {});
        return placeholder;
    };
    const updateFatura = async (id: string, f: Partial<Fatura>) => {
        try {
            await api.put(`/faturas/${id}`, f);
            setFaturas(p => p.map(x => x.id === id ? { ...x, ...f } : x));
        } catch (e) { throw e; }
    };

    /* ── Compute stockReservado dynamically from Programado OTs ── */
    const artigosComReserva = useMemo(() => {
        const reservaMap: Record<string, number> = {};
        ordens.filter(o => o.estado !== 'Em execução' && o.estado !== 'Finalizada').forEach(o => {
            (o.artigos ?? []).forEach(a => {
                if (a.artigoId && a.quantidade > 0) {
                    const k = String(a.artigoId);
                    reservaMap[k] = (reservaMap[k] ?? 0) + a.quantidade;
                }
            });
        });
        return artigos.map(a => {
            const stockReservado = reservaMap[a.id] ?? 0;
            const stockDisponivel = Math.max(0, a.existencia - stockReservado);
            const emRuptura = (stockDisponivel + a.stockEncomendado) < a.stockSeguranca;
            return { ...a, stockReservado, stockDisponivel, emRuptura };
        });
    }, [artigos, ordens]);

    /* ── Global formatters (derived from empresaConfig + moedas) ── */
    const casasDecimais = empresaConfig.casasDecimais ?? 2;
    const formatoData   = empresaConfig.formatoData   ?? 'DD/MM/YYYY';
    const moedaCodigo   = empresaConfig.moeda         ?? 'AOA';

    const simboloMoeda = useMemo(
        () => moedas.find(m => m.codigo === moedaCodigo)?.simbolo ?? moedaCodigo,
        [moedas, moedaCodigo],
    );

    const fmt = useMemo(
        () => (n: number) =>
            n.toLocaleString('pt-PT', { minimumFractionDigits: casasDecimais, maximumFractionDigits: casasDecimais }),
        [casasDecimais],
    );

    const fmtMoney = useMemo(
        () => (v: number, codigo?: string) => {
            const c = codigo ?? moedaCodigo;
            const simb = moedas.find(m => m.codigo === c)?.simbolo ?? c;
            return `${v.toLocaleString('pt-PT', { minimumFractionDigits: casasDecimais, maximumFractionDigits: casasDecimais })} ${simb}`;
        },
        [casasDecimais, moedas, moedaCodigo],
    );

    const fmtDate = useMemo(
        () => (iso?: string): string => {
            if (!iso) return '—';
            const d = new Date(iso);
            if (isNaN(d.getTime())) return '—';
            const dd   = String(d.getDate()).padStart(2, '0');
            const mm   = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = String(d.getFullYear());
            if (formatoData === 'YYYY-MM-DD') return `${yyyy}-${mm}-${dd}`;
            if (formatoData === 'MM/DD/YYYY') return `${mm}/${dd}/${yyyy}`;
            return `${dd}/${mm}/${yyyy}`;
        },
        [formatoData],
    );

    return (
        <GlobalContext.Provider value={{
            currentUser, setCurrentUser, logout,
            logs, addLog,
            tiposTrabalho, addTipoTrabalho, updateTipoTrabalho, removeTipoTrabalho,
            tiposOT, addTipoOT, updateTipoOT, removeTipoOT,
            funcoesTecnico, addFuncaoTecnico, updateFuncaoTecnico, removeFuncaoTecnico,
            taxaIvaGlobal, setTaxaIvaGlobal,
            empresaConfig, updateEmpresaConfig,
            simboloMoeda, fmt, fmtMoney, fmtDate,
            moedas, addMoeda, updateMoeda, removeMoeda,
            tiposDocumento, addTipoDocumento, updateTipoDocumento, removeTipoDocumento,
            paises, provincias, municipios,
            taxasIva, addTaxaIva, updateTaxaIva, removeTaxaIva,
            classesArtigo, addClasseArtigo, updateClasseArtigo, removeClasseArtigo,
            familiasArtigo, addFamiliaArtigo, updateFamiliaArtigo, removeFamiliaArtigo,
            documentosCompra, addDocumentoCompra, updateDocumentoCompra, removeDocumentoCompra,
            condicoesPagamento, addCondicaoPagamento, updateCondicaoPagamento, removeCondicaoPagamento,
            modosPagamento, addModoPagamento, updateModoPagamento, removeModoPagamento,
            clientes, addCliente, updateCliente, removeCliente, refreshClientes,
            tecnicos, addTecnico, updateTecnico, removeTecnico,
            fornecedores, addFornecedor, updateFornecedor, removeFornecedor,
            modelosEquipamento, addModelo, updateModelo, removeModelo,
            equipInstalados, addEquipInstalado, updateEquipInstalado, removeEquipInstalado,
            planos, addPlano, updatePlano, removePlano,
            ordens, addOrdem, updateOrdem, removeOrdem, agendarOT, confirmarOT, adiarOT, iniciarOT, registarConsumoOT, finalizarOT, reprogramarOT,
            armazens, addArmazem, updateArmazem,
            artigos: artigosComReserva, addArtigo, updateArtigo, adjustExistencia, adjustReservado,
            stockArmazem, upsertStockArmazem, removeStockArmazem,
            movimentosStock, addMovimento,
            encomendas, addEncomenda, updateEncomenda, criarRececao, anularRececao,
            faturas, addFatura, updateFatura,
            faturasFornecedor, addFaturaFornecedor, updateFaturaFornecedor, updateEstadoVNC,
            loadingData,
            reloadData,
        }}>
            {children}
        </GlobalContext.Provider>
    );
};

function calcNextDate(fromDate: string, periodicidade: string): string {
    const d = new Date(fromDate);
    switch (periodicidade) {
        case 'Mensal':     d.setMonth(d.getMonth() + 1);       break;
        case 'Trimestral': d.setMonth(d.getMonth() + 3);       break;
        case 'Semestral':  d.setMonth(d.getMonth() + 6);       break;
        case 'Anual':      d.setFullYear(d.getFullYear() + 1); break;
        default:           d.setMonth(d.getMonth() + 1);
    }
    return d.toISOString().split('T')[0];
}

// Suppress unused warning — kept for potential use
void calcNextDate;
