import React, { useState } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import ExportModal, { ExportCol } from '../../components/ExportModal';
import { useGlobal, SysLog } from '../../contexts/GlobalContext';
import { Search, AlertCircle, Info, AlertTriangle, ScrollText, Download } from 'lucide-react';

const TIPO_CFG: Record<SysLog['tipo'], { icon: React.ReactNode; color: string; label: string }> = {
    info:    { icon: <Info size={12} />,          color: 'var(--blue)',   label: 'Info'    },
    warning: { icon: <AlertTriangle size={12} />, color: 'var(--orange)', label: 'Aviso'   },
    error:   { icon: <AlertCircle size={12} />,   color: 'var(--red)',    label: 'Erro'    },
};

const LogsPage: React.FC = () => {
    const { logs, currentUser, fmtDate } = useGlobal();
    const fmtTs = (ts: string) => {
        const d = new Date(ts);
        return fmtDate(ts) + ' ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    const [search, setSearch]       = useState('');
    const [filterTipo, setFilterTipo] = useState('');
    const [filterModulo, setFilterModulo] = useState('');
    const [showExport, setShowExport] = useState(false);

    const modulos = Array.from(new Set(logs.map(l => l.modulo))).sort();

    const userLogs = logs.filter(l => !currentUser || l.usuario === currentUser.email);

    const filtered = userLogs.filter(l => {
        const q = search.toLowerCase();
        const matchQ = !q || l.acao.toLowerCase().includes(q) || l.detalhes.toLowerCase().includes(q) || l.modulo.toLowerCase().includes(q);
        const matchT = !filterTipo   || l.tipo   === filterTipo;
        const matchM = !filterModulo || l.modulo === filterModulo;
        return matchQ && matchT && matchM;
    });

    const exportData = filtered;

    const EXPORT_COLS: ExportCol[] = [
        { key: 'timestamp', label: 'Data / Hora' },
        { key: 'tipo',      label: 'Tipo'        },
        { key: 'modulo',    label: 'Módulo'      },
        { key: 'acao',      label: 'Acção'       },
        { key: 'detalhes',  label: 'Detalhes'    },
        { key: 'usuario',   label: 'Utilizador'  },
    ];

    return (
        <AppLayout>
            <ActionBar title="Logs do Sistema" breadcrumb="AQUATEX SGI · Logs">
                <div className="actionbar-spacer" />
                <button className="abtn abtn-secondary" type="button" onClick={() => setShowExport(true)}>
                    <Download size={13} /> Exportar
                </button>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {currentUser ? `A mostrar logs de: ${currentUser.email}` : 'Sessão não iniciada'}
                </span>
            </ActionBar>

            <div className="page-content">
                <div className="stats-row">
                    {[
                        { label: 'Total',   value: userLogs.length,                          cls: ''       },
                        { label: 'Info',    value: userLogs.filter(l => l.tipo === 'info').length,    cls: 'blue'   },
                        { label: 'Avisos',  value: userLogs.filter(l => l.tipo === 'warning').length, cls: 'orange' },
                        { label: 'Erros',   value: userLogs.filter(l => l.tipo === 'error').length,   cls: 'muted'  },
                    ].map(s => (
                        <div key={s.label} className="stat-card">
                            <span className="stat-label">{s.label}</span>
                            <span className={`stat-value ${s.cls}`}>{s.value}</span>
                        </div>
                    ))}
                </div>

                <div className="filters-bar">
                    <div className="search-wrap">
                        <Search className="search-icon" />
                        <input className="search-input" placeholder="Pesquisar acção ou detalhe..."
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select className="filter-select" value={filterModulo} onChange={e => setFilterModulo(e.target.value)}>
                        <option value="">Todos os módulos</option>
                        {modulos.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select className="filter-select" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
                        <option value="">Todos os tipos</option>
                        <option value="info">Informação</option>
                        <option value="warning">Aviso</option>
                        <option value="error">Erro</option>
                    </select>
                </div>

                <div className="table-container">
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 28 }} />
                                    <th>Data / Hora</th>
                                    <th>Módulo</th>
                                    <th>Acção</th>
                                    <th>Detalhes</th>
                                    <th>Utilizador</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr><td colSpan={6}><div className="empty-state"><ScrollText size={28} /><br />Sem registos de log.</div></td></tr>
                                )}
                                {filtered.map(l => {
                                    const cfg = TIPO_CFG[l.tipo];
                                    return (
                                        <tr key={l.id}>
                                            <td style={{ textAlign: 'center' }}>
                                                <span style={{ color: cfg.color }} title={cfg.label}>{cfg.icon}</span>
                                            </td>
                                            <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtTs(l.timestamp)}</td>
                                            <td>
                                                <span className="tbadge tbadge-suporte" style={{ fontSize: '0.7rem' }}>{l.modulo}</span>
                                            </td>
                                            <td style={{ fontWeight: 600, fontSize: '0.8rem' }}>{l.acao}</td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{l.detalhes}</td>
                                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.usuario}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="table-count">{filtered.length} registos</div>
                </div>
            </div>

            {showExport && (
                <ExportModal
                    title="Logs do Sistema"
                    columns={EXPORT_COLS}
                    data={exportData}
                    filename="logs_sistema"
                    onClose={() => setShowExport(false)}
                />
            )}
        </AppLayout>
    );
};

export default LogsPage;
