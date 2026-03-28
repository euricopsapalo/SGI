import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

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
export interface TaxaIva { id: string; codigo: string; descricao: string; taxa: number; }
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
export type OTEstado = 'Programado' | 'Em curso' | 'Terminado' | 'Encerrado';
export type OTTipo = 'programada' | 'pontual';
export interface OTMaoObra { funcao: string; custo: number; hora: string; }
export interface OTArtigo { artigoId: string; descricao: string; quantidade: number; preco: number; codigoIva?: string; taxaIva?: number; }
export interface OTReprogramacao { id: string; dataAnterior?: string; novaData?: string; motivo: string; criadoEm: string; usuario?: string; }
export interface OrdemTrabalho {
    id: string; tipo: OTTipo; equipInstaladoId: string; clienteId: string;
    descricao: string; previsaoTempo: number; periodicidade?: string;
    planoId?: string; tipoTrabalho: string; tipoOT?: string; responsavel: string;
    maosDeObra: OTMaoObra[];
    artigos: OTArtigo[];
    orgao?: string; sintoma?: string; causa?: string;
    dataProgInicio?: string; dataProgFim?: string;
    dataEmissao?: string; dataInicio?: string;
    dataFim?: string; dataEncerramento?: string;
    estado: OTEstado;
    reprogramacoes: OTReprogramacao[];
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
export type EncomendaEstado = 'Aberta' | 'Parcial' | 'Recebida' | 'Cancelada' | 'Faturada';
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
export interface FaturaFornecedor {
    id: string; fornecedorId: string; idEncomenda?: string;
    tipoDocumento: string; numFaturaExterno: string;
    dataEmissao: string; dataVencimento?: string; dataRegistoSistema?: string;
    totalLiquido: number; totalIva: number; totalRetencao: number; totalFinal: number;
    moeda: string; taxaCambio: number; estadoPagamento: string;
    condicaoPagamentoId?: string; modoPagamentoId?: string;
    observacoes?: string; descricao?: string;
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
}

/* ══════════════════════════════════════════════════════════════
   COMPANY INFO (fallback — replaced by empresaConfig from API)
══════════════════════════════════════════════════════════════ */
/** @deprecated Use empresaConfig from useGlobal() — all company data comes from the backend */
const EMPRESA_INFO_EMPTY: EmpresaConfig = {
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
const normArtigo = (a: any): Artigo => ({ ...a, id: a.id?.toString(), precoUnitario: Number(a.precoUnitario), existencia: Number(a.existencia), stockReservado: Number(a.stockReservado ?? 0), nivelMaximo: Number(a.nivelMaximo), stockSeguranca: Number(a.stockSeguranca), custoMedio: Number(a.custoMedio), precoCusto: Number(a.precoCusto ?? 0), stockEncomendado: Number(a.stockEncomendado ?? 0), stockInicial: Number(a.stockInicial ?? 0), unidadeMedida: a.unidadeMedida ?? 'UN', refFornecedor: a.refFornecedor ?? undefined, dataUltimaEntrada: a.dataUltimaEntrada ?? undefined, dataUltimaSaida: a.dataUltimaSaida ?? undefined });
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

const normOrdem = (o: any): OrdemTrabalho => ({
    id: o.id?.toString(), tipo: o.tipo, clienteId: o.cliente?.id?.toString() ?? o.clienteId?.toString() ?? '',
    equipInstaladoId: o.equipInstaladoId?.toString() ?? '', descricao: o.descricao,
    previsaoTempo: Number(o.previsaoTempo), periodicidade: o.periodicidade,
    planoId: o.planoId?.toString(), tipoTrabalho: o.tipoTrabalho ?? '', tipoOT: o.tipoOT ?? '',
    responsavel: o.responsavel ?? '', maosDeObra: (o.maosObra ?? []).map((m: any) => ({ funcao: m.funcao, custo: Number(m.custo), hora: m.hora })),
    artigos: (o.artigos ?? []).map((a: any) => ({ artigoId: a.artigoId?.toString() ?? '', descricao: a.descricao, quantidade: Number(a.quantidade), preco: Number(a.preco), codigoIva: a.codigoIva ?? undefined, taxaIva: a.taxaIva != null ? Number(a.taxaIva) : undefined })),
    orgao: o.orgao, sintoma: o.sintoma, causa: o.causa,
    dataProgInicio: o.dataProgInicio, dataProgFim: o.dataProgFim,
    dataEmissao: o.dataEmissao, dataInicio: o.dataInicio, dataFim: o.dataFim, dataEncerramento: o.dataEncerramento,
    estado: o.estado,
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
    tecnicos: Tecnico[]; addTecnico: (t: Omit<Tecnico, 'id'>) => Tecnico; updateTecnico: (id: string, t: Partial<Tecnico>) => void; removeTecnico: (id: string) => Promise<void>;
    fornecedores: Fornecedor[]; addFornecedor: (f: Omit<Fornecedor, 'id'>) => Fornecedor; updateFornecedor: (id: string, f: Partial<Fornecedor>) => void; removeFornecedor: (id: string) => Promise<void>;
    // Equipment
    modelosEquipamento: ModeloEquipamento[]; addModelo: (m: Omit<ModeloEquipamento, 'id'>) => ModeloEquipamento; updateModelo: (id: string, m: Partial<ModeloEquipamento>) => void;
    equipInstalados: EquipInstalado[]; addEquipInstalado: (e: Omit<EquipInstalado, 'id'>) => EquipInstalado; updateEquipInstalado: (id: string, e: Partial<EquipInstalado>) => void;
    // Plans
    planos: PlanoManutencao[]; addPlano: (p: Omit<PlanoManutencao, 'id'>) => PlanoManutencao; updatePlano: (id: string, p: Partial<PlanoManutencao>) => void; removePlano: (id: string) => void;
    // Work Orders
    ordens: OrdemTrabalho[]; addOrdem: (o: Omit<OrdemTrabalho, 'id'>) => OrdemTrabalho; updateOrdem: (id: string, o: Partial<OrdemTrabalho>) => void; removeOrdem: (id: string) => void;
    emitirOT: (id: string, dataEmissao?: string, dataInicio?: string) => void;
    terminarOT: (id: string, dataFim?: string) => void;
    encerrarOT: (id: string, dataEncerramento?: string) => void;
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
    faturasFornecedor: FaturaFornecedor[]; addFaturaFornecedor: (f: Omit<FaturaFornecedor, 'id'>) => Promise<FaturaFornecedor>; updateFaturaFornecedor: (id: string, f: Partial<FaturaFornecedor>) => void;
    // Reload
    reloadData: () => Promise<void>;
}

const GlobalContext = createContext<GlobalContextType | null>(null);

export const useGlobal = () => {
    const ctx = useContext(GlobalContext);
    if (!ctx) throw new Error('useGlobal must be used inside GlobalProvider');
    return ctx;
};

export const GlobalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUserState] = useState<CurrentUser | null>({ nome: 'Eurico Sapalo', email: 'admin@aquatex.ao', role: 'Administrador' });
    const setCurrentUser = (u: CurrentUser | null) => setCurrentUserState(u);
    const logout = () => setCurrentUserState(null);

    const [logs, setLogs] = useState<SysLog[]>([]);

    /* ── Log helper — fire-and-forget ───────────────────────── */
    const currentUserRef = React.useRef<CurrentUser | null>(null);
    React.useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
    const log = (modulo: string, acao: string, detalhes = '', tipo: SysLog['tipo'] = 'info') => {
        const usuario = currentUserRef.current?.email ?? 'sistema';
        axios.post(`${API}/api/logs`, { timestamp: new Date().toISOString(), usuario, modulo, acao, detalhes, tipo })
            .then(({ data }) => setLogs(p => [norm(data) as SysLog, ...p]))
            .catch(() => {});
    };

    const [taxaIvaGlobal, setTaxaIvaGlobal] = useState<number>(0);
    const [empresaConfig, setEmpresaConfig] = useState<EmpresaConfig>(EMPRESA_INFO_EMPTY);
    const [tiposTrabalho, setTiposTrabalho] = useState<TipoTrabalho[]>([]);
    const [tiposDocumento, setTiposDocumento] = useState<TipoDocumento[]>([]);
    const [tiposOT, setTiposOT] = useState<TipoOT[]>([]);
    const [funcoesTecnico, setFuncoesTecnico] = useState<FuncaoTecnico[]>([]);
    const [moedas, setMoedas] = useState<Moeda[]>([]);
    const [paises, setPaises] = useState<Pais[]>([]);
    const [provincias, setProvincias] = useState<Provincia[]>([]);
    const [municipios, setMunicipios] = useState<Municipio[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
    const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
    const [modelosEquipamento, setModelosEquipamento] = useState<ModeloEquipamento[]>([]);
    const [equipInstalados, setEquipInstalados] = useState<EquipInstalado[]>([]);
    const [planos, setPlanos] = useState<PlanoManutencao[]>([]);
    const [ordens, setOrdens] = useState<OrdemTrabalho[]>([]);
    const [armazens, setArmazens] = useState<Armazem[]>([]);
    const [artigos, setArtigos] = useState<Artigo[]>([]);
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

    const today = () => new Date().toISOString().split('T')[0];

    /* ── Initial data load ──────────────────────────────────── */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const reloadData = React.useCallback(async () => {
            const ok = (r: PromiseSettledResult<any>) =>
                r.status === 'fulfilled' ? r.value.data : [];

            const results = await Promise.allSettled([
                axios.get(`${API}/api/tipos-trabalho`),       // 0
                axios.get(`${API}/api/tipos-documento`),      // 1
                axios.get(`${API}/api/tipos-ot`),             // 2
                axios.get(`${API}/api/funcoes-tecnico`),      // 3
                axios.get(`${API}/api/moedas`),               // 4
                axios.get(`${API}/api/paises`),               // 5
                axios.get(`${API}/api/provincias`),           // 6
                axios.get(`${API}/api/municipios`),           // 7
                axios.get(`${API}/api/clientes`),             // 8
                axios.get(`${API}/api/tecnicos`),             // 9
                axios.get(`${API}/api/fornecedores`),         // 10
                axios.get(`${API}/api/modelos-equipamento`),  // 11
                axios.get(`${API}/api/equip-instalados`),     // 12
                axios.get(`${API}/api/planos`),               // 13
                axios.get(`${API}/api/ordens`),               // 14
                axios.get(`${API}/api/armazens`),             // 15
                axios.get(`${API}/api/artigos`),              // 16
                axios.get(`${API}/api/movimentos-stock`),      // 17
                axios.get(`${API}/api/encomendas`),            // 18
                axios.get(`${API}/api/faturas`),               // 19
                axios.get(`${API}/api/logs`),                  // 20
                axios.get(`${API}/api/configuracao`),          // 21
                axios.get(`${API}/api/artigos/stock-armazem`), // 22
                axios.get(`${API}/api/taxas-iva`),              // 23
                axios.get(`${API}/api/classes-artigo`),         // 24
                axios.get(`${API}/api/familias-artigo`),        // 25
                axios.get(`${API}/api/documentos-compra`),      // 26
                axios.get(`${API}/api/faturas-fornecedor`),     // 27
                axios.get(`${API}/api/condicoes-pagamento`),    // 28
                axios.get(`${API}/api/modos-pagamento`),        // 29
            ]);

            try { setTiposTrabalho(ok(results[0]).map(norm)); } catch {}
            try { setTiposDocumento(ok(results[1]).map(norm)); } catch {}
            try { setTiposOT(ok(results[2]).map(norm)); } catch {}
            try { setFuncoesTecnico(ok(results[3]).map(normFuncaoTecnico)); } catch {}
            try { setMoedas(ok(results[4]).map(norm)); } catch {}
            try { setPaises(ok(results[5]).map(norm)); } catch {}
            try { setProvincias(ok(results[6]).map(normProvincia)); } catch {}
            try { setMunicipios(ok(results[7]).map(normMunicipio)); } catch {}
            try { setClientes(ok(results[8]).map(normCliente)); } catch {}
            try { setTecnicos(ok(results[9]).map(norm)); } catch {}
            try { setFornecedores(ok(results[10]).map(norm)); } catch {}
            try { setModelosEquipamento(ok(results[11]).map(norm)); } catch {}
            try { setEquipInstalados(ok(results[12]).map(normEquip)); } catch {}
            try { setPlanos(ok(results[13]).map(normPlano)); } catch {}
            try { setOrdens(ok(results[14]).map(normOrdem)); } catch {}
            try { setArmazens(ok(results[15]).map(norm)); } catch {}
            try { setArtigos(ok(results[16]).map(normArtigo)); } catch {}
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
            try { setCondicoesPagamento(ok(results[28]).map(r => ({ ...norm(r), numDias: Number(r.numDias), desconto: Number(r.desconto) }))); } catch {}
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
                        casasDecimais: c.casasDecimais !== undefined ? Number(c.casasDecimais) : 2,
                        formatoData: c.formatoData ?? 'DD/MM/YYYY',
                    };
                    setEmpresaConfig(ec);
                    setTaxaIvaGlobal(Number(c.taxaIva ?? 0));
                }
            } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => { reloadData(); }, [reloadData]);

    /* ── Logs ───────────────────────────────────────────────── */
    const addLog = async (l: Omit<SysLog, 'id' | 'timestamp'>) => {
        try {
            const { data } = await axios.post(`${API}/api/logs`, { ...l, timestamp: new Date().toISOString() });
            const n = norm(data) as SysLog;
            setLogs(p => [n, ...p]);
        } catch (e) {
            console.error('addLog error', e);
        }
    };

    /* ── System tables ──────────────────────────────────────── */
    const addTipoTrabalho = async (t: Omit<TipoTrabalho, 'id'>) => {
        try {
            const { data } = await axios.post(`${API}/api/tipos-trabalho`, t);
            setTiposTrabalho(p => [...p, norm(data)]);
        } catch (e) { console.error('addTipoTrabalho error', e); throw e; }
    };
    const updateTipoTrabalho = async (id: string, t: Partial<TipoTrabalho>) => {
        try {
            await axios.put(`${API}/api/tipos-trabalho/${id}`, t);
            setTiposTrabalho(p => p.map(x => x.id === id ? { ...x, ...t } : x));
        } catch (e) { console.error('updateTipoTrabalho error', e); throw e; }
    };
    const removeTipoTrabalho = async (id: string) => {
        try {
            await axios.delete(`${API}/api/tipos-trabalho/${id}`);
            setTiposTrabalho(p => p.filter(x => x.id !== id));
        } catch (e) { console.error('removeTipoTrabalho error', e); throw e; }
    };

    const addTipoOT = async (t: Omit<TipoOT, 'id'>) => {
        try {
            const { data } = await axios.post(`${API}/api/tipos-ot`, t);
            setTiposOT(p => [...p, norm(data)]);
        } catch (e) { console.error('addTipoOT error', e); throw e; }
    };
    const updateTipoOT = async (id: string, t: Partial<TipoOT>) => {
        try {
            await axios.put(`${API}/api/tipos-ot/${id}`, t);
            setTiposOT(p => p.map(x => x.id === id ? { ...x, ...t } : x));
        } catch (e) { console.error('updateTipoOT error', e); throw e; }
    };
    const removeTipoOT = async (id: string) => {
        try {
            await axios.delete(`${API}/api/tipos-ot/${id}`);
            setTiposOT(p => p.filter(x => x.id !== id));
        } catch (e) { console.error('removeTipoOT error', e); throw e; }
    };

    const addFuncaoTecnico = async (f: Omit<FuncaoTecnico, 'id'>) => {
        try {
            const { data } = await axios.post(`${API}/api/funcoes-tecnico`, f);
            setFuncoesTecnico(p => [...p, norm(data)]);
        } catch (e) { console.error('addFuncaoTecnico error', e); throw e; }
    };
    const updateFuncaoTecnico = async (id: string, f: Partial<FuncaoTecnico>) => {
        try {
            await axios.put(`${API}/api/funcoes-tecnico/${id}`, f);
            setFuncoesTecnico(p => p.map(x => x.id === id ? { ...x, ...f } : x));
        } catch (e) { console.error('updateFuncaoTecnico error', e); throw e; }
    };
    const removeFuncaoTecnico = async (id: string) => {
        try {
            await axios.delete(`${API}/api/funcoes-tecnico/${id}`);
            setFuncoesTecnico(p => p.filter(x => x.id !== id));
        } catch (e) { console.error('removeFuncaoTecnico error', e); throw e; }
    };

    const addMoeda = async (m: Omit<Moeda, 'id'>) => {
        try {
            const { data } = await axios.post(`${API}/api/moedas`, m);
            setMoedas(p => [...p, norm(data)]);
        } catch (e) { console.error('addMoeda error', e); throw e; }
    };
    const updateMoeda = async (id: string, m: Partial<Moeda>) => {
        try {
            await axios.put(`${API}/api/moedas/${id}`, m);
            setMoedas(p => p.map(x => x.id === id ? { ...x, ...m } : x));
        } catch (e) { console.error('updateMoeda error', e); throw e; }
    };
    const removeMoeda = async (id: string) => {
        try {
            await axios.delete(`${API}/api/moedas/${id}`);
            setMoedas(p => p.filter(x => x.id !== id));
        } catch (e) { console.error('removeMoeda error', e); throw e; }
    };

    const addTipoDocumento = async (t: Omit<TipoDocumento, 'id'>) => {
        try {
            const { data } = await axios.post(`${API}/api/tipos-documento`, t);
            setTiposDocumento(p => [...p, norm(data)]);
        } catch (e) { console.error('addTipoDocumento error', e); throw e; }
    };
    const updateTipoDocumento = async (id: string, t: Partial<TipoDocumento>) => {
        try {
            await axios.put(`${API}/api/tipos-documento/${id}`, t);
            setTiposDocumento(p => p.map(x => x.id === id ? { ...x, ...t } : x));
        } catch (e) { console.error('updateTipoDocumento error', e); throw e; }
    };
    const removeTipoDocumento = async (id: string) => {
        try {
            await axios.delete(`${API}/api/tipos-documento/${id}`);
            setTiposDocumento(p => p.filter(x => x.id !== id));
        } catch (e) { console.error('removeTipoDocumento error', e); throw e; }
    };

    const addTaxaIva = async (t: Omit<TaxaIva, 'id'>) => {
        try {
            const { data } = await axios.post(`${API}/api/taxas-iva`, t);
            setTaxasIva(p => [...p, { ...norm(data), taxa: Number(data.taxa) }]);
        } catch (e) { console.error('addTaxaIva error', e); throw e; }
    };
    const updateTaxaIva = async (id: string, t: Partial<TaxaIva>) => {
        try {
            await axios.put(`${API}/api/taxas-iva/${id}`, t);
            setTaxasIva(p => p.map(x => x.id === id ? { ...x, ...t } : x));
        } catch (e) { console.error('updateTaxaIva error', e); throw e; }
    };
    const removeTaxaIva = async (id: string) => {
        try {
            await axios.delete(`${API}/api/taxas-iva/${id}`);
            setTaxasIva(p => p.filter(x => x.id !== id));
        } catch (e) { console.error('removeTaxaIva error', e); throw e; }
    };

    const addClasseArtigo = async (c: Omit<ClasseArtigo, 'id'>) => {
        try {
            const { data } = await axios.post(`${API}/api/classes-artigo`, c);
            setClassesArtigo(p => [...p, norm(data) as ClasseArtigo]);
        } catch (e) { console.error('addClasseArtigo error', e); throw e; }
    };
    const updateClasseArtigo = async (id: string, c: Partial<ClasseArtigo>) => {
        try {
            await axios.put(`${API}/api/classes-artigo/${id}`, c);
            setClassesArtigo(p => p.map(x => x.id === id ? { ...x, ...c } : x));
        } catch (e) { console.error('updateClasseArtigo error', e); throw e; }
    };
    const removeClasseArtigo = async (id: string) => {
        try {
            await axios.delete(`${API}/api/classes-artigo/${id}`);
            setClassesArtigo(p => p.filter(x => x.id !== id));
        } catch (e) { console.error('removeClasseArtigo error', e); throw e; }
    };

    const addFamiliaArtigo = async (f: Omit<FamiliaArtigo, 'id'>) => {
        try {
            const { data } = await axios.post(`${API}/api/familias-artigo`, f);
            setFamiliasArtigo(p => [...p, norm(data) as FamiliaArtigo]);
        } catch (e) { console.error('addFamiliaArtigo error', e); throw e; }
    };
    const updateFamiliaArtigo = async (id: string, f: Partial<FamiliaArtigo>) => {
        try {
            await axios.put(`${API}/api/familias-artigo/${id}`, f);
            setFamiliasArtigo(p => p.map(x => x.id === id ? { ...x, ...f } : x));
        } catch (e) { console.error('updateFamiliaArtigo error', e); throw e; }
    };
    const removeFamiliaArtigo = async (id: string) => {
        try {
            await axios.delete(`${API}/api/familias-artigo/${id}`);
            setFamiliasArtigo(p => p.filter(x => x.id !== id));
        } catch (e) { console.error('removeFamiliaArtigo error', e); throw e; }
    };

    const addDocumentoCompra = async (d: Omit<DocumentoCompra, 'id'>) => {
        try {
            const { data } = await axios.post(`${API}/api/documentos-compra`, d);
            setDocumentosCompra(p => [...p, norm(data) as DocumentoCompra]);
        } catch (e) { console.error('addDocumentoCompra error', e); throw e; }
    };
    const updateDocumentoCompra = async (id: string, d: Partial<DocumentoCompra>) => {
        try {
            await axios.put(`${API}/api/documentos-compra/${id}`, d);
            setDocumentosCompra(p => p.map(x => x.id === id ? { ...x, ...d } : x));
        } catch (e) { console.error('updateDocumentoCompra error', e); throw e; }
    };
    const removeDocumentoCompra = async (id: string) => {
        try {
            await axios.delete(`${API}/api/documentos-compra/${id}`);
            setDocumentosCompra(p => p.filter(x => x.id !== id));
        } catch (e) { console.error('removeDocumentoCompra error', e); throw e; }
    };

    const addCondicaoPagamento = async (c: Omit<CondicaoPagamento, 'id'>) => {
        try {
            const { data } = await axios.post(`${API}/api/condicoes-pagamento`, c);
            setCondicoesPagamento(p => [...p, { ...norm(data), numDias: Number(data.numDias), desconto: Number(data.desconto) } as CondicaoPagamento]);
        } catch (e) { console.error('addCondicaoPagamento error', e); throw e; }
    };
    const updateCondicaoPagamento = async (id: string, c: Partial<CondicaoPagamento>) => {
        try {
            await axios.put(`${API}/api/condicoes-pagamento/${id}`, c);
            setCondicoesPagamento(p => p.map(x => x.id === id ? { ...x, ...c } : x));
        } catch (e) { console.error('updateCondicaoPagamento error', e); throw e; }
    };
    const removeCondicaoPagamento = async (id: string) => {
        try {
            await axios.delete(`${API}/api/condicoes-pagamento/${id}`);
            setCondicoesPagamento(p => p.filter(x => x.id !== id));
        } catch (e) { console.error('removeCondicaoPagamento error', e); throw e; }
    };

    const addModoPagamento = async (m: Omit<ModoPagamento, 'id'>) => {
        try {
            const { data } = await axios.post(`${API}/api/modos-pagamento`, m);
            setModosPagamento(p => [...p, norm(data) as ModoPagamento]);
        } catch (e) { console.error('addModoPagamento error', e); throw e; }
    };
    const updateModoPagamento = async (id: string, m: Partial<ModoPagamento>) => {
        try {
            await axios.put(`${API}/api/modos-pagamento/${id}`, m);
            setModosPagamento(p => p.map(x => x.id === id ? { ...x, ...m } : x));
        } catch (e) { console.error('updateModoPagamento error', e); throw e; }
    };
    const removeModoPagamento = async (id: string) => {
        try {
            await axios.delete(`${API}/api/modos-pagamento/${id}`);
            setModosPagamento(p => p.filter(x => x.id !== id));
        } catch (e) { console.error('removeModoPagamento error', e); throw e; }
    };

    const addFaturaFornecedor = async (f: Omit<FaturaFornecedor, 'id'>): Promise<FaturaFornecedor> => {
        const { data } = await axios.post(`${API}/api/faturas-fornecedor`, {
            ...f,
            fornecedorId: f.fornecedorId,
            linhas: f.linhas,
        });
        const n = normFaturaFornecedor(data);
        setFaturasFornecedor(p => [n, ...p]);
        // Reload artigos to reflect updated stock/custoMedio
        try {
            const { data: arts } = await axios.get(`${API}/api/artigos`);
            setArtigos(arts.map(normArtigo));
        } catch {}
        return n;
    };
    const updateFaturaFornecedor = async (id: string, f: Partial<FaturaFornecedor>) => {
        try {
            await axios.put(`${API}/api/faturas-fornecedor/${id}`, f);
            setFaturasFornecedor(p => p.map(x => x.id === id ? { ...x, ...f } : x));
        } catch (e) { console.error('updateFaturaFornecedor error', e); throw e; }
    };

    /* ── Entities ───────────────────────────────────────────── */
    const addCliente = (c: Omit<Cliente, 'id'>): Cliente => {
        const placeholder: Cliente = { ...c, id: '' };
        axios.post(`${API}/api/clientes`, c)
            .then(({ data }) => {
                const n = normCliente(data);
                setClientes(p => [...p, n]);
                log('Clientes', 'Cliente criado', `Nome: ${c.nome}`);
            })
            .catch(e => console.error('addCliente error', e));
        return placeholder;
    };
    const updateCliente = async (id: string, c: Partial<Cliente>) => {
        try {
            await axios.put(`${API}/api/clientes/${id}`, c);
            setClientes(p => p.map(x => x.id === id ? { ...x, ...c } : x));
            log('Clientes', 'Cliente actualizado', `ID: ${id}`);
        } catch (e) { console.error('updateCliente error', e); throw e; }
    };
    const removeCliente = async (id: string) => {
        const nome = clientes.find(x => x.id === id)?.nome ?? id;
        await axios.delete(`${API}/api/clientes/${id}`);
        setClientes(p => p.filter(x => x.id !== id));
        log('Clientes', 'Cliente eliminado', `Nome: ${nome}`, 'warning');
    };

    const addTecnico = (t: Omit<Tecnico, 'id'>): Tecnico => {
        const placeholder: Tecnico = { ...t, id: '' };
        axios.post(`${API}/api/tecnicos`, t)
            .then(({ data }) => {
                const n = norm(data) as Tecnico;
                setTecnicos(p => [...p, n]);
                log('Técnicos', 'Técnico criado', `Nome: ${t.nome}`);
            })
            .catch(e => console.error('addTecnico error', e));
        return placeholder;
    };
    const updateTecnico = async (id: string, t: Partial<Tecnico>) => {
        try {
            await axios.put(`${API}/api/tecnicos/${id}`, t);
            setTecnicos(p => p.map(x => x.id === id ? { ...x, ...t } : x));
            log('Técnicos', 'Técnico actualizado', `ID: ${id}`);
        } catch (e) { console.error('updateTecnico error', e); throw e; }
    };
    const removeTecnico = async (id: string) => {
        const nome = tecnicos.find(x => x.id === id)?.nome ?? id;
        await axios.delete(`${API}/api/tecnicos/${id}`);
        setTecnicos(p => p.filter(x => x.id !== id));
        log('Técnicos', 'Técnico eliminado', `Nome: ${nome}`, 'warning');
    };

    const addFornecedor = (f: Omit<Fornecedor, 'id'>): Fornecedor => {
        const placeholder: Fornecedor = { ...f, id: '' };
        axios.post(`${API}/api/fornecedores`, f)
            .then(({ data }) => {
                const n = norm(data) as Fornecedor;
                setFornecedores(p => [...p, n]);
                log('Fornecedores', 'Fornecedor criado', `Nome: ${f.nome}`);
            })
            .catch(e => console.error('addFornecedor error', e));
        return placeholder;
    };
    const updateFornecedor = async (id: string, f: Partial<Fornecedor>) => {
        try {
            await axios.put(`${API}/api/fornecedores/${id}`, f);
            setFornecedores(p => p.map(x => x.id === id ? { ...x, ...f } : x));
            log('Fornecedores', 'Fornecedor actualizado', `ID: ${id}`);
        } catch (e) { console.error('updateFornecedor error', e); throw e; }
    };
    const removeFornecedor = async (id: string) => {
        const nome = fornecedores.find(x => x.id === id)?.nome ?? id;
        await axios.delete(`${API}/api/fornecedores/${id}`);
        setFornecedores(p => p.filter(x => x.id !== id));
        log('Fornecedores', 'Fornecedor eliminado', `Nome: ${nome}`, 'warning');
    };

    /* ── Equipment ──────────────────────────────────────────── */
    const addModelo = (m: Omit<ModeloEquipamento, 'id'>): ModeloEquipamento => {
        const placeholder: ModeloEquipamento = { ...m, id: '' };
        axios.post(`${API}/api/modelos-equipamento`, m)
            .then(({ data }) => {
                const n = norm(data) as ModeloEquipamento;
                setModelosEquipamento(p => [...p, n]);
            })
            .catch(e => console.error('addModelo error', e));
        return placeholder;
    };
    const updateModelo = async (id: string, m: Partial<ModeloEquipamento>) => {
        try {
            await axios.put(`${API}/api/modelos-equipamento/${id}`, m);
            setModelosEquipamento(p => p.map(x => x.id === id ? { ...x, ...m } : x));
        } catch (e) { console.error('updateModelo error', e); throw e; }
    };

    const addEquipInstalado = (e: Omit<EquipInstalado, 'id'>): EquipInstalado => {
        const placeholder: EquipInstalado = { ...e, id: '' };
        axios.post(`${API}/api/equip-instalados`, e)
            .then(({ data }) => {
                const n = normEquip(data);
                setEquipInstalados(p => [...p, n]);
            })
            .catch(err => console.error('addEquipInstalado error', err));
        return placeholder;
    };
    const updateEquipInstalado = async (id: string, e: Partial<EquipInstalado>) => {
        try {
            await axios.put(`${API}/api/equip-instalados/${id}`, e);
            setEquipInstalados(p => p.map(x => x.id === id ? { ...x, ...e } : x));
        } catch (e) { console.error('updateEquipInstalado error', e); throw e; }
    };

    /* ── Plans ──────────────────────────────────────────────── */
    const addPlano = (p: Omit<PlanoManutencao, 'id'>): PlanoManutencao => {
        const placeholder: PlanoManutencao = { ...p, id: '' };
        axios.post(`${API}/api/planos`, p)
            .then(({ data }) => {
                const n = normPlano(data);
                setPlanos(prev => [...prev, n]);
            })
            .catch(e => console.error('addPlano error', e));
        return placeholder;
    };
    const updatePlano = async (id: string, p: Partial<PlanoManutencao>) => {
        try {
            await axios.put(`${API}/api/planos/${id}`, p);
            setPlanos(prev => prev.map(x => x.id === id ? { ...x, ...p } : x));
        } catch (e) { console.error('updatePlano error', e); throw e; }
    };
    const removePlano = async (id: string) => {
        try {
            await axios.delete(`${API}/api/planos/${id}`);
            setPlanos(prev => prev.filter(x => x.id !== id));
        } catch (e) { console.error('removePlano error', e); throw e; }
    };

    /* ── Work Orders ────────────────────────────────────────── */
    const addOrdem = (o: Omit<OrdemTrabalho, 'id'>): OrdemTrabalho => {
        const placeholder: OrdemTrabalho = { ...o, id: '' };
        axios.post(`${API}/api/ordens`, o)
            .then(({ data }) => {
                const n = normOrdem(data);
                setOrdens(p => [...p, n]);
                log('Ordens de Trabalho', 'OT criada', `Tipo: ${o.tipo} | ${o.descricao?.slice(0, 60)}`);
            })
            .catch(e => console.error('addOrdem error', e));
        return placeholder;
    };
    const updateOrdem = async (id: string, o: Partial<OrdemTrabalho>) => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { reprogramacoes, ...payload } = o as any;
            const { data: updated } = await axios.put(`${API}/api/ordens/${id}`, payload);
            setOrdens(p => p.map(x => x.id === id ? normOrdem(updated) : x));
            log('Ordens de Trabalho', 'OT actualizada', `ID: ${id}`);
        } catch (e) { console.error('updateOrdem error', e); throw e; }
    };
    const removeOrdem = async (id: string) => {
        try {
            await axios.delete(`${API}/api/ordens/${id}`);
            setOrdens(p => p.filter(x => x.id !== id));
        } catch (e) { console.error('removeOrdem error', e); throw e; }
    };

    const emitirOT = async (id: string, dataEmissao?: string, dataInicio?: string) => {
        try {
            // Use fresh OT data from the backend response — works for both periodic and pontual OTs
            const { data: emittedRaw } = await axios.put(`${API}/api/ordens/${id}/emitir`, { dataEmissao, dataInicio });
            const emitted = normOrdem(emittedRaw);
            setOrdens(p => p.map(x => x.id === id ? emitted : x));
            log('Ordens de Trabalho', 'OT emitida', `ID: ${id}`);

            // Deduct physical stock for every article on the OT
            const hoje = today();
            const artigosSnapshot = artigos;
            for (const art of (emitted.artigos ?? [])) {
                if (!art.artigoId || art.quantidade <= 0) continue;
                await axios.put(`${API}/api/artigos/${art.artigoId}/ajuste`, { delta: -art.quantidade })
                    .then(({ data: updated }) => setArtigos(p => p.map(x => x.id === art.artigoId ? normArtigo(updated) : x)))
                    .catch(e => console.error('ajuste existencia error', e));
                const artigoInfo = artigosSnapshot.find(a => a.id === art.artigoId);
                axios.post(`${API}/api/movimentos-stock`, {
                    artigoId: art.artigoId,
                    tipo: 'saida',
                    quantidade: art.quantidade,
                    armazemId: artigoInfo?.codigoArmazem ?? '',
                    referencia: `OT-${id}`,
                    usuario: currentUserRef.current?.email ?? 'sistema',
                    observacao: `Saída OT ${id}`,
                    data: hoje,
                }).then(({ data }) => setMovimentosStock(p => [...p, normMovimento(data)]))
                  .catch(e => console.error('movimento OT error', e));
            }
        } catch (e) { console.error('emitirOT error', e); throw e; }
    };

    const terminarOT = async (id: string, dataFim?: string) => {
        try {
            await axios.put(`${API}/api/ordens/${id}/terminar`, { dataFim });
            const { data: all } = await axios.get(`${API}/api/ordens`);
            setOrdens(all.map(normOrdem));
            log('Ordens de Trabalho', 'OT terminada', `ID: ${id}`);
        } catch (e) { console.error('terminarOT error', e); throw e; }
    };

    const encerrarOT = async (id: string, dataEncerramento?: string) => {
        try {
            await axios.put(`${API}/api/ordens/${id}/encerrar`, { dataEncerramento });
            setOrdens(p => p.map(x => x.id === id ? { ...x, estado: 'Encerrado', dataEncerramento: dataEncerramento ?? today() } : x));
            log('Ordens de Trabalho', 'OT encerrada', `ID: ${id}`);
        } catch (e) { console.error('encerrarOT error', e); throw e; }
    };

    const updateEmpresaConfig = async (c: Partial<EmpresaConfig>) => {
        try {
            const { data } = await axios.put(`${API}/api/configuracao`, c);
            const ec: EmpresaConfig = {
                id: data.id?.toString(), nome: data.nome, nif: data.nif ?? '', morada: data.morada ?? '',
                telefone: data.telefone ?? '', email: data.email ?? '', website: data.website,
                logoUrl: data.logoUrl, iban: data.iban ?? '', banco: data.banco ?? '',
                moeda: data.moeda ?? 'AOA', taxaIva: Number(data.taxaIva ?? 0),
                latitude: data.latitude ? Number(data.latitude) : undefined,
                longitude: data.longitude ? Number(data.longitude) : undefined,
                rodapeDocumentos: data.rodapeDocumentos,
                casasDecimais: data.casasDecimais !== undefined ? Number(data.casasDecimais) : 2,
                formatoData: data.formatoData ?? 'DD/MM/YYYY',
            };
            setEmpresaConfig(ec);
            setTaxaIvaGlobal(Number(data.taxaIva ?? 0));
        } catch (e) { console.error('updateEmpresaConfig error', e); throw e; }
    };

    const reprogramarOT = async (id: string, novaData: string, dataAnterior?: string, motivo?: string) => {
        try {
            const usuario = currentUserRef.current?.email ?? 'sistema';
            const { data } = await axios.post(`${API}/api/ordens/${id}/reprogramar`, { novaData, dataAnterior, motivo, usuario });
            const updated = normOrdem(data);
            setOrdens(p => p.map(x => x.id === id ? updated : x));
            log('Ordens de Trabalho', 'OT reprogramada', `ID: ${id} → ${novaData}; Motivo: ${motivo ?? ''}`, 'warning');
        } catch (e) { console.error('reprogramarOT error', e); throw e; }
    };

    /* ── Warehouse ──────────────────────────────────────────── */
    const addArmazem = (a: Omit<Armazem, 'id'>): Armazem => {
        const placeholder: Armazem = { ...a, id: '' };
        axios.post(`${API}/api/armazens`, a)
            .then(({ data }) => {
                const n = norm(data) as Armazem;
                setArmazens(p => [...p, n]);
            })
            .catch(e => console.error('addArmazem error', e));
        return placeholder;
    };
    const updateArmazem = async (id: string, a: Partial<Armazem>) => {
        try {
            await axios.put(`${API}/api/armazens/${id}`, a);
            setArmazens(p => p.map(x => x.id === id ? { ...x, ...a } : x));
        } catch (e) { console.error('updateArmazem error', e); throw e; }
    };

    /* ── Stock ──────────────────────────────────────────────── */
    const addArtigo = (a: Omit<Artigo, 'id'>): Artigo => {
        const placeholder: Artigo = { ...a, id: '' };
        axios.post(`${API}/api/artigos`, a)
            .then(({ data }) => {
                const n = normArtigo(data);
                setArtigos(p => [...p, n]);
            })
            .catch(e => console.error('addArtigo error', e));
        return placeholder;
    };
    const updateArtigo = async (id: string, a: Partial<Artigo>) => {
        try {
            await axios.put(`${API}/api/artigos/${id}`, a);
            setArtigos(p => p.map(x => x.id === id ? { ...x, ...a } : x));
        } catch (e) { console.error('updateArtigo error', e); throw e; }
    };
    const adjustExistencia = async (id: string, delta: number) => {
        try {
            await axios.put(`${API}/api/artigos/${id}/ajuste`, { delta });
            setArtigos(p => p.map(x => x.id === id ? { ...x, existencia: x.existencia + delta } : x));
        } catch (e) { console.error('adjustExistencia error', e); throw e; }
    };

    const adjustReservado = async (id: string, delta: number) => {
        try {
            await axios.put(`${API}/api/artigos/${id}/reserva`, { delta });
            setArtigos(p => p.map(x => x.id === id ? { ...x, stockReservado: Math.max(0, x.stockReservado + delta) } : x));
        } catch (e) { console.error('adjustReservado error', e); }
    };

    const upsertStockArmazem = async (artigoId: string, armazemId: string, quantidade: number, stockMinimo: number) => {
        const { data } = await axios.post(`${API}/api/artigos/${artigoId}/stock-armazem`, { armazemId: Number(armazemId), quantidade, stockMinimo });
        const entry = normStockArmazem(data);
        setStockArmazem(p => {
            const idx = p.findIndex(x => x.id === entry.id);
            return idx >= 0 ? p.map((x, i) => i === idx ? entry : x) : [...p, entry];
        });
    };

    const removeStockArmazem = async (saId: string) => {
        await axios.delete(`${API}/api/artigos/stock-armazem/${saId}`);
        setStockArmazem(p => p.filter(x => x.id !== saId));
    };

    const addMovimento = (m: Omit<MovimentoStock, 'id'>): MovimentoStock => {
        const placeholder: MovimentoStock = { ...m, id: '' };
        const tipoLabel: Record<string, string> = {
            entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste',
            transferencia: 'Transferência', devolucao: 'Devolução',
        };
        axios.post(`${API}/api/movimentos-stock`, m)
            .then(({ data }) => {
                setMovimentosStock(p => [...p, normMovimento(data)]);
            })
            .catch(e => console.error('addMovimento error', e));
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
        axios.post(`${API}/api/encomendas`, e)
            .then(({ data }) => {
                const n = normEncomenda(data);
                setEncomendas(p => [...p, n]);
                // Refresh artigos so stockEncomendado reflects new PO
                axios.get(`${API}/api/artigos`).then(r => setArtigos(r.data.map(normArtigo)));
            })
            .catch(err => console.error('addEncomenda error', err));
        return placeholder;
    };
    const updateEncomenda = async (id: string, e: Partial<Encomenda>) => {
        try {
            await axios.put(`${API}/api/encomendas/${id}`, e);
            setEncomendas(p => p.map(x => x.id === id ? { ...x, ...e } : x));
            // When cancelling, backend releases stockEncomendado — refresh artigos
            if (e.estado === 'Cancelada') {
                axios.get(`${API}/api/artigos`).then(r => setArtigos(r.data.map(normArtigo)));
            }
        } catch (e) { console.error('updateEncomenda error', e); throw e; }
    };
    const criarRececao = async (
        encId: string,
        recebidas: { artigoId: string; qtd: number }[],
        guiaRemessa: string,
        operador: string,
        armazem: string,
    ): Promise<Encomenda> => {
        const { data } = await axios.post(`${API}/api/encomendas/${encId}/receber`, {
            recebidas, guiaRemessa, operador, armazem,
        });
        const enc = normEncomenda(data);
        setEncomendas(p => p.map(x => x.id === encId ? enc : x));
        const artRes = await axios.get(`${API}/api/artigos`);
        setArtigos(artRes.data.map(normArtigo));
        log('Encomendas', 'Receção registada', `Encomenda ${encId} · GR: ${guiaRemessa} · ${recebidas.length} linha(s)`);
        return enc;
    };

    const anularRececao = async (rececaoId: string): Promise<Encomenda> => {
        const { data } = await axios.post(`${API}/api/encomendas/rececoes/${rececaoId}/anular`);
        const enc = normEncomenda(data);
        setEncomendas(p => p.map(x => x.id === enc.id ? enc : x));
        const artRes = await axios.get(`${API}/api/artigos`);
        setArtigos(artRes.data.map(normArtigo));
        log('Encomendas', 'Receção anulada', `Receção ID: ${rececaoId}`);
        return enc;
    };

    /* ── Invoices ───────────────────────────────────────────── */
    const addFatura = (f: Omit<Fatura, 'id'>): Fatura => {
        const placeholder: Fatura = { ...f, id: '' };
        axios.post(`${API}/api/faturas`, f)
            .then(({ data }) => {
                const n = normFatura(data);
                setFaturas(p => [...p, n]);
                log('Faturação', 'Documento emitido', `Tipo: ${f.tipoDocumento} | Total: ${f.valorTotal} ${f.moeda}`);
            })
            .catch(e => console.error('addFatura error', e));
        return placeholder;
    };
    const updateFatura = async (id: string, f: Partial<Fatura>) => {
        try {
            await axios.put(`${API}/api/faturas/${id}`, f);
            setFaturas(p => p.map(x => x.id === id ? { ...x, ...f } : x));
        } catch (e) { console.error('updateFatura error', e); throw e; }
    };

    /* ── Compute stockReservado dynamically from Programado OTs ── */
    const artigosComReserva = useMemo(() => {
        const reservaMap: Record<string, number> = {};
        ordens.filter(o => o.estado === 'Programado').forEach(o => {
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
            clientes, addCliente, updateCliente, removeCliente,
            tecnicos, addTecnico, updateTecnico, removeTecnico,
            fornecedores, addFornecedor, updateFornecedor, removeFornecedor,
            modelosEquipamento, addModelo, updateModelo,
            equipInstalados, addEquipInstalado, updateEquipInstalado,
            planos, addPlano, updatePlano, removePlano,
            ordens, addOrdem, updateOrdem, removeOrdem, emitirOT, terminarOT, encerrarOT, reprogramarOT,
            armazens, addArmazem, updateArmazem,
            artigos: artigosComReserva, addArtigo, updateArtigo, adjustExistencia, adjustReservado,
            stockArmazem, upsertStockArmazem, removeStockArmazem,
            movimentosStock, addMovimento,
            encomendas, addEncomenda, updateEncomenda, criarRececao, anularRececao,
            faturas, addFatura, updateFatura,
            faturasFornecedor, addFaturaFornecedor, updateFaturaFornecedor,
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
