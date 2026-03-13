import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3001';

/* ══════════════════════════════════════════════════════════════
   INTERFACES
══════════════════════════════════════════════════════════════ */

// ── System Tables ──────────────────────────────────────────
export interface TipoTrabalho { id: string; codigo: string; descricao: string; }
export interface TipoDocumento { id: string; codigo: string; descricao: string; }
export interface FuncaoTecnico { id: string; codigo: string; descricao: string; custo: number; }
export interface Moeda { id: string; codigo: string; descricao: string; simbolo: string; }
export interface Pais { id: string; nome: string; codigo: string; }
export interface Provincia { id: string; nome: string; paisId: string; }
export interface Municipio { id: string; nome: string; provinciaId: string; }

// ── Entities ───────────────────────────────────────────────
export interface Cliente {
    id: string; tipo: 'empresa' | 'particular'; nome: string;
    nif: string; email: string; telefone: string; morada: string;
    municipio: string; provincia: string; ativo: boolean;
}
export interface Tecnico {
    id: string; nome: string; telefone: string; email: string;
    funcaoId: string; custoHora: number; ativo: boolean;
}
export interface CurrentUser { nome: string; email: string; role: string; tecnicoId?: string; tecnicoNome?: string; }
export interface SysLog { id: string; timestamp: string; usuario: string; modulo: string; acao: string; detalhes: string; tipo: 'info' | 'warning' | 'error'; }
export interface Fornecedor {
    id: string; nome: string; nif: string; telefone: string;
    email: string; morada: string; ativo: boolean;
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
export interface OTArtigo { artigoId: string; descricao: string; quantidade: number; preco: number; }
export interface OrdemTrabalho {
    id: string; tipo: OTTipo; equipInstaladoId: string; clienteId: string;
    descricao: string; previsaoTempo: number; periodicidade?: string;
    planoId?: string; tipoTrabalho: string; responsavel: string;
    maosDeObra: OTMaoObra[];
    artigos: OTArtigo[];
    orgao?: string; sintoma?: string; causa?: string;
    dataProgInicio?: string; dataProgFim?: string;
    dataEmissao?: string; dataInicio?: string;
    dataFim?: string; dataEncerramento?: string;
    estado: OTEstado;
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

// ── Stock ──────────────────────────────────────────────────
export interface Artigo {
    id: string; codigo: string; descricao: string;
    classe: string; familia: string; imagem?: string;
    precoUnitario: number; moeda: string;
    existencia: number; nivelMaximo: number; stockSeguranca: number;
    custoMedio: number; codigoArmazem: string; inativo: boolean; critico: boolean;
    observacao?: string;
}

// ── Purchase Orders ────────────────────────────────────────
export type EncomendaEstado = 'Aberta' | 'Parcial' | 'Recebida' | 'Cancelada';
export interface EncomendaLinha {
    artigoId: string; codigo: string; descricao: string;
    qtdEncomendada: number; qtdRecebida: number;
    unidade: string; custoUnit: number; desconto: number;
}
export interface Encomenda {
    id: string; numero: string; fornecedorId: string;
    data: string; dataEntrega: string; condicoesPagamento: string;
    responsavel: string; moeda: string; descricao: string; observacoes?: string;
    estado: EncomendaEstado; linhas: EncomendaLinha[];
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

/* ══════════════════════════════════════════════════════════════
   COMPANY INFO
══════════════════════════════════════════════════════════════ */
export const EMPRESA_INFO = {
    nome: 'AQUATEX, LDA', nif: '5000001234',
    telefone: '+244 923 456 789', email: 'geral@aquatex.co.ao',
    morada: 'Rua Comandante Gika, 45, Luanda', iban: 'AO06 0006 0000 0000 1234 1012',
    banco: 'Banco BFA', ivaDefault: 14, moeda: 'AOA',
};

/* ══════════════════════════════════════════════════════════════
   NORMALIZATION HELPERS
══════════════════════════════════════════════════════════════ */
const norm = (item: any) => ({ ...item, id: item.id?.toString() });
const normProvincia = (p: any): Provincia => ({ id: p.id?.toString(), nome: p.nome, paisId: p.pais?.id?.toString() ?? '' });
const normMunicipio = (m: any): Municipio => ({ id: m.id?.toString(), nome: m.nome, provinciaId: m.provincia?.id?.toString() ?? '' });
const normFuncaoTecnico = (f: any): FuncaoTecnico => ({ id: f.id?.toString(), codigo: f.codigo, descricao: f.descricao, custo: Number(f.custo) });
const normArtigo = (a: any): Artigo => ({ ...a, id: a.id?.toString(), precoUnitario: Number(a.precoUnitario), existencia: Number(a.existencia), nivelMaximo: Number(a.nivelMaximo), stockSeguranca: Number(a.stockSeguranca), custoMedio: Number(a.custoMedio) });

const normCliente = (c: any): Cliente => ({
    id: c.id?.toString(), tipo: c.tipo, nome: c.nome, nif: c.nif ?? '',
    email: c.email ?? '', telefone: c.telefone ?? '',
    morada: c.enderecos?.[0]?.morada ?? '', municipio: c.enderecos?.[0]?.cidade ?? '',
    provincia: '', ativo: c.ativo ?? true,
});

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
    planoId: o.planoId?.toString(), tipoTrabalho: o.tipoTrabalho ?? '',
    responsavel: o.responsavel ?? '', maosDeObra: (o.maosObra ?? []).map((m: any) => ({ funcao: m.funcao, custo: Number(m.custo), hora: m.hora })),
    artigos: (o.artigos ?? []).map((a: any) => ({ artigoId: a.artigoId?.toString() ?? '', descricao: a.descricao, quantidade: Number(a.quantidade), preco: Number(a.preco) })),
    orgao: o.orgao, sintoma: o.sintoma, causa: o.causa,
    dataProgInicio: o.dataProgInicio, dataProgFim: o.dataProgFim,
    dataEmissao: o.dataEmissao, dataInicio: o.dataInicio, dataFim: o.dataFim, dataEncerramento: o.dataEncerramento,
    estado: o.estado,
});

const normEncomenda = (e: any): Encomenda => ({
    id: e.id?.toString(), numero: e.numero,
    fornecedorId: e.fornecedor?.id?.toString() ?? e.fornecedorId?.toString() ?? '',
    data: e.data, dataEntrega: e.dataEntrega, condicoesPagamento: e.condicoesPagamento ?? '',
    responsavel: e.responsavel ?? '', moeda: e.moeda ?? 'AOA', descricao: e.descricao ?? '',
    observacoes: e.observacoes, estado: e.estado,
    linhas: (e.linhas ?? []).map((l: any) => ({
        artigoId: l.artigoId?.toString() ?? '', codigo: l.codigo, descricao: l.descricao,
        qtdEncomendada: Number(l.qtdEncomendada), qtdRecebida: Number(l.qtdRecebida),
        unidade: l.unidade ?? 'UN', custoUnit: Number(l.custoUnit), desconto: Number(l.desconto),
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
    funcoesTecnico: FuncaoTecnico[]; addFuncaoTecnico: (f: Omit<FuncaoTecnico, 'id'>) => void; updateFuncaoTecnico: (id: string, f: Partial<FuncaoTecnico>) => void; removeFuncaoTecnico: (id: string) => void;
    moedas: Moeda[]; addMoeda: (m: Omit<Moeda, 'id'>) => void; updateMoeda: (id: string, m: Partial<Moeda>) => void; removeMoeda: (id: string) => void;
    tiposDocumento: TipoDocumento[]; addTipoDocumento: (t: Omit<TipoDocumento, 'id'>) => void; updateTipoDocumento: (id: string, t: Partial<TipoDocumento>) => void; removeTipoDocumento: (id: string) => void;
    paises: Pais[]; provincias: Provincia[]; municipios: Municipio[];
    // Auth
    currentUser: CurrentUser | null; setCurrentUser: (u: CurrentUser | null) => void; logout: () => void;
    // Logs
    logs: SysLog[]; addLog: (l: Omit<SysLog, 'id'>) => void;
    // Entities
    clientes: Cliente[]; addCliente: (c: Omit<Cliente, 'id'>) => Cliente; updateCliente: (id: string, c: Partial<Cliente>) => void;
    tecnicos: Tecnico[]; addTecnico: (t: Omit<Tecnico, 'id'>) => Tecnico; updateTecnico: (id: string, t: Partial<Tecnico>) => void;
    fornecedores: Fornecedor[]; addFornecedor: (f: Omit<Fornecedor, 'id'>) => Fornecedor; updateFornecedor: (id: string, f: Partial<Fornecedor>) => void;
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
    // Warehouse
    armazens: Armazem[]; addArmazem: (a: Omit<Armazem, 'id'>) => Armazem; updateArmazem: (id: string, a: Partial<Armazem>) => void;
    // Stock
    artigos: Artigo[]; addArtigo: (a: Omit<Artigo, 'id'>) => Artigo; updateArtigo: (id: string, a: Partial<Artigo>) => void; adjustExistencia: (id: string, delta: number) => void;
    movimentosStock: MovimentoStock[]; addMovimento: (m: Omit<MovimentoStock, 'id'>) => MovimentoStock;
    // Purchases
    encomendas: Encomenda[]; addEncomenda: (e: Omit<Encomenda, 'id'>) => Encomenda; updateEncomenda: (id: string, e: Partial<Encomenda>) => void;
    receberLinhas: (encId: string, recebidas: { artigoId: string; qtd: number }[]) => void;
    // Invoices
    faturas: Fatura[]; addFatura: (f: Omit<Fatura, 'id'>) => Fatura; updateFatura: (id: string, f: Partial<Fatura>) => void;
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
    const [tiposTrabalho, setTiposTrabalho] = useState<TipoTrabalho[]>([]);
    const [tiposDocumento, setTiposDocumento] = useState<TipoDocumento[]>([]);
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
    const [movimentosStock, setMovimentosStock] = useState<MovimentoStock[]>([]);
    const [encomendas, setEncomendas] = useState<Encomenda[]>([]);
    const [faturas, setFaturas] = useState<Fatura[]>([]);

    const today = () => new Date().toISOString().split('T')[0];

    /* ── Initial data load ──────────────────────────────────── */
    useEffect(() => {
        const load = async () => {
            try {
                const [tt, td, ft, mo, pa, pr, mu, cl, te, fo, me, ei, pl, or, ar, ar2, mv, en, fa, lg] = await Promise.all([
                    axios.get(`${API}/api/tipos-trabalho`),
                    axios.get(`${API}/api/tipos-documento`),
                    axios.get(`${API}/api/funcoes-tecnico`),
                    axios.get(`${API}/api/moedas`),
                    axios.get(`${API}/api/paises`),
                    axios.get(`${API}/api/provincias`),
                    axios.get(`${API}/api/municipios`),
                    axios.get(`${API}/api/clientes`),
                    axios.get(`${API}/api/tecnicos`),
                    axios.get(`${API}/api/fornecedores`),
                    axios.get(`${API}/api/modelos-equipamento`),
                    axios.get(`${API}/api/equip-instalados`),
                    axios.get(`${API}/api/planos`),
                    axios.get(`${API}/api/ordens`),
                    axios.get(`${API}/api/armazens`),
                    axios.get(`${API}/api/artigos`),
                    axios.get(`${API}/api/movimentos-stock`),
                    axios.get(`${API}/api/encomendas`),
                    axios.get(`${API}/api/faturas`),
                    axios.get(`${API}/api/logs`),
                ]);
                setTiposTrabalho(tt.data.map(norm));
                setTiposDocumento(td.data.map(norm));
                setFuncoesTecnico(ft.data.map(normFuncaoTecnico));
                setMoedas(mo.data.map(norm));
                setPaises(pa.data.map(norm));
                setProvincias(pr.data.map(normProvincia));
                setMunicipios(mu.data.map(normMunicipio));
                setClientes(cl.data.map(normCliente));
                setTecnicos(te.data.map(norm));
                setFornecedores(fo.data.map(norm));
                setModelosEquipamento(me.data.map(norm));
                setEquipInstalados(ei.data.map(normEquip));
                setPlanos(pl.data.map(normPlano));
                setOrdens(or.data.map(normOrdem));
                setArmazens(ar.data.map(norm));
                setArtigos(ar2.data.map(normArtigo));
                setMovimentosStock(mv.data.map(norm));
                setEncomendas(en.data.map(normEncomenda));
                setFaturas(fa.data.map(normFatura));
                setLogs(lg.data.map(norm));
            } catch (e) {
                console.error('Error loading data', e);
            }
        };
        load();
    }, []);

    /* ── Logs ───────────────────────────────────────────────── */
    const addLog = async (l: Omit<SysLog, 'id'>) => {
        try {
            const { data } = await axios.post(`${API}/api/logs`, l);
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

    /* ── Entities ───────────────────────────────────────────── */
    const addCliente = (c: Omit<Cliente, 'id'>): Cliente => {
        const placeholder: Cliente = { ...c, id: '' };
        axios.post(`${API}/api/clientes`, c)
            .then(({ data }) => {
                const n = normCliente(data);
                setClientes(p => [...p, n]);
            })
            .catch(e => console.error('addCliente error', e));
        return placeholder;
    };
    const updateCliente = async (id: string, c: Partial<Cliente>) => {
        try {
            await axios.put(`${API}/api/clientes/${id}`, c);
            setClientes(p => p.map(x => x.id === id ? { ...x, ...c } : x));
        } catch (e) { console.error('updateCliente error', e); throw e; }
    };

    const addTecnico = (t: Omit<Tecnico, 'id'>): Tecnico => {
        const placeholder: Tecnico = { ...t, id: '' };
        axios.post(`${API}/api/tecnicos`, t)
            .then(({ data }) => {
                const n = norm(data) as Tecnico;
                setTecnicos(p => [...p, n]);
            })
            .catch(e => console.error('addTecnico error', e));
        return placeholder;
    };
    const updateTecnico = async (id: string, t: Partial<Tecnico>) => {
        try {
            await axios.put(`${API}/api/tecnicos/${id}`, t);
            setTecnicos(p => p.map(x => x.id === id ? { ...x, ...t } : x));
        } catch (e) { console.error('updateTecnico error', e); throw e; }
    };

    const addFornecedor = (f: Omit<Fornecedor, 'id'>): Fornecedor => {
        const placeholder: Fornecedor = { ...f, id: '' };
        axios.post(`${API}/api/fornecedores`, f)
            .then(({ data }) => {
                const n = norm(data) as Fornecedor;
                setFornecedores(p => [...p, n]);
            })
            .catch(e => console.error('addFornecedor error', e));
        return placeholder;
    };
    const updateFornecedor = async (id: string, f: Partial<Fornecedor>) => {
        try {
            await axios.put(`${API}/api/fornecedores/${id}`, f);
            setFornecedores(p => p.map(x => x.id === id ? { ...x, ...f } : x));
        } catch (e) { console.error('updateFornecedor error', e); throw e; }
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
            })
            .catch(e => console.error('addOrdem error', e));
        return placeholder;
    };
    const updateOrdem = async (id: string, o: Partial<OrdemTrabalho>) => {
        try {
            await axios.put(`${API}/api/ordens/${id}`, o);
            setOrdens(p => p.map(x => x.id === id ? { ...x, ...o } : x));
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
            await axios.put(`${API}/api/ordens/${id}/emitir`, { dataEmissao, dataInicio });
            setOrdens(p => p.map(x => x.id === id ? { ...x, estado: 'Em curso', dataEmissao: dataEmissao ?? today(), dataInicio: dataInicio ?? today() } : x));
        } catch (e) { console.error('emitirOT error', e); throw e; }
    };

    const terminarOT = async (id: string, dataFim?: string) => {
        try {
            await axios.put(`${API}/api/ordens/${id}/terminar`, { dataFim });
            const { data: all } = await axios.get(`${API}/api/ordens`);
            setOrdens(all.map(normOrdem));
        } catch (e) { console.error('terminarOT error', e); throw e; }
    };

    const encerrarOT = async (id: string, dataEncerramento?: string) => {
        try {
            await axios.put(`${API}/api/ordens/${id}/encerrar`, { dataEncerramento });
            setOrdens(p => p.map(x => x.id === id ? { ...x, estado: 'Encerrado', dataEncerramento: dataEncerramento ?? today() } : x));
        } catch (e) { console.error('encerrarOT error', e); throw e; }
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
            setArtigos(p => p.map(x => x.id === id ? { ...x, existencia: Math.max(0, x.existencia + delta) } : x));
        } catch (e) { console.error('adjustExistencia error', e); throw e; }
    };

    const addMovimento = (m: Omit<MovimentoStock, 'id'>): MovimentoStock => {
        const placeholder: MovimentoStock = { ...m, id: '' };
        axios.post(`${API}/api/movimentos-stock`, m)
            .then(({ data }) => {
                const n = norm(data) as MovimentoStock;
                setMovimentosStock(p => [...p, n]);
            })
            .catch(e => console.error('addMovimento error', e));
        return placeholder;
    };

    /* ── Purchases ──────────────────────────────────────────── */
    const addEncomenda = (e: Omit<Encomenda, 'id'>): Encomenda => {
        const placeholder: Encomenda = { ...e, id: '' };
        axios.post(`${API}/api/encomendas`, e)
            .then(({ data }) => {
                const n = normEncomenda(data);
                setEncomendas(p => [...p, n]);
            })
            .catch(err => console.error('addEncomenda error', err));
        return placeholder;
    };
    const updateEncomenda = async (id: string, e: Partial<Encomenda>) => {
        try {
            await axios.put(`${API}/api/encomendas/${id}`, e);
            setEncomendas(p => p.map(x => x.id === id ? { ...x, ...e } : x));
        } catch (e) { console.error('updateEncomenda error', e); throw e; }
    };
    const receberLinhas = async (encId: string, recebidas: { artigoId: string; qtd: number }[]) => {
        try {
            await axios.post(`${API}/api/encomendas/${encId}/receber`, { recebidas });
            const [encRes, artRes] = await Promise.all([
                axios.get(`${API}/api/encomendas`),
                axios.get(`${API}/api/artigos`),
            ]);
            setEncomendas(encRes.data.map(normEncomenda));
            setArtigos(artRes.data.map(normArtigo));
        } catch (e) { console.error('receberLinhas error', e); throw e; }
    };

    /* ── Invoices ───────────────────────────────────────────── */
    const addFatura = (f: Omit<Fatura, 'id'>): Fatura => {
        const placeholder: Fatura = { ...f, id: '' };
        axios.post(`${API}/api/faturas`, f)
            .then(({ data }) => {
                const n = normFatura(data);
                setFaturas(p => [...p, n]);
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

    return (
        <GlobalContext.Provider value={{
            currentUser, setCurrentUser, logout,
            logs, addLog,
            tiposTrabalho, addTipoTrabalho, updateTipoTrabalho, removeTipoTrabalho,
            funcoesTecnico, addFuncaoTecnico, updateFuncaoTecnico, removeFuncaoTecnico,
            moedas, addMoeda, updateMoeda, removeMoeda,
            tiposDocumento, addTipoDocumento, updateTipoDocumento, removeTipoDocumento,
            paises, provincias, municipios,
            clientes, addCliente, updateCliente,
            tecnicos, addTecnico, updateTecnico,
            fornecedores, addFornecedor, updateFornecedor,
            modelosEquipamento, addModelo, updateModelo,
            equipInstalados, addEquipInstalado, updateEquipInstalado,
            planos, addPlano, updatePlano, removePlano,
            ordens, addOrdem, updateOrdem, removeOrdem, emitirOT, terminarOT, encerrarOT,
            armazens, addArmazem, updateArmazem,
            artigos, addArtigo, updateArtigo, adjustExistencia,
            movimentosStock, addMovimento,
            encomendas, addEncomenda, updateEncomenda, receberLinhas,
            faturas, addFatura, updateFatura,
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
