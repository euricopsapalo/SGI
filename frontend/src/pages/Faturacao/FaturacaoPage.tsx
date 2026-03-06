import React, { useState } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import { Search, FileText, Download, Plus, Filter } from 'lucide-react';

type FaturaEstado = 'Paga' | 'Pendente' | 'Anulada';

interface Fatura {
    id: string; os: string; cliente: string; tipo: string;
    dataEmissao: string; valorTotal: number; estado: FaturaEstado;
}

const MOCK_FATURAS: Fatura[] = [
    { id: 'FAT-0101', os: 'OS-0806', cliente: 'Clínica São João', tipo: 'Preventiva', dataEmissao: '05/03/2026', valorTotal: 85000, estado: 'Paga' },
    { id: 'FAT-0102', os: 'OS-0805', cliente: 'GlobalTrade SA', tipo: 'Montagem', dataEmissao: '05/03/2026', valorTotal: 650000, estado: 'Pendente' },
    { id: 'FAT-0103', os: 'OS-0803', cliente: 'Farmácia Saúde +', tipo: 'Corretiva', dataEmissao: '03/03/2026', valorTotal: 142000, estado: 'Paga' },
    { id: 'FAT-0104', os: 'OS-0802', cliente: 'Residencial Vista Mar', tipo: 'Preventiva', dataEmissao: '02/03/2026', valorTotal: 195000, estado: 'Paga' },
    { id: 'FAT-0105', os: 'OS-0801', cliente: 'MINSA — Dir. Luanda', tipo: 'Preventiva', dataEmissao: '01/03/2026', valorTotal: 85000, estado: 'Pendente' },
    { id: 'FAT-0106', os: 'OS-0799', cliente: 'Petro Servicing Angola', tipo: 'Montagem', dataEmissao: '27/02/2026', valorTotal: 1300000, estado: 'Paga' },
    { id: 'FAT-0107', os: 'OS-0798', cliente: 'Hotel Marina Palace', tipo: 'Preventiva', dataEmissao: '25/02/2026', valorTotal: 425000, estado: 'Paga' },
    { id: 'FAT-0108', os: 'OS-0795', cliente: 'MINSA — Dir. Luanda', tipo: 'Corretiva', dataEmissao: '20/02/2026', valorTotal: 230000, estado: 'Anulada' },
    { id: 'FAT-0109', os: 'OS-0793', cliente: 'Empresa Alpha, LDA', tipo: 'Preventiva', dataEmissao: '18/02/2026', valorTotal: 255000, estado: 'Paga' },
    { id: 'FAT-0110', os: 'OS-0791', cliente: 'Supermercado Maxi', tipo: 'Preventiva', dataEmissao: '15/02/2026', valorTotal: 85000, estado: 'Pendente' },
];

const ESTADO_DOT: Record<FaturaEstado, string> = {
    'Paga': 'dot-green', 'Pendente': 'dot-orange', 'Anulada': 'dot-gray',
};

const ESTADO_BADGE: Record<FaturaEstado, string> = {
    'Paga': 'tbadge tbadge-campo', 'Pendente': 'tbadge tbadge-vendedor', 'Anulada': 'tbadge tbadge-inactive',
};

const FaturacaoPage: React.FC = () => {
    const [search, setSearch] = useState('');
    const [filterEstado, setFilterEstado] = useState('');

    const filtered = MOCK_FATURAS.filter(f => {
        const q = search.toLowerCase();
        return (!q || f.id.toLowerCase().includes(q) || f.cliente.toLowerCase().includes(q) || f.os.toLowerCase().includes(q))
            && (!filterEstado || f.estado === filterEstado);
    });

    const totalPago = filtered.filter(f => f.estado === 'Paga').reduce((s, f) => s + f.valorTotal, 0);
    const totalPendente = filtered.filter(f => f.estado === 'Pendente').reduce((s, f) => s + f.valorTotal, 0);

    return (
        <AppLayout>
            <ActionBar title="Faturação" breadcrumb="AQUATEX SGI · Faturação">
                <div className="actionbar-spacer" />
                <button className="abtn abtn-primary" type="button"><Plus size={13} /> Emitir Fatura</button>
                <div className="actionbar-sep" />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{filtered.length} registos</span>
            </ActionBar>

            <div className="page-content">
                {/* Stats */}
                <div className="stats-row">
                    {[
                        { label: 'Total Faturas', value: filtered.length },
                        { label: 'Pagas', value: filtered.filter(f => f.estado === 'Paga').length, cls: 'green' },
                        { label: 'Pendentes', value: filtered.filter(f => f.estado === 'Pendente').length, cls: 'orange' },
                        { label: 'Total Cobrado', value: `Kz ${(totalPago / 1000).toFixed(0)}K`, cls: 'blue', sm: true },
                        { label: 'Por Cobrar', value: `Kz ${(totalPendente / 1000).toFixed(0)}K`, cls: 'muted', sm: true },
                    ].map(s => (
                        <div key={s.label} className="stat-card">
                            <span className="stat-label">{s.label}</span>
                            <span className={`stat-value ${(s as any).cls || ''}`} style={(s as any).sm ? { fontSize: '1rem' } : {}}>{s.value}</span>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="filters-bar">
                    <div className="search-wrap">
                        <Search className="search-icon" />
                        <input className="search-input" placeholder="Pesquisar por código, OS ou cliente..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select className="filter-select" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
                        <option value="">Todos os Estados</option>
                        <option value="Paga">Paga</option>
                        <option value="Pendente">Pendente</option>
                        <option value="Anulada">Anulada</option>
                    </select>
                    {(search || filterEstado) && <button className="abtn abtn-secondary" onClick={() => { setSearch(''); setFilterEstado(''); }}><Filter size={12} /> Limpar</button>}
                </div>

                {/* Table */}
                <div className="table-container">
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 20 }} />
                                    <th>Nº Fatura</th>
                                    <th>OS</th>
                                    <th>Cliente</th>
                                    <th>Tipo</th>
                                    <th>Data Emissão</th>
                                    <th style={{ textAlign: 'right' }}>Valor (Kz)</th>
                                    <th>Estado</th>
                                    <th style={{ width: 70 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr><td colSpan={9}><div className="empty-state">Nenhuma fatura encontrada.</div></td></tr>
                                )}
                                {filtered.map(f => (
                                    <tr key={f.id}>
                                        <td style={{ paddingLeft: 10 }}><span className={`dot ${ESTADO_DOT[f.estado]}`} /></td>
                                        <td><span className="td-link">{f.id}</span></td>
                                        <td><span className="td-link">{f.os}</span></td>
                                        <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{f.cliente}</td>
                                        <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{f.tipo}</td>
                                        <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{f.dataEmissao}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{f.valorTotal.toLocaleString('pt-PT')}</td>
                                        <td><span className={ESTADO_BADGE[f.estado]}>{f.estado}</span></td>
                                        <td>
                                            <div className="row-actions">
                                                <button className="icon-btn" title="Ver fatura"><FileText size={12} /></button>
                                                <button className="icon-btn" title="Download PDF"><Download size={12} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="table-count" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{filtered.length} fatura(s)</span>
                        <span style={{ fontWeight: 700 }}>Total cobrado: <span style={{ color: 'var(--green)' }}>Kz {totalPago.toLocaleString('pt-PT')}</span> · Por cobrar: <span style={{ color: 'var(--orange)' }}>Kz {totalPendente.toLocaleString('pt-PT')}</span></span>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};

export default FaturacaoPage;
