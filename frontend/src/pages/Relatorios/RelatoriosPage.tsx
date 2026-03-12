import React, { useState, useMemo } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import ExportModal, { ExportCol } from '../../components/ExportModal';
import { BarChart3, TrendingUp, Users, Download, Package, Search } from 'lucide-react';

type RelTab = 'faturacao' | 'comissoes' | 'produtividade' | 'movimentos';

const TABS: { id: RelTab; label: string; icon: React.FC<any> }[] = [
    { id: 'faturacao',     label: 'Faturação Mensal',      icon: BarChart3  },
    { id: 'comissoes',     label: 'Comissões',              icon: TrendingUp },
    { id: 'produtividade', label: 'Produtividade Técnicos', icon: Users      },
    { id: 'movimentos',    label: 'Movimentos de Stock',    icon: Package    },
];

/* ── Static data ── */
const MOVIMENTOS_STOCK = [
    { data: '2026-03-11', tipo: 'Entrada',      artigo: 'Membrana Osmose Inversa 4040',    codigo: 'MEM-RO-4040', armazem: 'ARM-01',          quantidade: 10, origem: 'ENC-001',       utilizador: 'admin@aquatex.ao' },
    { data: '2026-03-11', tipo: 'Inventário',   artigo: 'Filtro Sedimentos 10" 5 micron',  codigo: 'FLT-SED-10',  armazem: 'ARM-01',          quantidade: -5, origem: 'Inventário',    utilizador: 'admin@aquatex.ao' },
    { data: '2026-03-10', tipo: 'Saída',        artigo: 'Membrana Osmose Inversa 4040',    codigo: 'MEM-RO-4040', armazem: 'ARM-01',          quantidade: -1, origem: 'OT-0001',       utilizador: 'admin@aquatex.ao' },
    { data: '2026-03-10', tipo: 'Saída',        artigo: 'Filtro Carvão Activado 20"',      codigo: 'FLT-CAR-20',  armazem: 'ARM-01',          quantidade: -2, origem: 'OT-0001',       utilizador: 'admin@aquatex.ao' },
    { data: '2026-03-09', tipo: 'Entrada',      artigo: 'Lâmpada UV 25W Germicida',        codigo: 'UV-LAMP-25',  armazem: 'ARM-01',          quantidade:  4, origem: 'ENC-003',       utilizador: 'admin@aquatex.ao' },
    { data: '2026-03-09', tipo: 'Entrada',      artigo: 'Sal para Resina 25kg',            codigo: 'SAL-RES-25',  armazem: 'ARM-01',          quantidade: 20, origem: 'ENC-003',       utilizador: 'admin@aquatex.ao' },
    { data: '2026-03-08', tipo: 'Transferência',artigo: 'O-Ring Kit 100 peças',            codigo: 'O-RING-K100', armazem: 'ARM-01→ARM-02',   quantidade:  5, origem: 'Transferência', utilizador: 'admin@aquatex.ao' },
    { data: '2026-03-06', tipo: 'Saída',        artigo: 'Filtro Carvão Activado 20"',      codigo: 'FLT-CAR-20',  armazem: 'ARM-01',          quantidade: -1, origem: 'OT-0007',       utilizador: 'admin@aquatex.ao' },
    { data: '2026-02-25', tipo: 'Entrada',      artigo: 'Filtro Sedimentos 10" 5 micron',  codigo: 'FLT-SED-10',  armazem: 'ARM-01',          quantidade: 20, origem: 'ENC-002',       utilizador: 'admin@aquatex.ao' },
    { data: '2026-02-25', tipo: 'Entrada',      artigo: 'Filtro Carvão Activado 20"',      codigo: 'FLT-CAR-20',  armazem: 'ARM-01',          quantidade: 10, origem: 'ENC-002',       utilizador: 'admin@aquatex.ao' },
];

const FATURACAO_MENSAL = [
    { mes: 'Set 2025', mes_key: '2025-09', os: 28, montagem: 620000, preventiva: 300000, corretiva: 210000, total: 1130000 },
    { mes: 'Out 2025', mes_key: '2025-10', os: 31, montagem: 450000, preventiva: 340000, corretiva: 180000, total:  970000 },
    { mes: 'Nov 2025', mes_key: '2025-11', os: 35, montagem: 780000, preventiva: 280000, corretiva: 220000, total: 1280000 },
    { mes: 'Dez 2025', mes_key: '2025-12', os: 29, montagem: 350000, preventiva: 320000, corretiva: 140000, total:  810000 },
    { mes: 'Jan 2026', mes_key: '2026-01', os: 33, montagem: 560000, preventiva: 360000, corretiva: 190000, total: 1110000 },
    { mes: 'Fev 2026', mes_key: '2026-02', os: 38, montagem: 890000, preventiva: 390000, corretiva: 260000, total: 1540000 },
    { mes: 'Mar 2026', mes_key: '2026-03', os: 37, montagem: 950000, preventiva: 340000, corretiva: 195000, total: 1485000 },
];

const COMISSOES = [
    { nome: 'Bruno Cunha',      tipo: 'Técnico Campo', os: 18, montagem: 3, preventiva: 10, corretiva: 5, total: 960000 },
    { nome: 'Fátima Rodrigues', tipo: 'Técnico Campo', os: 14, montagem: 2, preventiva:  8, corretiva: 4, total: 720000 },
    { nome: 'Joana Tavares',    tipo: 'Técnico Campo', os: 12, montagem: 5, preventiva:  5, corretiva: 2, total: 730000 },
    { nome: 'Gabriel Teixeira', tipo: 'Técnico Campo', os:  6, montagem: 0, preventiva:  4, corretiva: 2, total: 280000 },
    { nome: 'Daniel Nkosi',     tipo: 'Vendedor',      os:  8, montagem: 8, preventiva:  0, corretiva: 0, total: 385000 },
];

const PRODUTIVIDADE = [
    { nome: 'Bruno Cunha',      osMes: 18, concluidas: 17, canceladas: 1, tempMedio: '2h 10min', satisfacao: 4.8 },
    { nome: 'Fátima Rodrigues', osMes: 14, concluidas: 14, canceladas: 0, tempMedio: '2h 35min', satisfacao: 4.9 },
    { nome: 'Joana Tavares',    osMes: 12, concluidas: 11, canceladas: 1, tempMedio: '3h 00min', satisfacao: 4.6 },
    { nome: 'Gabriel Teixeira', osMes:  6, concluidas:  5, canceladas: 1, tempMedio: '2h 50min', satisfacao: 4.2 },
];

const TIPO_MOV_COLOR: Record<string, string> = {
    'Entrada': 'var(--green)', 'Saída': 'var(--red)',
    'Inventário': 'var(--blue)', 'Transferência': 'var(--orange)',
};

/* ── Export column definitions per tab ── */
const COLS: Record<RelTab, ExportCol[]> = {
    faturacao: [
        { key: 'mes',        label: 'Mês'           },
        { key: 'os',         label: 'Nº OT'         },
        { key: 'montagem',   label: 'Montagem (Kz)' },
        { key: 'preventiva', label: 'Preventiva (Kz)'},
        { key: 'corretiva',  label: 'Corretiva (Kz)' },
        { key: 'total',      label: 'Total (Kz)'    },
    ],
    comissoes: [
        { key: 'nome',       label: 'Nome'           },
        { key: 'tipo',       label: 'Perfil'         },
        { key: 'os',         label: 'Nº OS'          },
        { key: 'montagem',   label: 'Montagem'       },
        { key: 'preventiva', label: 'Preventiva'     },
        { key: 'corretiva',  label: 'Corretiva'      },
        { key: 'total',      label: 'Total (Kz)'     },
    ],
    produtividade: [
        { key: 'nome',       label: 'Técnico'        },
        { key: 'osMes',      label: 'OS no Mês'      },
        { key: 'concluidas', label: 'Concluídas'     },
        { key: 'canceladas', label: 'Canceladas'     },
        { key: 'tempMedio',  label: 'Tempo Médio'    },
        { key: 'satisfacao', label: 'Satisfação'     },
    ],
    movimentos: [
        { key: 'data',        label: 'Data'       },
        { key: 'tipo',        label: 'Tipo'       },
        { key: 'codigo',      label: 'Código'     },
        { key: 'artigo',      label: 'Artigo'     },
        { key: 'armazem',     label: 'Armazém'    },
        { key: 'quantidade',  label: 'Quantidade' },
        { key: 'origem',      label: 'Origem'     },
        { key: 'utilizador',  label: 'Utilizador' },
    ],
};

const fmtKz = (v: number) => v.toLocaleString('pt-PT');
const fmtNum = (v: number) => v.toLocaleString('pt-PT');

/* ══════════════════════════════════════════════════════════ */
const RelatoriosPage: React.FC = () => {
    const [tab,            setTab]            = useState<RelTab>('faturacao');
    const [showExport,     setShowExport]     = useState(false);

    /* Faturação filters */
    const mesKeys = FATURACAO_MENSAL.map(m => m.mes_key);
    const [fatDe,  setFatDe]  = useState(mesKeys[0]);
    const [fatAte, setFatAte] = useState(mesKeys[mesKeys.length - 1]);

    /* Comissões filters */
    const [comTipo,   setComTipo]   = useState('');
    const [comSearch, setComSearch] = useState('');

    /* Produtividade filters */
    const [prodSearch, setProdSearch] = useState('');

    /* Movimentos filters */
    const [movTipo,  setMovTipo]  = useState('');
    const [movDe,    setMovDe]    = useState('');
    const [movAte,   setMovAte]   = useState('');
    const [movSearch, setMovSearch] = useState('');

    /* ── filtered datasets ── */
    const filtFaturacao = useMemo(() =>
        FATURACAO_MENSAL.filter(m => m.mes_key >= fatDe && m.mes_key <= fatAte),
        [fatDe, fatAte]
    );

    const filtComissoes = useMemo(() =>
        COMISSOES.filter(c =>
            (!comTipo   || c.tipo === comTipo) &&
            (!comSearch || c.nome.toLowerCase().includes(comSearch.toLowerCase()))
        ),
        [comTipo, comSearch]
    );

    const filtProdutividade = useMemo(() =>
        PRODUTIVIDADE.filter(t =>
            !prodSearch || t.nome.toLowerCase().includes(prodSearch.toLowerCase())
        ),
        [prodSearch]
    );

    const filtMovimentos = useMemo(() =>
        MOVIMENTOS_STOCK.filter(m =>
            (!movTipo   || m.tipo === movTipo) &&
            (!movDe     || m.data >= movDe) &&
            (!movAte    || m.data <= movAte) &&
            (!movSearch || m.artigo.toLowerCase().includes(movSearch.toLowerCase()) ||
                           m.codigo.toLowerCase().includes(movSearch.toLowerCase()))
        ),
        [movTipo, movDe, movAte, movSearch]
    );

    /* current export payload */
    const exportData: Record<RelTab, Record<string, any>[]> = {
        faturacao:     filtFaturacao,
        comissoes:     filtComissoes,
        produtividade: filtProdutividade,
        movimentos:    filtMovimentos,
    };

    const tabLabel = TABS.find(t => t.id === tab)?.label ?? '';
    const maxTotal = Math.max(...filtFaturacao.map(m => m.total), 1);

    return (
        <AppLayout>
            <ActionBar title="Relatórios" breadcrumb="AQUATEX SGI · Relatórios">
                <div className="actionbar-spacer" />
                <button className="abtn abtn-secondary" type="button" onClick={() => setShowExport(true)}>
                    <Download size={13} /> Exportar
                </button>
            </ActionBar>

            <div className="page-content">

                {/* Tab bar */}
                <div style={{ display: 'flex', gap: 2, marginBottom: 16, background: 'var(--panel-header-bg)', border: '1px solid var(--panel-border)', borderRadius: 5, padding: 4, width: 'fit-content' }}>
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '5px 14px', borderRadius: 4, border: 'none',
                                background: tab === t.id ? '#fff' : 'none',
                                boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                                fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: tab === t.id ? 700 : 600,
                                color: tab === t.id ? 'var(--blue)' : 'var(--text-secondary)',
                                cursor: 'pointer', transition: 'all 150ms', whiteSpace: 'nowrap',
                            }}
                        >
                            <t.icon size={13} /> {t.label}
                        </button>
                    ))}
                </div>

                {/* ── FATURAÇÃO ── */}
                {tab === 'faturacao' && (
                    <>
                        {/* Filters */}
                        <div className="filters-bar" style={{ marginBottom: 14 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                De:
                                <select className="filter-select" value={fatDe} onChange={e => setFatDe(e.target.value)}>
                                    {mesKeys.map(k => <option key={k} value={k}>{FATURACAO_MENSAL.find(m => m.mes_key === k)?.mes}</option>)}
                                </select>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                Até:
                                <select className="filter-select" value={fatAte} onChange={e => setFatAte(e.target.value)}>
                                    {mesKeys.filter(k => k >= fatDe).map(k => <option key={k} value={k}>{FATURACAO_MENSAL.find(m => m.mes_key === k)?.mes}</option>)}
                                </select>
                            </label>
                        </div>

                        {/* Stats */}
                        <div className="stats-row" style={{ marginBottom: 16 }}>
                            {[
                                { label: 'Total período',  value: `Kz ${fmtKz(filtFaturacao.reduce((s, m) => s + m.total, 0))}` },
                                { label: 'Média mensal',   value: `Kz ${fmtKz(Math.round(filtFaturacao.reduce((s, m) => s + m.total, 0) / (filtFaturacao.length || 1)))}` },
                                { label: 'Melhor mês',     value: filtFaturacao.reduce((a, m) => m.total > a.total ? m : a, filtFaturacao[0] ?? { mes: '—', total: 0 }).mes },
                                { label: 'OT Faturadas',   value: fmtNum(filtFaturacao.reduce((s, m) => s + m.os, 0)) },
                            ].map(s => (
                                <div key={s.label} className="stat-card">
                                    <span className="stat-label">{s.label}</span>
                                    <span className="stat-value blue">{s.value}</span>
                                </div>
                            ))}
                        </div>

                        {/* Bar chart */}
                        <div className="panel" style={{ marginBottom: 16 }}>
                            <div className="panel-header"><span className="panel-title">Faturação Mensal (Kz)</span></div>
                            <div className="panel-body">
                                {filtFaturacao.length === 0
                                    ? <div className="empty-state" style={{ height: 100 }}>Sem dados para o período seleccionado.</div>
                                    : (
                                        <>
                                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160 }}>
                                                {filtFaturacao.map(m => (
                                                    <div key={m.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--blue)' }}>{(m.total / 1000).toFixed(0)}K</div>
                                                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
                                                            {[{ v: m.montagem, c: 'var(--blue)' }, { v: m.preventiva, c: 'var(--green)' }, { v: m.corretiva, c: 'var(--orange)' }].map((bar, bi) => (
                                                                <div key={bi} style={{ width: 10, borderRadius: '2px 2px 0 0', height: `${(bar.v / maxTotal) * 120}px`, background: bar.c, transition: 'height 300ms' }} />
                                                            ))}
                                                        </div>
                                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap' }}>{m.mes}</div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
                                                {[['Montagem', 'var(--blue)'], ['Preventiva', 'var(--green)'], ['Corretiva', 'var(--orange)']].map(([l, c]) => (
                                                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                        <span style={{ width: 10, height: 10, background: c, borderRadius: 2, display: 'inline-block' }} /> {l}
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )
                                }
                            </div>
                        </div>

                        <div className="table-container">
                            <table className="data-table">
                                <thead><tr><th>Mês</th><th style={{ textAlign: 'center' }}>OT</th><th style={{ textAlign: 'right' }}>Montagem</th><th style={{ textAlign: 'right' }}>Preventiva</th><th style={{ textAlign: 'right' }}>Corretiva</th><th style={{ textAlign: 'right', fontWeight: 800 }}>Total (Kz)</th></tr></thead>
                                <tbody>
                                    {filtFaturacao.length === 0 && <tr><td colSpan={6}><div className="empty-state">Sem resultados.</div></td></tr>}
                                    {filtFaturacao.map(m => (
                                        <tr key={m.mes}>
                                            <td style={{ fontWeight: 700 }}>{m.mes}</td>
                                            <td style={{ textAlign: 'center', color: 'var(--blue)', fontWeight: 700 }}>{m.os}</td>
                                            <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>{fmtKz(m.montagem)}</td>
                                            <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>{fmtKz(m.preventiva)}</td>
                                            <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>{fmtKz(m.corretiva)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--blue)' }}>{fmtKz(m.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="table-count">{filtFaturacao.length} meses</div>
                        </div>
                    </>
                )}

                {/* ── COMISSÕES ── */}
                {tab === 'comissoes' && (
                    <>
                        <div className="filters-bar" style={{ marginBottom: 14 }}>
                            <div className="search-wrap">
                                <Search className="search-icon" />
                                <input className="search-input" placeholder="Pesquisar por nome…" value={comSearch} onChange={e => setComSearch(e.target.value)} />
                            </div>
                            <select className="filter-select" value={comTipo} onChange={e => setComTipo(e.target.value)}>
                                <option value="">Todos os perfis</option>
                                <option value="Técnico Campo">Técnico Campo</option>
                                <option value="Vendedor">Vendedor</option>
                            </select>
                        </div>

                        <div className="stats-row" style={{ marginBottom: 16 }}>
                            {[
                                { label: 'Total Comissões',      value: `Kz ${fmtKz(filtComissoes.reduce((s, c) => s + c.total, 0))}`, cls: 'blue' },
                                { label: 'Técnicos de Campo',    value: filtComissoes.filter(c => c.tipo === 'Técnico Campo').length },
                                { label: 'Vendedores',           value: filtComissoes.filter(c => c.tipo === 'Vendedor').length },
                            ].map(s => (
                                <div key={s.label} className="stat-card">
                                    <span className="stat-label">{s.label}</span>
                                    <span className={`stat-value ${(s as any).cls ?? ''}`}>{s.value}</span>
                                </div>
                            ))}
                        </div>

                        <div className="table-container">
                            <table className="data-table">
                                <thead><tr><th>Nome</th><th>Perfil</th><th style={{ textAlign: 'center' }}>OS</th><th style={{ textAlign: 'center' }}>Montagem</th><th style={{ textAlign: 'center' }}>Preventiva</th><th style={{ textAlign: 'center' }}>Corretiva</th><th style={{ textAlign: 'right', fontWeight: 800 }}>Total (Kz)</th></tr></thead>
                                <tbody>
                                    {filtComissoes.length === 0 && <tr><td colSpan={7}><div className="empty-state">Sem resultados.</div></td></tr>}
                                    {filtComissoes.map(c => (
                                        <tr key={c.nome}>
                                            <td style={{ fontWeight: 700 }}>{c.nome}</td>
                                            <td><span className={c.tipo === 'Vendedor' ? 'tbadge tbadge-vendedor' : 'tbadge tbadge-campo'}>{c.tipo}</span></td>
                                            <td style={{ textAlign: 'center', color: 'var(--blue)', fontWeight: 700 }}>{c.os}</td>
                                            <td style={{ textAlign: 'center' }}>{c.montagem}</td>
                                            <td style={{ textAlign: 'center' }}>{c.preventiva}</td>
                                            <td style={{ textAlign: 'center' }}>{c.corretiva}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--green)' }}>{fmtKz(c.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="table-count">{filtComissoes.length} registos</div>
                        </div>
                    </>
                )}

                {/* ── PRODUTIVIDADE ── */}
                {tab === 'produtividade' && (
                    <>
                        <div className="filters-bar" style={{ marginBottom: 14 }}>
                            <div className="search-wrap">
                                <Search className="search-icon" />
                                <input className="search-input" placeholder="Pesquisar técnico…" value={prodSearch} onChange={e => setProdSearch(e.target.value)} />
                            </div>
                        </div>

                        <div className="stats-row" style={{ marginBottom: 16 }}>
                            {[
                                { label: 'Total OS (mês)',    value: filtProdutividade.reduce((s, t) => s + t.osMes, 0) },
                                { label: 'Concluídas',        value: filtProdutividade.reduce((s, t) => s + t.concluidas, 0), cls: 'green' },
                                { label: 'Canceladas',        value: filtProdutividade.reduce((s, t) => s + t.canceladas, 0), cls: 'muted' },
                                { label: 'Satisfação Média',  value: filtProdutividade.length > 0 ? (filtProdutividade.reduce((s, t) => s + t.satisfacao, 0) / filtProdutividade.length).toFixed(1) + ' ★' : '—', cls: 'blue' },
                            ].map(s => (
                                <div key={s.label} className="stat-card">
                                    <span className="stat-label">{s.label}</span>
                                    <span className={`stat-value ${(s as any).cls || ''}`}>{s.value}</span>
                                </div>
                            ))}
                        </div>

                        <div className="table-container">
                            <table className="data-table">
                                <thead><tr><th>Técnico</th><th style={{ textAlign: 'center' }}>OS no Mês</th><th style={{ textAlign: 'center' }}>Concluídas</th><th style={{ textAlign: 'center' }}>Canceladas</th><th style={{ textAlign: 'center' }}>Tempo Médio</th><th style={{ textAlign: 'center' }}>Satisfação</th></tr></thead>
                                <tbody>
                                    {filtProdutividade.length === 0 && <tr><td colSpan={6}><div className="empty-state">Sem resultados.</div></td></tr>}
                                    {filtProdutividade.map(t => (
                                        <tr key={t.nome}>
                                            <td>
                                                <div className="user-cell">
                                                    <div className="user-avatar" style={{ width: 28, height: 28, fontSize: '0.65rem' }}>{t.nome.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                                                    <span style={{ fontWeight: 700 }}>{t.nome}</span>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--blue)' }}>{t.osMes}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--green)' }}>{t.concluidas}</td>
                                            <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{t.canceladas}</td>
                                            <td style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{t.tempMedio}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 800, color: t.satisfacao >= 4.7 ? 'var(--green)' : t.satisfacao >= 4.4 ? 'var(--orange)' : 'var(--red)' }}>
                                                {t.satisfacao} ★
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="table-count">{filtProdutividade.length} técnicos</div>
                        </div>
                    </>
                )}

                {/* ── MOVIMENTOS DE STOCK ── */}
                {tab === 'movimentos' && (
                    <>
                        <div className="filters-bar" style={{ marginBottom: 14 }}>
                            <div className="search-wrap">
                                <Search className="search-icon" />
                                <input className="search-input" placeholder="Artigo ou código…" value={movSearch} onChange={e => setMovSearch(e.target.value)} />
                            </div>
                            <select className="filter-select" value={movTipo} onChange={e => setMovTipo(e.target.value)}>
                                <option value="">Todos os tipos</option>
                                <option value="Entrada">Entrada</option>
                                <option value="Saída">Saída</option>
                                <option value="Inventário">Inventário</option>
                                <option value="Transferência">Transferência</option>
                            </select>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                De: <input type="date" className="filter-select" style={{ width: 130 }} value={movDe} onChange={e => setMovDe(e.target.value)} />
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                Até: <input type="date" className="filter-select" style={{ width: 130 }} value={movAte} onChange={e => setMovAte(e.target.value)} />
                            </label>
                        </div>

                        <div className="stats-row" style={{ marginBottom: 16 }}>
                            {[
                                { label: 'Total',          value: filtMovimentos.length },
                                { label: 'Entradas',       value: filtMovimentos.filter(m => m.tipo === 'Entrada').length,  cls: 'green'  },
                                { label: 'Saídas',         value: filtMovimentos.filter(m => m.tipo === 'Saída').length,    cls: 'muted'  },
                                { label: 'Outros',         value: filtMovimentos.filter(m => m.tipo !== 'Entrada' && m.tipo !== 'Saída').length, cls: 'blue' },
                            ].map(s => (
                                <div key={s.label} className="stat-card">
                                    <span className="stat-label">{s.label}</span>
                                    <span className={`stat-value ${(s as any).cls ?? ''}`}>{s.value}</span>
                                </div>
                            ))}
                        </div>

                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Data</th><th>Tipo</th><th>Código</th><th>Artigo</th>
                                        <th>Armazém</th><th style={{ textAlign: 'right' }}>Quantidade</th>
                                        <th>Origem</th><th>Utilizador</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtMovimentos.length === 0 && <tr><td colSpan={8}><div className="empty-state">Sem resultados.</div></td></tr>}
                                    {filtMovimentos.map((m, i) => (
                                        <tr key={i}>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{m.data}</td>
                                            <td><span style={{ fontSize: '0.75rem', fontWeight: 700, color: TIPO_MOV_COLOR[m.tipo] ?? 'var(--text-primary)' }}>{m.tipo}</span></td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.codigo}</td>
                                            <td style={{ fontSize: '0.8rem' }}>{m.artigo}</td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{m.armazem}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: m.quantidade > 0 ? 'var(--green)' : 'var(--red)', fontSize: '0.82rem' }}>
                                                {m.quantidade > 0 ? '+' : ''}{m.quantidade}
                                            </td>
                                            <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{m.origem}</td>
                                            <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.utilizador}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="table-count">{filtMovimentos.length} movimentos</div>
                        </div>
                    </>
                )}
            </div>

            {/* Export modal */}
            {showExport && (
                <ExportModal
                    title={tabLabel}
                    columns={COLS[tab]}
                    data={exportData[tab]}
                    filename={`relatorio_${tab}`}
                    onClose={() => setShowExport(false)}
                />
            )}
        </AppLayout>
    );
};

export default RelatoriosPage;
