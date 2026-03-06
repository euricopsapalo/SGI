import React, { useState } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import { Search, Plus, Filter, Pencil, Eye, FileText } from 'lucide-react';

type OSEstado = 'Aberta' | 'Em execução' | 'Concluída' | 'Cancelada';
type OSTipo = 'Montagem' | 'Preventiva' | 'Corretiva' | 'Remota';

interface OS {
    id: string; tipo: OSTipo; cliente: string; maquina: string;
    tecnico: string; suporte: string; dataAgendamento: string;
    estado: OSEstado; anomalia: string;
}

const MOCK_OS: OS[] = [
    { id: 'OS-0808', tipo: 'Preventiva', cliente: 'Hotel Marina Palace', maquina: 'NTR-0023', tecnico: 'Bruno Cunha', suporte: 'Carla Mendes', dataAgendamento: '06/03/2026 09:00', estado: 'Em execução', anomalia: 'Manutenção semestral' },
    { id: 'OS-0807', tipo: 'Corretiva', cliente: 'Empresa Alpha, LDA', maquina: 'WP-0041', tecnico: '—', suporte: 'Carla Mendes', dataAgendamento: '06/03/2026 14:00', estado: 'Aberta', anomalia: 'Gotejamento anormal' },
    { id: 'OS-0806', tipo: 'Preventiva', cliente: 'Clínica São João', maquina: 'NTR-0011', tecnico: 'Fátima Rodrigues', suporte: 'Ana Ferreira', dataAgendamento: '05/03/2026 10:00', estado: 'Concluída', anomalia: 'Manutenção semestral' },
    { id: 'OS-0805', tipo: 'Montagem', cliente: 'GlobalTrade SA', maquina: 'NTR-NOVO', tecnico: 'Joana Tavares', suporte: 'Ana Ferreira', dataAgendamento: '05/03/2026 08:00', estado: 'Concluída', anomalia: 'Instalação novo equipamento' },
    { id: 'OS-0804', tipo: 'Remota', cliente: 'Escola da Nação', maquina: 'WP-0015', tecnico: '—', suporte: 'Carla Mendes', dataAgendamento: '04/03/2026 11:00', estado: 'Aberta', anomalia: 'Alarme de qualidade' },
    { id: 'OS-0803', tipo: 'Corretiva', cliente: 'Farmácia Saúde +', maquina: 'NTR-0008', tecnico: 'Bruno Cunha', suporte: 'Ana Ferreira', dataAgendamento: '03/03/2026 09:30', estado: 'Concluída', anomalia: 'Filtro entupido' },
    { id: 'OS-0802', tipo: 'Preventiva', cliente: 'Residencial Vista Mar', maquina: 'NTR-0031', tecnico: 'Joana Tavares', suporte: 'Carla Mendes', dataAgendamento: '02/03/2026 08:00', estado: 'Concluída', anomalia: 'Manutenção semestral' },
    { id: 'OS-0801', tipo: 'Preventiva', cliente: 'MINSA — Dir. Luanda', maquina: 'NTR-0055', tecnico: 'Fátima Rodrigues', suporte: 'Ana Ferreira', dataAgendamento: '01/03/2026 09:00', estado: 'Concluída', anomalia: 'Manutenção semestral' },
    { id: 'OS-0800', tipo: 'Corretiva', cliente: 'Supermercado Maxi', maquina: 'WP-0029', tecnico: 'Gabriel Teixeira', suporte: 'Carla Mendes', dataAgendamento: '28/02/2026 10:00', estado: 'Cancelada', anomalia: 'Fuga de água' },
    { id: 'OS-0799', tipo: 'Montagem', cliente: 'Petro Servicing Angola', maquina: 'NTR-NOVO', tecnico: 'Joana Tavares', suporte: 'Ana Ferreira', dataAgendamento: '27/02/2026 08:00', estado: 'Concluída', anomalia: 'Instalação 2 Neutratech' },
];

const TIPO_BADGE: Record<OSTipo, string> = {
    'Montagem': 'tbadge tbadge-campo',
    'Preventiva': 'tbadge tbadge-suporte',
    'Corretiva': 'tbadge tbadge-admin',
    'Remota': 'tbadge tbadge-vendedor',
};

const ESTADO_DOT: Record<OSEstado, string> = {
    'Aberta': 'dot-orange',
    'Em execução': 'dot-blue',
    'Concluída': 'dot-green',
    'Cancelada': 'dot-gray',
};

const OrdensPage: React.FC = () => {
    const [search, setSearch] = useState('');
    const [filterTipo, setFilterTipo] = useState('');
    const [filterEstado, setFilterEstado] = useState('');

    const filtered = MOCK_OS.filter(o => {
        const q = search.toLowerCase();
        const matchQ = !q || o.id.toLowerCase().includes(q) || o.cliente.toLowerCase().includes(q);
        const matchT = !filterTipo || o.tipo === filterTipo;
        const matchE = !filterEstado || o.estado === filterEstado;
        return matchQ && matchT && matchE;
    });

    const byEstado = (e: OSEstado) => MOCK_OS.filter(o => o.estado === e).length;

    return (
        <AppLayout>
            <ActionBar title="Ordens de Serviço" breadcrumb="AQUATEX SGI · Ordens de Serviço">
                <div className="actionbar-spacer" />
                <button className="abtn abtn-primary" type="button"><Plus size={13} /> Nova OS</button>
                <div className="actionbar-sep" />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{filtered.length} registos</span>
            </ActionBar>

            <div className="page-content">
                {/* Stats */}
                <div className="stats-row">
                    {([
                        { label: 'Abertas', value: byEstado('Aberta'), cls: 'orange' },
                        { label: 'Em Execução', value: byEstado('Em execução'), cls: 'blue' },
                        { label: 'Concluídas', value: byEstado('Concluída'), cls: 'green' },
                        { label: 'Canceladas', value: byEstado('Cancelada'), cls: 'muted' },
                    ] as const).map(s => (
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
                        <input className="search-input" placeholder="Pesquisar por código ou cliente..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select className="filter-select" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
                        <option value="">Todos os Tipos</option>
                        {(['Montagem', 'Preventiva', 'Corretiva', 'Remota'] as OSTipo[]).map(t => <option key={t}>{t}</option>)}
                    </select>
                    <select className="filter-select" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
                        <option value="">Todos os Estados</option>
                        {(['Aberta', 'Em execução', 'Concluída', 'Cancelada'] as OSEstado[]).map(e => <option key={e}>{e}</option>)}
                    </select>
                    {(search || filterTipo || filterEstado) && (
                        <button className="abtn abtn-secondary" onClick={() => { setSearch(''); setFilterTipo(''); setFilterEstado(''); }}><Filter size={12} /> Limpar</button>
                    )}
                </div>

                {/* Table */}
                <div className="table-container">
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 20 }} />
                                    <th>Código</th>
                                    <th>Tipo</th>
                                    <th>Cliente</th>
                                    <th>Máquina</th>
                                    <th>Técnico Campo</th>
                                    <th>Suporte</th>
                                    <th>Agendamento</th>
                                    <th>Estado</th>
                                    <th style={{ width: 60 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr><td colSpan={10}><div className="empty-state">Nenhuma OS encontrada.</div></td></tr>
                                )}
                                {filtered.map(os => (
                                    <tr key={os.id}>
                                        <td style={{ paddingLeft: 10 }}><span className={`dot ${ESTADO_DOT[os.estado]}`} /></td>
                                        <td><span className="td-link">{os.id}</span></td>
                                        <td><span className={TIPO_BADGE[os.tipo]}>{os.tipo}</span></td>
                                        <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{os.cliente}</td>
                                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{os.maquina}</td>
                                        <td style={{ fontSize: '0.78rem' }}>{os.tecnico}</td>
                                        <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{os.suporte}</td>
                                        <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{os.dataAgendamento}</td>
                                        <td>
                                            <div className="status-dot">
                                                <span className={`dot ${ESTADO_DOT[os.estado]}`} />
                                                <span style={{ fontSize: '0.78rem' }}>{os.estado}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="row-actions">
                                                <button className="icon-btn" title="Ver detalhes"><Eye size={12} /></button>
                                                <button className="icon-btn" title="Editar"><Pencil size={12} /></button>
                                                <button className="icon-btn" title="Ver ficha PDF"><FileText size={12} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="table-count">{filtered.length} OS encontradas</div>
                </div>
            </div>
        </AppLayout>
    );
};

export default OrdensPage;
