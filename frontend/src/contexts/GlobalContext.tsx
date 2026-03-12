import React, { createContext, useContext, useState } from 'react';

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
   INITIAL MOCK DATA
══════════════════════════════════════════════════════════════ */

const INIT_TIPOS_TRABALHO: TipoTrabalho[] = [
    { id: 'TT-001', codigo: 'PREV', descricao: 'Sistemático Preventivo' },
    { id: 'TT-002', codigo: 'CORR', descricao: 'Corretivo' },
    { id: 'TT-003', codigo: 'MONT', descricao: 'Montagem / Instalação' },
];
const INIT_TIPOS_DOCUMENTO: TipoDocumento[] = [
    { id: 'TD-001', codigo: 'FAT', descricao: 'Fatura' },
    { id: 'TD-002', codigo: 'FP',  descricao: 'Fatura Pro-Forma' },
];
const INIT_FUNCOES: FuncaoTecnico[] = [
    { id: 'FT-001', codigo: 'TEC-SR', descricao: 'Técnico Sénior', custo: 5000 },
    { id: 'FT-002', codigo: 'TEC-JR', descricao: 'Técnico Júnior', custo: 3000 },
    { id: 'FT-003', codigo: 'CHF-EQ', descricao: 'Chefe de Equipa', custo: 7000 },
];
const INIT_MOEDAS: Moeda[] = [
    { id: 'MOE-001', codigo: 'AOA', descricao: 'Kwanza Angolano', simbolo: 'Kz' },
    { id: 'MOE-002', codigo: 'EUR', descricao: 'Euro',             simbolo: '€'  },
    { id: 'MOE-003', codigo: 'USD', descricao: 'Dólar Americano',  simbolo: '$'  },
];
const INIT_PAISES: Pais[] = [
    { id: 'PA-001', nome: 'Angola',   codigo: 'AO' },
    { id: 'PA-002', nome: 'Portugal', codigo: 'PT' },
];
const INIT_PROVINCIAS: Provincia[] = [
    { id: 'PR-001', nome: 'Luanda',     paisId: 'PA-001' },
    { id: 'PR-002', nome: 'Benguela',   paisId: 'PA-001' },
    { id: 'PR-003', nome: 'Huíla',      paisId: 'PA-001' },
    { id: 'PR-004', nome: 'Kwanza Sul', paisId: 'PA-001' },
];
const INIT_MUNICIPIOS: Municipio[] = [
    { id: 'MU-001', nome: 'Luanda',   provinciaId: 'PR-001' },
    { id: 'MU-002', nome: 'Belas',    provinciaId: 'PR-001' },
    { id: 'MU-003', nome: 'Cacuaco',  provinciaId: 'PR-001' },
    { id: 'MU-004', nome: 'Benguela', provinciaId: 'PR-002' },
    { id: 'MU-005', nome: 'Lobito',   provinciaId: 'PR-002' },
    { id: 'MU-006', nome: 'Lubango',  provinciaId: 'PR-003' },
    { id: 'MU-007', nome: 'Sumbe',    provinciaId: 'PR-004' },
];

const INIT_CLIENTES: Cliente[] = [
    { id: 'CLI-001', tipo: 'empresa',    nome: 'Hotel Marina Palace',         nif: '5000012345', email: 'geral@marinapalace.ao',  telefone: '923 100 200', morada: 'Av. 4 de Fevereiro, 120',                   municipio: 'Luanda',  provincia: 'Luanda', ativo: true },
    { id: 'CLI-002', tipo: 'empresa',    nome: 'Clínica São João',            nif: '5000023456', email: 'admin@clinicasj.ao',     telefone: '923 200 300', morada: 'Rua Amilcar Cabral, 45',                      municipio: 'Luanda',  provincia: 'Luanda', ativo: true },
    { id: 'CLI-003', tipo: 'empresa',    nome: 'Supermercado Maxi',           nif: '5000034567', email: 'compras@maxi.ao',        telefone: '923 300 400', morada: 'Talatona Shopping Center',                    municipio: 'Belas',   provincia: 'Luanda', ativo: true },
    { id: 'CLI-004', tipo: 'empresa',    nome: 'Empresa Alpha, LDA',          nif: '5000045678', email: 'financeiro@alpha.ao',    telefone: '923 400 500', morada: 'Rua da Missão, 22',                           municipio: 'Luanda',  provincia: 'Luanda', ativo: true },
    { id: 'CLI-005', tipo: 'empresa',    nome: 'Universidade Agostinho Neto', nif: '5000056789', email: 'reitoria@uan.ao',        telefone: '923 500 600', morada: 'Av. 21 de Janeiro, 58',                      municipio: 'Luanda',  provincia: 'Luanda', ativo: true },
    { id: 'CLI-006', tipo: 'empresa',    nome: 'Banco Millennium Angola',     nif: '5000067890', email: 'admin@bma.ao',           telefone: '923 600 700', morada: 'Av. Lenine, 206',                             municipio: 'Luanda',  provincia: 'Luanda', ativo: true },
    { id: 'CLI-007', tipo: 'particular', nome: 'Manuel Costa',                nif: '006123456LA', email: 'manuelcosta@gmail.com', telefone: '912 111 222', morada: 'Condomínio Vida, B2-45',                     municipio: 'Belas',   provincia: 'Luanda', ativo: true },
    { id: 'CLI-008', tipo: 'empresa',    nome: 'Oficina Mecânica Progresso',  nif: '5000089012', email: 'progresso@gmail.com',    telefone: '923 800 900', morada: 'Estrada de Cacuaco, 12',                     municipio: 'Cacuaco', provincia: 'Luanda', ativo: true },
    { id: 'CLI-009', tipo: 'empresa',    nome: 'Farmácia Saúde Total',        nif: '5000090123', email: 'geral@saudetotal.ao',    telefone: '923 900 001', morada: 'Av. Ho Chi Minh, 34',                        municipio: 'Luanda',  provincia: 'Luanda', ativo: true },
    { id: 'CLI-010', tipo: 'empresa',    nome: 'Construtora Horizonte',       nif: '5000012340', email: 'obra@horizonte.ao',      telefone: '923 010 020', morada: 'Av. Pedro de Castro Van-Dúnem Loy, 67',     municipio: 'Luanda',  provincia: 'Luanda', ativo: true },
];

const INIT_TECNICOS: Tecnico[] = [
    { id: 'TEC-001', nome: 'António Silva',    telefone: '912 001 001', email: 'antonio.silva@aquatex.ao',  funcaoId: 'FT-001', custoHora: 5000, ativo: true },
    { id: 'TEC-002', nome: 'Gabriel Teixeira', telefone: '912 002 002', email: 'gabriel.t@aquatex.ao',      funcaoId: 'FT-002', custoHora: 3000, ativo: true },
    { id: 'TEC-003', nome: 'Pedro Neto',       telefone: '912 003 003', email: 'pedro.neto@aquatex.ao',     funcaoId: 'FT-001', custoHora: 5000, ativo: true },
    { id: 'TEC-004', nome: 'Rui Cunha',        telefone: '912 004 004', email: 'rui.cunha@aquatex.ao',      funcaoId: 'FT-003', custoHora: 7000, ativo: true },
    { id: 'TEC-005', nome: 'Carla Mendes',     telefone: '912 005 005', email: 'carla.mendes@aquatex.ao',   funcaoId: 'FT-001', custoHora: 4500, ativo: true },
    { id: 'TEC-006', nome: 'Sofia Gomes',      telefone: '912 006 006', email: 'sofia.gomes@aquatex.ao',    funcaoId: 'FT-002', custoHora: 3500, ativo: true },
];

const INIT_FORNECEDORES: Fornecedor[] = [
    { id: 'FOR-001', nome: 'Grundfos Angola, LDA',    nif: '5100001111', telefone: '222 001 100', email: 'angola@grundfos.com',  morada: 'Zona Industrial, Luanda',            ativo: true },
    { id: 'FOR-002', nome: 'Filtronix, SA',           nif: '5100002222', telefone: '222 002 200', email: 'vendas@filtronix.ao',  morada: 'Av. de Portugal, 45, Benguela',      ativo: true },
    { id: 'FOR-003', nome: 'EcoWater Systems Angola', nif: '5100003333', telefone: '222 003 300', email: 'angola@ecowater.com',  morada: 'Talatona Business Park, Luanda',     ativo: true },
];

const INIT_MODELOS: ModeloEquipamento[] = [
    { id: 'MOD-001', nome: 'Osmose Inversa Industrial 500L/h', marca: 'Aquatex',   tipo: 'maquina' },
    { id: 'MOD-002', nome: 'Sistema Purificação Aquatex Pro',  marca: 'Aquatex',   tipo: 'maquina' },
    { id: 'MOD-003', nome: 'Filtro Ultra-filtrante 1000L/h',   marca: 'Filtronix', tipo: 'filtro'  },
    { id: 'MOD-004', nome: 'Filtro de Carbono Activado 20"',   marca: 'EcoWater',  tipo: 'filtro'  },
    { id: 'MOD-005', nome: 'Softener Industrial 200L',         marca: 'Grundfos',  tipo: 'maquina' },
];

const INIT_EQUIP_INST: EquipInstalado[] = [
    { id: 'EI-001', clienteId: 'CLI-001', modeloId: 'MOD-001', nrSerie: 'AQ-OI-0021', dataInstalacao: '2025-06-15', estado: 'ativo',        dataUltimaManutencao: '2026-02-15', dataProximaManutencao: '2026-03-15', localizacao: 'Cozinha Industrial'  },
    { id: 'EI-002', clienteId: 'CLI-002', modeloId: 'MOD-002', nrSerie: 'AQ-SP-0037', dataInstalacao: '2025-09-10', estado: 'ativo',        dataUltimaManutencao: '2026-01-10', dataProximaManutencao: '2026-04-10', localizacao: 'Farmácia Interna'    },
    { id: 'EI-003', clienteId: 'CLI-003', modeloId: 'MOD-003', nrSerie: 'FX-UF-0014', dataInstalacao: '2025-04-20', estado: 'com_problema', dataUltimaManutencao: '2025-10-20', dataProximaManutencao: '2026-03-05', localizacao: 'Armazém B'           },
    { id: 'EI-004', clienteId: 'CLI-004', modeloId: 'MOD-004', nrSerie: 'EW-CA-0008', dataInstalacao: '2024-11-01', estado: 'ativo',        dataUltimaManutencao: '2026-02-01', dataProximaManutencao: '2026-05-01', localizacao: 'Escritório Principal'},
    { id: 'EI-005', clienteId: 'CLI-005', modeloId: 'MOD-005', nrSerie: 'GF-SI-0029', dataInstalacao: '2025-01-18', estado: 'ativo',        dataUltimaManutencao: '2025-12-18', dataProximaManutencao: '2026-03-18', localizacao: 'Laboratório A'       },
    { id: 'EI-006', clienteId: 'CLI-006', modeloId: 'MOD-001', nrSerie: 'AQ-OI-0045', dataInstalacao: '2026-01-20', estado: 'ativo',                                                                                   localizacao: 'Sala de Servidores'  },
];

const INIT_PLANOS: PlanoManutencao[] = [
    {
        id: 'PL-001', equipInstaladoId: 'EI-001', descricao: 'Manutenção Preventiva Mensal — OI 500L/h',
        tipoTrabalhoId: 'TT-001', periodicidade: 'Mensal', previsaoTempo: 3, ativo: true,
        maosDeObra: [{ funcaoId: 'FT-001', custo: 5000 }],
        artigos: [{ artigoId: 'ART-001', quantidade: 1, preco: 8500 }, { artigoId: 'ART-003', quantidade: 2, preco: 3200 }],
    },
    {
        id: 'PL-002', equipInstaladoId: 'EI-002', descricao: 'Manutenção Semestral — Sistema Purificação',
        tipoTrabalhoId: 'TT-001', periodicidade: 'Semestral', previsaoTempo: 6, ativo: true,
        maosDeObra: [{ funcaoId: 'FT-001', custo: 5000 }, { funcaoId: 'FT-002', custo: 3000 }],
        artigos: [{ artigoId: 'ART-002', quantidade: 2, preco: 4500 }, { artigoId: 'ART-004', quantidade: 1, preco: 12000 }],
    },
    {
        id: 'PL-003', equipInstaladoId: 'EI-005', descricao: 'Manutenção Trimestral — Softener Industrial',
        tipoTrabalhoId: 'TT-001', periodicidade: 'Trimestral', previsaoTempo: 4, ativo: true,
        maosDeObra: [{ funcaoId: 'FT-002', custo: 3000 }],
        artigos: [{ artigoId: 'ART-005', quantidade: 5, preco: 1200 }],
    },
];

const INIT_LOGS: SysLog[] = [
    { id: 'LOG-001', timestamp: '2026-03-11T08:05:12', usuario: 'admin@aquatex.ao', modulo: 'Autenticação',    acao: 'Login',             detalhes: 'Sessão iniciada com sucesso.',                                  tipo: 'info'    },
    { id: 'LOG-002', timestamp: '2026-03-11T08:12:34', usuario: 'admin@aquatex.ao', modulo: 'Ordens',          acao: 'OT Emitida',        detalhes: 'OT-0001 emitida. Estado: Programado → Em curso.',               tipo: 'info'    },
    { id: 'LOG-003', timestamp: '2026-03-11T09:01:00', usuario: 'admin@aquatex.ao', modulo: 'Stock',           acao: 'Inventário',        detalhes: 'Ajuste de inventário para 3 artigos (ARM-01).',                tipo: 'info'    },
    { id: 'LOG-004', timestamp: '2026-03-10T17:45:20', usuario: 'admin@aquatex.ao', modulo: 'Encomendas',      acao: 'Recepção parcial',  detalhes: 'ENC-003: 4 UN Lâmpada UV recebidas → ARM-01.',                 tipo: 'info'    },
    { id: 'LOG-005', timestamp: '2026-03-10T15:33:00', usuario: 'admin@aquatex.ao', modulo: 'Ordens',          acao: 'OT Criada',         detalhes: 'OT-0008 criada (pontual, Corretivo).',                          tipo: 'info'    },
    { id: 'LOG-006', timestamp: '2026-03-10T14:10:05', usuario: 'admin@aquatex.ao', modulo: 'Faturação',       acao: 'Fatura emitida',    detalhes: 'FAT-0101 emitida. Total: 45.486 Kz.',                           tipo: 'info'    },
    { id: 'LOG-007', timestamp: '2026-03-09T11:22:41', usuario: 'admin@aquatex.ao', modulo: 'Stock',           acao: 'Stock crítico',     detalhes: 'Filtro Sedimentos 10" abaixo do stock de segurança (3/8).',    tipo: 'warning' },
    { id: 'LOG-008', timestamp: '2026-03-09T09:00:00', usuario: 'admin@aquatex.ao', modulo: 'Técnicos',        acao: 'Técnico criado',    detalhes: 'Novo técnico registado: TEC-007.',                              tipo: 'info'    },
    { id: 'LOG-009', timestamp: '2026-03-08T16:55:10', usuario: 'admin@aquatex.ao', modulo: 'Parque',          acao: 'Equip. registado',  detalhes: 'EI-006 registado. OT de Montagem criada automaticamente.',      tipo: 'info'    },
    { id: 'LOG-010', timestamp: '2026-03-07T10:30:00', usuario: 'admin@aquatex.ao', modulo: 'Autenticação',    acao: 'Tentativa falhada', detalhes: 'Login falhado para o utilizador desconhecido@aquatex.ao.',       tipo: 'error'   },
];

const INIT_ORDENS: OrdemTrabalho[] = [
    {
        id: 'OT-0001', tipo: 'programada', equipInstaladoId: 'EI-001', clienteId: 'CLI-001',
        descricao: 'Manutenção preventiva mensal — substituição membranas e limpeza geral',
        previsaoTempo: 3, periodicidade: 'Mensal', planoId: 'PL-001', tipoTrabalho: 'Sistemático Preventivo', responsavel: 'António Silva',
        maosDeObra: [{ funcao: 'Técnico Sénior', custo: 5000, hora: '08:00' }],
        artigos: [{ artigoId: 'ART-001', descricao: 'Membrana Osmose Inversa 4040', quantidade: 1, preco: 8500 }, { artigoId: 'ART-003', descricao: 'Filtro Carvão Activado 20"', quantidade: 2, preco: 3200 }],
        dataProgInicio: '2026-03-15', dataProgFim: '2026-03-15', dataEmissao: '2026-03-10', dataInicio: '2026-03-10',
        estado: 'Em curso',
    },
    {
        id: 'OT-0002', tipo: 'programada', equipInstaladoId: 'EI-002', clienteId: 'CLI-002',
        descricao: 'Manutenção semestral — substituição filtros e calibração',
        previsaoTempo: 6, periodicidade: 'Semestral', planoId: 'PL-002', tipoTrabalho: 'Sistemático Preventivo', responsavel: 'Pedro Neto',
        maosDeObra: [{ funcao: 'Técnico Sénior', custo: 5000, hora: '08:00' }],
        artigos: [{ artigoId: 'ART-002', descricao: 'Filtro Sedimentos 10"', quantidade: 2, preco: 4500 }],
        dataProgInicio: '2026-04-10', dataProgFim: '2026-04-10',
        estado: 'Programado',
    },
    {
        id: 'OT-0003', tipo: 'pontual', equipInstaladoId: 'EI-003', clienteId: 'CLI-003',
        descricao: 'Avaria — sistema parado com alarme de baixa pressão',
        previsaoTempo: 4, tipoTrabalho: 'Corretivo', responsavel: 'Gabriel Teixeira',
        maosDeObra: [{ funcao: 'Técnico Júnior', custo: 3000, hora: '09:30' }],
        artigos: [],
        orgao: 'Bomba de Alta Pressão', sintoma: 'Baixa pressão', causa: 'Desgaste da bomba',
        dataEmissao: '2026-03-05', dataInicio: '2026-03-05', dataFim: '2026-03-06',
        estado: 'Terminado',
    },
    {
        id: 'OT-0004', tipo: 'programada', equipInstaladoId: 'EI-001', clienteId: 'CLI-001',
        descricao: 'Manutenção preventiva mensal — Fevereiro 2026',
        previsaoTempo: 3, periodicidade: 'Mensal', planoId: 'PL-001', tipoTrabalho: 'Sistemático Preventivo', responsavel: 'António Silva',
        maosDeObra: [{ funcao: 'Técnico Sénior', custo: 5000, hora: '08:00' }],
        artigos: [{ artigoId: 'ART-001', descricao: 'Membrana Osmose Inversa 4040', quantidade: 1, preco: 8500 }],
        dataProgInicio: '2026-02-15', dataProgFim: '2026-02-15',
        dataEmissao: '2026-02-15', dataInicio: '2026-02-15', dataFim: '2026-02-15', dataEncerramento: '2026-02-16',
        estado: 'Encerrado',
    },
    {
        id: 'OT-0005', tipo: 'programada', equipInstaladoId: 'EI-005', clienteId: 'CLI-005',
        descricao: 'Manutenção trimestral — reposição de sal e teste de dureza',
        previsaoTempo: 4, periodicidade: 'Trimestral', planoId: 'PL-003', tipoTrabalho: 'Sistemático Preventivo', responsavel: 'Rui Cunha',
        maosDeObra: [{ funcao: 'Chefe de Equipa', custo: 7000, hora: '09:00' }],
        artigos: [{ artigoId: 'ART-005', descricao: 'Sal para Resina 25kg', quantidade: 5, preco: 1200 }],
        dataProgInicio: '2026-03-18', dataProgFim: '2026-03-18',
        estado: 'Programado',
    },
    {
        id: 'OT-0006', tipo: 'pontual', equipInstaladoId: 'EI-006', clienteId: 'CLI-006',
        descricao: 'Montagem e comissionamento — Osmose Inversa Industrial',
        previsaoTempo: 8, tipoTrabalho: 'Montagem / Instalação', responsavel: 'Rui Cunha',
        maosDeObra: [{ funcao: 'Chefe de Equipa', custo: 7000, hora: '08:00' }, { funcao: 'Técnico Júnior', custo: 3000, hora: '08:00' }],
        artigos: [{ artigoId: 'ART-006', descricao: 'O-Ring Kit 100 peças', quantidade: 1, preco: 5600 }],
        dataProgInicio: '2026-01-20', dataProgFim: '2026-01-20',
        dataEmissao: '2026-01-20', dataInicio: '2026-01-20', dataFim: '2026-01-20', dataEncerramento: '2026-01-21',
        estado: 'Encerrado',
    },
    {
        id: 'OT-0007', tipo: 'pontual', equipInstaladoId: 'EI-004', clienteId: 'CLI-004',
        descricao: 'Substituição filtro de carbono — mau cheiro na água',
        previsaoTempo: 2, tipoTrabalho: 'Corretivo', responsavel: 'António Silva',
        maosDeObra: [{ funcao: 'Técnico Sénior', custo: 5000, hora: '14:00' }],
        artigos: [{ artigoId: 'ART-003', descricao: 'Filtro Carvão Activado 20"', quantidade: 1, preco: 3200 }],
        orgao: 'Filtro de Carbono', sintoma: 'Odor na água', causa: 'Filtro saturado',
        dataProgInicio: '2026-03-20',
        estado: 'Programado',
    },
    {
        id: 'OT-0008', tipo: 'pontual', equipInstaladoId: 'EI-003', clienteId: 'CLI-003',
        descricao: 'Verificação pós-reparação — testes finais do sistema',
        previsaoTempo: 2, tipoTrabalho: 'Corretivo', responsavel: 'Gabriel Teixeira',
        maosDeObra: [{ funcao: 'Técnico Júnior', custo: 3000, hora: '10:00' }],
        artigos: [], dataProgInicio: '2026-03-12',
        estado: 'Programado',
    },
];

const INIT_ARTIGOS: Artigo[] = [
    { id: 'ART-001', codigo: 'MEM-RO-4040', descricao: 'Membrana Osmose Inversa 4040',    classe: 'Consumíveis', familia: 'Membranas',    precoUnitario: 8500,  moeda: 'AOA', existencia: 24, nivelMaximo: 40, stockSeguranca: 5,  custoMedio: 7800,  codigoArmazem: 'ARM-01', inativo: false, critico: false },
    { id: 'ART-002', codigo: 'FLT-SED-10',  descricao: 'Filtro Sedimentos 10" 5 micron',  classe: 'Consumíveis', familia: 'Filtros',      precoUnitario: 4500,  moeda: 'AOA', existencia: 3,  nivelMaximo: 30, stockSeguranca: 8,  custoMedio: 4100,  codigoArmazem: 'ARM-01', inativo: false, critico: true  },
    { id: 'ART-003', codigo: 'FLT-CAR-20',  descricao: 'Filtro Carvão Activado 20"',      classe: 'Consumíveis', familia: 'Filtros',      precoUnitario: 3200,  moeda: 'AOA', existencia: 18, nivelMaximo: 25, stockSeguranca: 4,  custoMedio: 2900,  codigoArmazem: 'ARM-01', inativo: false, critico: false },
    { id: 'ART-004', codigo: 'UV-LAMP-25',  descricao: 'Lâmpada UV 25W Germicida',        classe: 'Consumíveis', familia: 'Electricidade',precoUnitario: 12000, moeda: 'AOA', existencia: 7,  nivelMaximo: 15, stockSeguranca: 3,  custoMedio: 11000, codigoArmazem: 'ARM-02', inativo: false, critico: false },
    { id: 'ART-005', codigo: 'SAL-RES-25',  descricao: 'Sal para Resina 25kg',            classe: 'Consumíveis', familia: 'Reagentes',    precoUnitario: 1200,  moeda: 'AOA', existencia: 35, nivelMaximo: 60, stockSeguranca: 10, custoMedio: 1050,  codigoArmazem: 'ARM-01', inativo: false, critico: false },
    { id: 'ART-006', codigo: 'O-RING-K100', descricao: 'O-Ring Kit 100 peças surtidas',   classe: 'Peças',       familia: 'Vedantes',     precoUnitario: 5600,  moeda: 'AOA', existencia: 12, nivelMaximo: 20, stockSeguranca: 3,  custoMedio: 5200,  codigoArmazem: 'ARM-02', inativo: false, critico: false },
];

const INIT_ENCOMENDAS: Encomenda[] = [
    {
        id: 'ENC-001', numero: 'N-000001', fornecedorId: 'FOR-001',
        data: '2026-03-01', dataEntrega: '2026-03-20', condicoesPagamento: '30 Dias',
        responsavel: 'Carla Mendes', moeda: 'AOA', descricao: 'Pedido Compra N.º 0000001',
        estado: 'Aberta',
        linhas: [
            { artigoId: 'ART-001', codigo: 'MEM-RO-4040', descricao: 'Membrana Osmose Inversa 4040', qtdEncomendada: 10, qtdRecebida: 0,  unidade: 'UN', custoUnit: 7800, desconto: 0 },
            { artigoId: 'ART-006', codigo: 'O-RING-K100', descricao: 'O-Ring Kit 100 peças',          qtdEncomendada: 5,  qtdRecebida: 0,  unidade: 'UN', custoUnit: 5200, desconto: 5 },
        ],
    },
    {
        id: 'ENC-002', numero: 'N-000002', fornecedorId: 'FOR-002',
        data: '2026-02-10', dataEntrega: '2026-02-25', condicoesPagamento: '15 Dias',
        responsavel: 'Sofia Gomes', moeda: 'AOA', descricao: 'Pedido Compra N.º 0000002',
        estado: 'Recebida',
        linhas: [
            { artigoId: 'ART-002', codigo: 'FLT-SED-10', descricao: 'Filtro Sedimentos 10"',     qtdEncomendada: 20, qtdRecebida: 20, unidade: 'UN', custoUnit: 4100, desconto: 0 },
            { artigoId: 'ART-003', codigo: 'FLT-CAR-20', descricao: 'Filtro Carvão Activado 20"', qtdEncomendada: 10, qtdRecebida: 10, unidade: 'UN', custoUnit: 2900, desconto: 0 },
        ],
    },
    {
        id: 'ENC-003', numero: 'N-000003', fornecedorId: 'FOR-003',
        data: '2026-03-05', dataEntrega: '2026-03-25', condicoesPagamento: '30 - 30 Dias',
        responsavel: 'Carla Mendes', moeda: 'AOA', descricao: 'Pedido Compra N.º 0000003',
        estado: 'Parcial',
        linhas: [
            { artigoId: 'ART-004', codigo: 'UV-LAMP-25', descricao: 'Lâmpada UV 25W Germicida', qtdEncomendada: 10, qtdRecebida: 4,  unidade: 'UN', custoUnit: 11000, desconto: 0 },
            { artigoId: 'ART-005', codigo: 'SAL-RES-25', descricao: 'Sal para Resina 25kg',      qtdEncomendada: 20, qtdRecebida: 20, unidade: 'UN', custoUnit: 1050,  desconto: 0 },
        ],
    },
];

const INIT_FATURAS: Fatura[] = [
    {
        id: 'FAT-0101', tipoDocumento: 'FAT', otId: 'OT-0001', clienteId: 'CLI-001', dataEmissao: '2026-03-10',
        linhas: [
            { descricao: 'Serviço Preventivo Mensal',      quantidade: 1, precoUnit: 25000 },
            { descricao: 'Membrana Osmose Inversa 4040',   quantidade: 1, precoUnit: 8500  },
            { descricao: 'Filtro Carvão Activado 20"',     quantidade: 2, precoUnit: 3200  },
        ],
        precoServico: 25000, taxaIva: 14, valorSubtotal: 39900, valorIva: 5586, valorTotal: 45486,
        moeda: 'AOA', estado: 'Pendente', nrSerieEquip: 'AQ-OI-0021',
    },
    {
        id: 'FAT-0102', tipoDocumento: 'FAT', otId: 'OT-0003', clienteId: 'CLI-003', dataEmissao: '2026-03-06',
        linhas: [{ descricao: 'Serviço Corretivo — Bomba Alta Pressão', quantidade: 1, precoUnit: 45000 }],
        precoServico: 45000, taxaIva: 14, valorSubtotal: 45000, valorIva: 6300, valorTotal: 51300,
        moeda: 'AOA', estado: 'Paga', nrSerieEquip: 'FX-UF-0014', dataPagamento: '2026-03-07',
    },
    {
        id: 'FAT-0103', tipoDocumento: 'FAT', otId: 'OT-0004', clienteId: 'CLI-001', dataEmissao: '2026-02-16',
        linhas: [
            { descricao: 'Serviço Preventivo Mensal',    quantidade: 1, precoUnit: 25000 },
            { descricao: 'Membrana Osmose Inversa 4040', quantidade: 1, precoUnit: 8500  },
        ],
        precoServico: 25000, taxaIva: 14, valorSubtotal: 33500, valorIva: 4690, valorTotal: 38190,
        moeda: 'AOA', estado: 'Paga', nrSerieEquip: 'AQ-OI-0021', dataPagamento: '2026-02-20',
    },
    {
        id: 'FAT-0104', tipoDocumento: 'FAT', otId: 'OT-0006', clienteId: 'CLI-006', dataEmissao: '2026-01-21',
        linhas: [
            { descricao: 'Serviço Montagem e Comissionamento', quantidade: 1, precoUnit: 85000 },
            { descricao: 'O-Ring Kit 100 peças',               quantidade: 1, precoUnit: 5600  },
        ],
        precoServico: 85000, taxaIva: 14, valorSubtotal: 90600, valorIva: 12684, valorTotal: 103284,
        moeda: 'AOA', estado: 'Paga', nrSerieEquip: 'AQ-OI-0045', dataPagamento: '2026-01-25',
    },
];

/* ══════════════════════════════════════════════════════════════
   CONTEXT DEFINITION
══════════════════════════════════════════════════════════════ */
let otCounter = 9;
const nextOTId = () => `OT-${String(otCounter++).padStart(4, '0')}`;
let fatCounter = 105;
let fpCounter = 1;
const nextDocId = (codigo: string) => {
    if (codigo === 'FP') return `FP-${String(fpCounter++).padStart(4, '0')}`;
    return `FAT-${String(fatCounter++).padStart(4, '0')}`;
};

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
    // Stock
    artigos: Artigo[]; addArtigo: (a: Omit<Artigo, 'id'>) => Artigo; updateArtigo: (id: string, a: Partial<Artigo>) => void; adjustExistencia: (id: string, delta: number) => void;
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

const mkId = (prefix: string, list: { id: string }[]) =>
    `${prefix}-${String(list.length + 1).padStart(3, '0')}`;

export const GlobalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUserState] = useState<CurrentUser | null>({ nome: 'Eurico Sapalo', email: 'admin@aquatex.ao', role: 'Administrador' });
    const setCurrentUser = (u: CurrentUser | null) => setCurrentUserState(u);
    const logout = () => setCurrentUserState(null);
    const [logs, setLogs] = useState<SysLog[]>(INIT_LOGS);
    let logCounter = INIT_LOGS.length + 1;
    const addLog = (l: Omit<SysLog, 'id'>) => {
        const n: SysLog = { ...l, id: `LOG-${String(logCounter++).padStart(3, '0')}` };
        setLogs(p => [n, ...p]);
    };

    const [tiposTrabalho, setTiposTrabalho] = useState(INIT_TIPOS_TRABALHO);
    const [tiposDocumento, setTiposDocumento] = useState(INIT_TIPOS_DOCUMENTO);
    const [funcoesTecnico, setFuncoesTecnico] = useState(INIT_FUNCOES);
    const [moedas, setMoedas] = useState(INIT_MOEDAS);
    const [clientes, setClientes] = useState(INIT_CLIENTES);
    const [tecnicos, setTecnicos] = useState(INIT_TECNICOS);
    const [fornecedores, setFornecedores] = useState(INIT_FORNECEDORES);
    const [modelosEquipamento, setModelosEquipamento] = useState(INIT_MODELOS);
    const [equipInstalados, setEquipInstalados] = useState(INIT_EQUIP_INST);
    const [planos, setPlanos] = useState(INIT_PLANOS);
    const [ordens, setOrdens] = useState(INIT_ORDENS);
    const [artigos, setArtigos] = useState(INIT_ARTIGOS);
    const [encomendas, setEncomendas] = useState(INIT_ENCOMENDAS);
    const [faturas, setFaturas] = useState(INIT_FATURAS);

    const today = () => new Date().toISOString().split('T')[0];

    // System tables
    const addTipoTrabalho = (t: Omit<TipoTrabalho, 'id'>) => setTiposTrabalho(p => [...p, { ...t, id: mkId('TT', p) }]);
    const updateTipoTrabalho = (id: string, t: Partial<TipoTrabalho>) => setTiposTrabalho(p => p.map(x => x.id === id ? { ...x, ...t } : x));
    const removeTipoTrabalho = (id: string) => setTiposTrabalho(p => p.filter(x => x.id !== id));
    const addFuncaoTecnico = (f: Omit<FuncaoTecnico, 'id'>) => setFuncoesTecnico(p => [...p, { ...f, id: mkId('FT', p) }]);
    const updateFuncaoTecnico = (id: string, f: Partial<FuncaoTecnico>) => setFuncoesTecnico(p => p.map(x => x.id === id ? { ...x, ...f } : x));
    const removeFuncaoTecnico = (id: string) => setFuncoesTecnico(p => p.filter(x => x.id !== id));
    const addMoeda = (m: Omit<Moeda, 'id'>) => setMoedas(p => [...p, { ...m, id: mkId('MOE', p) }]);
    const updateMoeda = (id: string, m: Partial<Moeda>) => setMoedas(p => p.map(x => x.id === id ? { ...x, ...m } : x));
    const removeMoeda = (id: string) => setMoedas(p => p.filter(x => x.id !== id));
    const addTipoDocumento = (t: Omit<TipoDocumento, 'id'>) => setTiposDocumento(p => [...p, { ...t, id: mkId('TD', p) }]);
    const updateTipoDocumento = (id: string, t: Partial<TipoDocumento>) => setTiposDocumento(p => p.map(x => x.id === id ? { ...x, ...t } : x));
    const removeTipoDocumento = (id: string) => setTiposDocumento(p => p.filter(x => x.id !== id));

    // Entities
    const addCliente = (c: Omit<Cliente, 'id'>) => { const n = { ...c, id: mkId('CLI', clientes) }; setClientes(p => [...p, n]); return n; };
    const updateCliente = (id: string, c: Partial<Cliente>) => setClientes(p => p.map(x => x.id === id ? { ...x, ...c } : x));
    const addTecnico = (t: Omit<Tecnico, 'id'>) => { const n = { ...t, id: mkId('TEC', tecnicos) }; setTecnicos(p => [...p, n]); return n; };
    const updateTecnico = (id: string, t: Partial<Tecnico>) => setTecnicos(p => p.map(x => x.id === id ? { ...x, ...t } : x));
    const addFornecedor = (f: Omit<Fornecedor, 'id'>) => { const n = { ...f, id: mkId('FOR', fornecedores) }; setFornecedores(p => [...p, n]); return n; };
    const updateFornecedor = (id: string, f: Partial<Fornecedor>) => setFornecedores(p => p.map(x => x.id === id ? { ...x, ...f } : x));

    // Equipment
    const addModelo = (m: Omit<ModeloEquipamento, 'id'>) => { const n = { ...m, id: mkId('MOD', modelosEquipamento) }; setModelosEquipamento(p => [...p, n]); return n; };
    const updateModelo = (id: string, m: Partial<ModeloEquipamento>) => setModelosEquipamento(p => p.map(x => x.id === id ? { ...x, ...m } : x));
    const addEquipInstalado = (e: Omit<EquipInstalado, 'id'>) => { const n = { ...e, id: mkId('EI', equipInstalados) }; setEquipInstalados(p => [...p, n]); return n; };
    const updateEquipInstalado = (id: string, e: Partial<EquipInstalado>) => setEquipInstalados(p => p.map(x => x.id === id ? { ...x, ...e } : x));

    // Plans
    const addPlano = (p: Omit<PlanoManutencao, 'id'>) => { const n = { ...p, id: mkId('PL', planos) }; setPlanos(prev => [...prev, n]); return n; };
    const updatePlano = (id: string, p: Partial<PlanoManutencao>) => setPlanos(prev => prev.map(x => x.id === id ? { ...x, ...p } : x));
    const removePlano = (id: string) => setPlanos(prev => prev.filter(x => x.id !== id));

    // Work Orders
    const addOrdem = (o: Omit<OrdemTrabalho, 'id'>) => { const n = { ...o, id: nextOTId() }; setOrdens(p => [...p, n]); return n; };
    const updateOrdem = (id: string, o: Partial<OrdemTrabalho>) => setOrdens(p => p.map(x => x.id === id ? { ...x, ...o } : x));
    const removeOrdem = (id: string) => setOrdens(p => p.filter(x => x.id !== id));
    const emitirOT = (id: string, dataEmissao?: string, dataInicio?: string) =>
        updateOrdem(id, { estado: 'Em curso', dataEmissao: dataEmissao ?? today(), dataInicio: dataInicio ?? today() });
    const terminarOT = (id: string, dataFim?: string) => {
        const ot = ordens.find(o => o.id === id);
        updateOrdem(id, { estado: 'Terminado', dataFim: dataFim ?? today() });
        if (ot?.periodicidade && ot.periodicidade !== 'Única') {
            const nextDate = calcNextDate(ot.dataProgInicio ?? today(), ot.periodicidade);
            addOrdem({ ...ot, estado: 'Programado', dataProgInicio: nextDate, dataProgFim: nextDate, dataEmissao: undefined, dataInicio: undefined, dataFim: undefined, dataEncerramento: undefined });
        }
    };
    const encerrarOT = (id: string, dataEncerramento?: string) =>
        updateOrdem(id, { estado: 'Encerrado', dataEncerramento: dataEncerramento ?? today() });

    // Stock
    const addArtigo = (a: Omit<Artigo, 'id'>) => { const n = { ...a, id: mkId('ART', artigos) }; setArtigos(p => [...p, n]); return n; };
    const updateArtigo = (id: string, a: Partial<Artigo>) => setArtigos(p => p.map(x => x.id === id ? { ...x, ...a } : x));
    const adjustExistencia = (id: string, delta: number) =>
        setArtigos(p => p.map(x => x.id === id ? { ...x, existencia: Math.max(0, x.existencia + delta) } : x));

    // Purchases
    const addEncomenda = (e: Omit<Encomenda, 'id'>) => { const n = { ...e, id: mkId('ENC', encomendas) }; setEncomendas(p => [...p, n]); return n; };
    const updateEncomenda = (id: string, e: Partial<Encomenda>) => setEncomendas(p => p.map(x => x.id === id ? { ...x, ...e } : x));
    const receberLinhas = (encId: string, recebidas: { artigoId: string; qtd: number }[]) => {
        setEncomendas(p => p.map(enc => {
            if (enc.id !== encId) return enc;
            const novasLinhas = enc.linhas.map(l => {
                const rec = recebidas.find(r => r.artigoId === l.artigoId);
                return rec ? { ...l, qtdRecebida: Math.min(l.qtdEncomendada, l.qtdRecebida + rec.qtd) } : l;
            });
            const totalEnc = novasLinhas.reduce((s, l) => s + l.qtdEncomendada, 0);
            const totalRec = novasLinhas.reduce((s, l) => s + l.qtdRecebida, 0);
            const estado: EncomendaEstado = totalRec >= totalEnc ? 'Recebida' : totalRec > 0 ? 'Parcial' : enc.estado;
            return { ...enc, linhas: novasLinhas, estado };
        }));
        recebidas.forEach(r => adjustExistencia(r.artigoId, r.qtd));
    };

    // Invoices
    const addFatura = (f: Omit<Fatura, 'id'>) => { const n = { ...f, id: nextDocId(f.tipoDocumento) }; setFaturas(p => [...p, n]); return n; };
    const updateFatura = (id: string, f: Partial<Fatura>) => setFaturas(p => p.map(x => x.id === id ? { ...x, ...f } : x));

    return (
        <GlobalContext.Provider value={{
            currentUser, setCurrentUser, logout,
            logs, addLog,
            tiposTrabalho, addTipoTrabalho, updateTipoTrabalho, removeTipoTrabalho,
            funcoesTecnico, addFuncaoTecnico, updateFuncaoTecnico, removeFuncaoTecnico,
            moedas, addMoeda, updateMoeda, removeMoeda,
            tiposDocumento, addTipoDocumento, updateTipoDocumento, removeTipoDocumento,
            paises: INIT_PAISES, provincias: INIT_PROVINCIAS, municipios: INIT_MUNICIPIOS,
            clientes, addCliente, updateCliente,
            tecnicos, addTecnico, updateTecnico,
            fornecedores, addFornecedor, updateFornecedor,
            modelosEquipamento, addModelo, updateModelo,
            equipInstalados, addEquipInstalado, updateEquipInstalado,
            planos, addPlano, updatePlano, removePlano,
            ordens, addOrdem, updateOrdem, removeOrdem, emitirOT, terminarOT, encerrarOT,
            artigos, addArtigo, updateArtigo, adjustExistencia,
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
