import React, { useState } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import { Search, Plus, Filter, AlertTriangle, Package } from 'lucide-react';

type ItemTipo = 'maquina' | 'filtro' | 'peca' | 'filtro_maquina';
interface StockItem {
    id: string; nome: string; tipo: ItemTipo; marca: string; modelo: string;
    stock: number; stockMin: number; preco: number;
}

interface MaquinaInstalada {
    id: string; cliente: string; modelo: string; serie: string;
    dataInstalacao: string; proximaMaintencao: string; estado: 'Ativa' | 'Com problema' | 'Desativada';
}

const MOCK_STOCK: StockItem[] = [
    { id: 'EQ-0001', nome: 'Purificador Neutratech Pro 300', tipo: 'maquina', marca: 'Neutratech', modelo: 'NTP-300', stock: 4, stockMin: 2, preco: 450000 },
    { id: 'EQ-0002', nome: 'Purificador Neutratech Elite 500', tipo: 'maquina', marca: 'Neutratech', modelo: 'NTE-500', stock: 1, stockMin: 2, preco: 650000 },
    { id: 'EQ-0003', nome: 'Filtro AR G010 Standard', tipo: 'filtro', marca: 'AquaFilter', modelo: 'G010-STD', stock: 2, stockMin: 5, preco: 8500 },
    { id: 'EQ-0004', nome: 'Filtro para Líquidos FL200', tipo: 'filtro', marca: 'AquaFilter', modelo: 'FL-200', stock: 8, stockMin: 3, preco: 12000 },
    { id: 'EQ-0005', nome: 'Membrana RO Neutratech', tipo: 'filtro_maquina', marca: 'Neutratech', modelo: 'MEM-RO-NT', stock: 3, stockMin: 2, preco: 28000 },
    { id: 'EQ-0006', nome: 'O-Ring Conjunto 12pcs', tipo: 'peca', marca: 'Genérico', modelo: 'ORG-012', stock: 18, stockMin: 5, preco: 2000 },
    { id: 'EQ-0007', nome: 'Bomba de Pressão NT-P1', tipo: 'peca', marca: 'Neutratech', modelo: 'NT-P1', stock: 2, stockMin: 2, preco: 45000 },
    { id: 'EQ-0008', nome: 'Controlador Digital CDX', tipo: 'peca', marca: 'Neutratech', modelo: 'CDX-v2', stock: 0, stockMin: 1, preco: 32000 },
    { id: 'EQ-0009', nome: 'Filtro Carvão Ativado FCA-50', tipo: 'filtro_maquina', marca: 'AquaFilter', modelo: 'FCA-50', stock: 12, stockMin: 5, preco: 6500 },
    { id: 'EQ-0010', nome: 'Kit Manutenção Preventiva', tipo: 'peca', marca: 'Neutratech', modelo: 'KMP-001', stock: 5, stockMin: 3, preco: 35000 },
];

const MOCK_MAQUINAS: MaquinaInstalada[] = [
    { id: 'MI-0001', cliente: 'Hotel Marina Palace', modelo: 'NTP-300', serie: 'NTP-300-2023-001', dataInstalacao: '15/03/2023', proximaMaintencao: '09/03/2026', estado: 'Ativa' },
    { id: 'MI-0002', cliente: 'Hotel Marina Palace', modelo: 'NTE-500', serie: 'NTE-500-2023-004', dataInstalacao: '15/03/2023', proximaMaintencao: '15/09/2025', estado: 'Com problema' },
    { id: 'MI-0003', cliente: 'Clínica São João', modelo: 'NTP-300', serie: 'NTP-300-2024-012', dataInstalacao: '10/09/2024', proximaMaintencao: '10/03/2025', estado: 'Ativa' },
    { id: 'MI-0004', cliente: 'GlobalTrade SA', modelo: 'NTE-500', serie: 'NTE-500-2024-008', dataInstalacao: '22/04/2024', proximaMaintencao: '22/10/2025', estado: 'Ativa' },
    { id: 'MI-0005', cliente: 'MINSA — Dir. Luanda', modelo: 'NTP-300', serie: 'NTP-300-2022-055', dataInstalacao: '01/10/2022', proximaMaintencao: '01/04/2026', estado: 'Ativa' },
];

const TIPO_LABEL: Record<ItemTipo, string> = {
    maquina: 'Máquina', filtro: 'Filtro', peca: 'Peça', filtro_maquina: 'Filtro NT',
};

const TIPO_BADGE: Record<ItemTipo, string> = {
    maquina: 'tbadge tbadge-admin', filtro: 'tbadge tbadge-suporte',
    peca: 'tbadge tbadge-vendedor', filtro_maquina: 'tbadge tbadge-campo',
};

const ESTADO_DOT: Record<MaquinaInstalada['estado'], string> = {
    'Ativa': 'dot-green', 'Com problema': 'dot-orange', 'Desativada': 'dot-gray',
};

const StockPage: React.FC = () => {
    const [tab, setTab] = useState<'catalogo' | 'parque'>('catalogo');
    const [search, setSearch] = useState('');
    const [filterTipo, setFilterTipo] = useState('');

    const lowStock = MOCK_STOCK.filter(i => i.stock <= i.stockMin);
    const outStock = MOCK_STOCK.filter(i => i.stock === 0);

    const filteredStock = MOCK_STOCK.filter(i => {
        const q = search.toLowerCase();
        return (!q || i.nome.toLowerCase().includes(q) || i.id.toLowerCase().includes(q))
            && (!filterTipo || i.tipo === filterTipo);
    });

    const filteredMaquinas = MOCK_MAQUINAS.filter(m => {
        const q = search.toLowerCase();
        return !q || m.cliente.toLowerCase().includes(q) || m.serie.toLowerCase().includes(q);
    });

    return (
        <AppLayout>
            <ActionBar title="Stock & Catálogo" breadcrumb="AQUATEX SGI · Stock">
                <div className="actionbar-sep" />
                <button className={`abtn ${tab === 'catalogo' ? 'abtn-primary' : 'abtn-secondary'}`} onClick={() => setTab('catalogo')} type="button">
                    <Package size={13} /> Catálogo / Stock
                </button>
                <button className={`abtn ${tab === 'parque' ? 'abtn-primary' : 'abtn-secondary'}`} onClick={() => setTab('parque')} type="button">
                    Parque de Máquinas
                </button>
                <div className="actionbar-spacer" />
                <button className="abtn abtn-primary" type="button"><Plus size={13} /> {tab === 'catalogo' ? 'Novo Item' : 'Registar Máquina'}</button>
            </ActionBar>

            <div className="page-content">

                {/* Alertas stock */}
                {tab === 'catalogo' && lowStock.length > 0 && (
                    <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {outStock.length > 0 && (
                            <div style={{ padding: '8px 14px', background: 'var(--red-bg)', border: '1px solid #FFCDD2', borderRadius: 4, fontSize: '0.79rem', color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <AlertTriangle size={13} /> {outStock.length} item(ns) sem stock: {outStock.map(i => i.nome).join(', ')}
                            </div>
                        )}
                        {lowStock.filter(i => i.stock > 0).length > 0 && (
                            <div style={{ padding: '8px 14px', background: 'var(--orange-bg)', border: '1px solid #FFCC80', borderRadius: 4, fontSize: '0.79rem', color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <AlertTriangle size={13} />{lowStock.filter(i => i.stock > 0).length} item(ns) abaixo do stock mínimo
                            </div>
                        )}
                    </div>
                )}

                {/* Stats */}
                <div className="stats-row">
                    {(tab === 'catalogo' ? [
                        { label: 'Total Referências', value: MOCK_STOCK.length, cls: '' },
                        { label: 'Sem Stock', value: outStock.length, cls: 'orange' },
                        { label: 'Stock Baixo', value: lowStock.filter(i => i.stock > 0).length, cls: 'muted' },
                        { label: 'Máquinas em Catálogo', value: MOCK_STOCK.filter(i => i.tipo === 'maquina').length, cls: 'blue' },
                    ] : [
                        { label: 'Máquinas Instaladas', value: MOCK_MAQUINAS.length, cls: '' },
                        { label: 'Ativas', value: MOCK_MAQUINAS.filter(m => m.estado === 'Ativa').length, cls: 'green' },
                        { label: 'Com problema', value: MOCK_MAQUINAS.filter(m => m.estado === 'Com problema').length, cls: 'orange' },
                        { label: 'Próx. Manutenção ≤ 30d', value: 3, cls: 'blue' },
                    ]).map(s => (
                        <div key={s.label} className="stat-card">
                            <span className="stat-label">{s.label}</span>
                            <span className={`stat-value ${s.cls}`}>{s.value}</span>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="filters-bar">
                    <div className="search-wrap">
                        <Search className="search-icon" />
                        <input className="search-input" placeholder={tab === 'catalogo' ? 'Pesquisar produto...' : 'Pesquisar por cliente ou série...'} value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    {tab === 'catalogo' && (
                        <select className="filter-select" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
                            <option value="">Todos os Tipos</option>
                            <option value="maquina">Máquina</option>
                            <option value="filtro">Filtro</option>
                            <option value="filtro_maquina">Filtro NT</option>
                            <option value="peca">Peça</option>
                        </select>
                    )}
                    {(search || filterTipo) && <button className="abtn abtn-secondary" onClick={() => { setSearch(''); setFilterTipo(''); }}><Filter size={12} /> Limpar</button>}
                </div>

                {/* CATÁLOGO table */}
                {tab === 'catalogo' && (
                    <div className="table-container">
                        <div className="table-scroll">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 20 }} />
                                        <th>Código</th><th>Nome</th><th>Tipo</th><th>Marca</th><th>Modelo</th>
                                        <th style={{ textAlign: 'center' }}>Stock</th>
                                        <th style={{ textAlign: 'center' }}>Mínimo</th>
                                        <th style={{ textAlign: 'right' }}>Preço (Kz)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStock.map(i => (
                                        <tr key={i.id} style={{ background: i.stock === 0 ? 'var(--red-bg)' : i.stock <= i.stockMin ? 'var(--orange-bg)' : undefined }}>
                                            <td style={{ paddingLeft: 10 }}>
                                                <span className={`dot ${i.stock === 0 ? 'dot-red' : i.stock <= i.stockMin ? 'dot-orange' : 'dot-green'}`} />
                                            </td>
                                            <td><span className="td-link">{i.id}</span></td>
                                            <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{i.nome}</td>
                                            <td><span className={TIPO_BADGE[i.tipo]}>{TIPO_LABEL[i.tipo]}</span></td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{i.marca}</td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{i.modelo}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 700, color: i.stock === 0 ? 'var(--red)' : i.stock <= i.stockMin ? 'var(--orange)' : 'var(--green)' }}>{i.stock}</td>
                                            <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{i.stockMin}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{i.preco.toLocaleString('pt-PT')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="table-count">{filteredStock.length} referências</div>
                    </div>
                )}

                {/* PARQUE table */}
                {tab === 'parque' && (
                    <div className="table-container">
                        <div className="table-scroll">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 20 }} />
                                        <th>ID</th><th>Cliente</th><th>Modelo</th><th>Nº Série</th>
                                        <th>Instalação</th><th>Próx. Manutenção</th><th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMaquinas.map(m => (
                                        <tr key={m.id}>
                                            <td style={{ paddingLeft: 10 }}><span className={`dot ${ESTADO_DOT[m.estado]}`} /></td>
                                            <td><span className="td-link">{m.id}</span></td>
                                            <td style={{ fontWeight: 600 }}>{m.cliente}</td>
                                            <td style={{ fontSize: '0.78rem' }}>{m.modelo}</td>
                                            <td style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{m.serie}</td>
                                            <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{m.dataInstalacao}</td>
                                            <td style={{ fontSize: '0.76rem', fontWeight: 600, color: m.estado === 'Com problema' ? 'var(--orange)' : 'var(--text-primary)' }}>{m.proximaMaintencao}</td>
                                            <td>
                                                <div className="status-dot">
                                                    <span className={`dot ${ESTADO_DOT[m.estado]}`} />
                                                    <span style={{ fontSize: '0.78rem' }}>{m.estado}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="table-count">{filteredMaquinas.length} máquinas instaladas</div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
};

export default StockPage;
