import React, { useState } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import { Search, Plus, Pencil, Eye, Phone, Mail, MapPin, Building2, X } from 'lucide-react';

export interface Cliente {
    id: number;
    codigo: string;
    nome: string;
    nif: string;
    email: string;
    telefone: string;
    morada: string;
    cidade: string;
    maquinas: number;
    osTotal: number;
    dataCriacao: string;
}

const MOCK_CLIENTES: Cliente[] = [
    { id: 1, codigo: 'CLI-0001', nome: 'Empresa Alpha, LDA', nif: '5400112233', email: 'geral@alpha.ao', telefone: '+244 222 300 100', morada: 'Rua da Samba, 45', cidade: 'Luanda', maquinas: 3, osTotal: 12, dataCriacao: '01/01/2024' },
    { id: 2, codigo: 'CLI-0002', nome: 'Hotel Marina Palace', nif: '5400223344', email: 'manut@marinapalace.ao', telefone: '+244 222 400 200', morada: 'Av. Marginal, 12', cidade: 'Luanda', maquinas: 5, osTotal: 28, dataCriacao: '15/02/2024' },
    { id: 3, codigo: 'CLI-0003', nome: 'Clínica São João', nif: '5400334455', email: 'admin@csj.ao', telefone: '+244 222 500 300', morada: 'Rua da Missão, 8', cidade: 'Luanda', maquinas: 2, osTotal: 9, dataCriacao: '10/03/2024' },
    { id: 4, codigo: 'CLI-0004', nome: 'GlobalTrade SA', nif: '5400445566', email: 'op@globaltrade.ao', telefone: '+244 923 100 400', morada: 'Zona Industrial 3, Bloco C', cidade: 'Viana', maquinas: 4, osTotal: 17, dataCriacao: '22/04/2024' },
    { id: 5, codigo: 'CLI-0005', nome: 'Escola da Nação', nif: '5400556677', email: 'manut@enacao.ao', telefone: '+244 912 500 500', morada: 'Av. Lenine, 200', cidade: 'Luanda', maquinas: 1, osTotal: 4, dataCriacao: '05/06/2024' },
    { id: 6, codigo: 'CLI-0006', nome: 'Farmácia Saúde +', nif: '5400667788', email: 'saude@farmaciap.ao', telefone: '+244 935 600 600', morada: 'Rua Amílcar Cabral, 77', cidade: 'Luanda', maquinas: 2, osTotal: 8, dataCriacao: '18/07/2024' },
    { id: 7, codigo: 'CLI-0007', nome: 'Residencial Vista Mar', nif: '5400778899', email: 'maint@vistamar.ao', telefone: '+244 946 700 700', morada: 'Ilha do Cabo, Lote 9', cidade: 'Luanda', maquinas: 6, osTotal: 31, dataCriacao: '30/08/2024' },
    { id: 8, codigo: 'CLI-0008', nome: 'Supermercado Maxi', nif: '5400889900', email: 'tec@maxi.ao', telefone: '+244 921 800 800', morada: 'Estrada de Catete, km 5', cidade: 'Cacuaco', maquinas: 3, osTotal: 11, dataCriacao: '12/09/2024' },
    { id: 9, codigo: 'CLI-0009', nome: 'MINSA — Direcção Luanda', nif: '5400990011', email: 'tec@minsa.gov.ao', telefone: '+244 222 900 900', morada: 'Av. Hoji Ya Henda, 1', cidade: 'Luanda', maquinas: 8, osTotal: 45, dataCriacao: '01/10/2024' },
    { id: 10, codigo: 'CLI-0010', nome: 'Petro Servicing Angola', nif: '5401101122', email: 'manut@petroservice.ao', telefone: '+244 923 010 010', morada: 'Zona Industrial Viana', cidade: 'Viana', maquinas: 7, osTotal: 33, dataCriacao: '15/11/2024' },
];

/* Detail Modal */
const ClienteDetail: React.FC<{ cliente: Cliente; onClose: () => void }> = ({ cliente, onClose }) => (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
                <h3 className="modal-title">{cliente.codigo} — {cliente.nome}</h3>
                <button className="modal-close" onClick={onClose}><X size={13} /></button>
            </div>
            <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="form-group"><label className="form-label">NIF</label><div style={{ padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 3, fontSize: '0.82rem' }}>{cliente.nif}</div></div>
                    <div className="form-group"><label className="form-label">Cidade</label><div style={{ padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 3, fontSize: '0.82rem' }}>{cliente.cidade}</div></div>
                </div>
                <div className="form-group">
                    <label className="form-label">Morada</label>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        <MapPin size={13} /> {cliente.morada}, {cliente.cidade}
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="form-group">
                        <label className="form-label">Telefone</label>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            <Phone size={13} /> {cliente.telefone}
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-link)' }}>
                            <Mail size={13} /> {cliente.email}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 8 }}>
                    {[
                        { label: 'Máquinas Instaladas', value: cliente.maquinas, color: 'var(--blue)' },
                        { label: 'OS Realizadas', value: cliente.osTotal, color: 'var(--green)' },
                        { label: 'Cliente desde', value: cliente.dataCriacao, color: 'var(--text-secondary)', fontSize: '0.78rem' },
                    ].map(s => (
                        <div key={s.label} className="panel" style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <div className="stat-label">{s.label}</div>
                            <div style={{ fontWeight: 800, fontSize: (s as any).fontSize || '1.3rem', color: s.color, marginTop: 2 }}>{s.value}</div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="modal-footer">
                <button className="abtn abtn-secondary" onClick={onClose}>Fechar</button>
                <button className="abtn abtn-primary"><Pencil size={12} /> Editar</button>
            </div>
        </div>
    </div>
);

/* ════════════ MAIN PAGE ════════════ */
const ClientesPage: React.FC = () => {
    const [search, setSearch] = useState('');
    const [detail, setDetail] = useState<Cliente | null>(null);

    const filtered = MOCK_CLIENTES.filter(c => {
        const q = search.toLowerCase();
        return !q || c.nome.toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q) || c.nif.includes(q);
    });

    return (
        <AppLayout>
            <ActionBar title="Gestão de Clientes" breadcrumb="AQUATEX SGI · Clientes">
                <div className="actionbar-spacer" />
                <button className="abtn abtn-primary" type="button"><Plus size={13} /> Novo Cliente</button>
                <div className="actionbar-sep" />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{filtered.length} registos</span>
            </ActionBar>

            <div className="page-content">
                {/* Stats */}
                <div className="stats-row">
                    {[
                        { label: 'Total Clientes', value: MOCK_CLIENTES.length },
                        { label: 'Máquinas Instaladas', value: MOCK_CLIENTES.reduce((s, c) => s + c.maquinas, 0) },
                        { label: 'OS Realizadas (total)', value: MOCK_CLIENTES.reduce((s, c) => s + c.osTotal, 0) },
                    ].map(s => (
                        <div key={s.label} className="stat-card">
                            <span className="stat-label">{s.label}</span>
                            <span className="stat-value blue">{s.value}</span>
                        </div>
                    ))}
                </div>

                {/* Filter */}
                <div className="filters-bar">
                    <div className="search-wrap">
                        <Search className="search-icon" />
                        <input className="search-input" placeholder="Pesquisar por nome, código ou NIF..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>

                {/* Table */}
                <div className="table-container">
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Código</th>
                                    <th>Nome</th>
                                    <th>NIF</th>
                                    <th>Cidade</th>
                                    <th>Telefone</th>
                                    <th style={{ textAlign: 'center' }}>Máquinas</th>
                                    <th style={{ textAlign: 'center' }}>OS</th>
                                    <th>Desde</th>
                                    <th style={{ width: 60 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(c => (
                                    <tr key={c.id}>
                                        <td><span className="td-link" onClick={() => setDetail(c)}>{c.codigo}</span></td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Building2 size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                <span style={{ fontWeight: 600 }}>{c.nome}</span>
                                            </div>
                                        </td>
                                        <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{c.nif}</td>
                                        <td style={{ fontSize: '0.78rem' }}>{c.cidade}</td>
                                        <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{c.telefone}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--blue)' }}>{c.maquinas}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--green)' }}>{c.osTotal}</td>
                                        <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{c.dataCriacao}</td>
                                        <td>
                                            <div className="row-actions">
                                                <button className="icon-btn" title="Ver detalhe" onClick={() => setDetail(c)}><Eye size={12} /></button>
                                                <button className="icon-btn" title="Editar"><Pencil size={12} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="table-count">{filtered.length} cliente(s)</div>
                </div>
            </div>

            {detail && <ClienteDetail cliente={detail} onClose={() => setDetail(null)} />}
        </AppLayout>
    );
};

export default ClientesPage;
