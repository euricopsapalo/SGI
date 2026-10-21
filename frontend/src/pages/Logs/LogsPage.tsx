import React, { useEffect, useState } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import ExportModal, { ExportCol } from '../../components/ExportModal';
import { useGlobal, SysLog } from '../../contexts/GlobalContext';
import EmptyState from '../../components/EmptyState';
import TableSkeleton from '../../components/TableSkeleton';
import { Search, AlertCircle, Info, AlertTriangle, ScrollText, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { listarLogs, LogsResposta } from '../../services/logs';

const TIPO_CFG: Record<SysLog['tipo'], { icon: React.ReactNode; color: string; label: string }> = {
    info:    { icon: <Info size={12} />,          color: 'var(--blue)',   label: 'Info'    },
    warning: { icon: <AlertTriangle size={12} />, color: 'var(--orange)', label: 'Aviso'   },
    error:   { icon: <AlertCircle size={12} />,   color: 'var(--red)',    label: 'Erro'    },
};

const POR_PAGINA = 50;

const LogsPage: React.FC = () => {
    const { fmtDate } = useGlobal();
    const fmtTs = (ts: string) => {
        const d = new Date(ts);
        return fmtDate(ts) + ' ' + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };
    // #210 — filtros e paginação no servidor; o admin vê os registos de todos os utilizadores.
    const [search, setSearch]       = useState('');
    const [q, setQ]                 = useState('');
    const [filterTipo, setFilterTipo] = useState<SysLog['tipo'] | ''>('');
    const [filterModulo, setFilterModulo] = useState('');
    const [de, setDe]               = useState('');
    const [ate, setAte]             = useState('');
    const [pagina, setPagina]       = useState(1);
    const [dados, setDados]         = useState<LogsResposta | null>(null);
    const [loading, setLoading]     = useState(true);
    const [erro, setErro]           = useState<string | null>(null);
    const [showExport, setShowExport] = useState(false);

    // Pesquisa com atraso para não pedir ao servidor a cada tecla.
    useEffect(() => {
        const t = setTimeout(() => { setQ(search); setPagina(1); }, 300);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        let ativo = true;
        setLoading(true);
        listarLogs({ pagina, porPagina: POR_PAGINA, q, tipo: filterTipo, modulo: filterModulo, de, ate })
            .then(r => { if (ativo) { setDados(r); setErro(null); } })
            .catch(() => { if (ativo) setErro('Não foi possível carregar os registos.'); })
            .finally(() => { if (ativo) setLoading(false); });
        return () => { ativo = false; };
    }, [pagina, q, filterTipo, filterModulo, de, ate]);

    const filtrar = (fn: () => void) => { fn(); setPagina(1); };

    const items = dados?.items ?? [];
    const total = dados?.total ?? 0;
    const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    const porTipo = dados?.porTipo ?? { info: 0, warning: 0, error: 0 };
    const modulos = dados?.modulos ?? [];

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
                    <Download size={13} /> Exportar página
                </button>
            </ActionBar>

            <div className="page-content">
                <div className="stats-row">
                    {[
                        { label: 'Total',   value: porTipo.info + porTipo.warning + porTipo.error, cls: ''       },
                        { label: 'Info',    value: porTipo.info,    cls: 'blue'   },
                        { label: 'Avisos',  value: porTipo.warning, cls: 'orange' },
                        { label: 'Erros',   value: porTipo.error,   cls: 'muted'  },
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
                        <input className="search-input" placeholder="Pesquisar acção, detalhe ou utilizador..."
                            aria-label="Pesquisar registos"
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select className="filter-select" aria-label="Módulo" value={filterModulo} onChange={e => filtrar(() => setFilterModulo(e.target.value))}>
                        <option value="">Todos os módulos</option>
                        {modulos.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select className="filter-select" aria-label="Tipo" value={filterTipo} onChange={e => filtrar(() => setFilterTipo(e.target.value as SysLog['tipo'] | ''))}>
                        <option value="">Todos os tipos</option>
                        <option value="info">Informação</option>
                        <option value="warning">Aviso</option>
                        <option value="error">Erro</option>
                    </select>
                    <input type="date" className="filter-select" aria-label="De" value={de} onChange={e => filtrar(() => setDe(e.target.value))} />
                    <input type="date" className="filter-select" aria-label="Até" value={ate} onChange={e => filtrar(() => setAte(e.target.value))} />
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
                                {loading && <TableSkeleton cols={6} />}
                                {!loading && erro && (
                                    <tr><td colSpan={6}><EmptyState icon={<AlertCircle size={28} />} title={erro} description="Tente novamente mais tarde." /></td></tr>
                                )}
                                {!loading && !erro && items.length === 0 && (
                                    <tr><td colSpan={6}><EmptyState icon={<ScrollText size={28} />} title="Sem registos de log" description="As atividades do sistema aparecem aqui à medida que os utilizadores operam a plataforma." /></td></tr>
                                )}
                                {!loading && !erro && items.map(l => {
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
                    <div className="table-count" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {total} registos · Página {pagina} de {totalPaginas}
                        <button type="button" className="icon-btn" aria-label="Página anterior" disabled={pagina <= 1}
                            onClick={() => setPagina(p => p - 1)}><ChevronLeft size={13} /></button>
                        <button type="button" className="icon-btn" aria-label="Página seguinte" disabled={pagina >= totalPaginas}
                            onClick={() => setPagina(p => p + 1)}><ChevronRight size={13} /></button>
                    </div>
                </div>
            </div>

            {showExport && (
                <ExportModal
                    title="Logs do Sistema"
                    columns={EXPORT_COLS}
                    data={items}
                    filename="logs_sistema"
                    onClose={() => setShowExport(false)}
                />
            )}
        </AppLayout>
    );
};

export default LogsPage;
