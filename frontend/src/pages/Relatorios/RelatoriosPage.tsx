import React, { useState } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import { BarChart3, TrendingUp, Users, Download } from 'lucide-react';

type RelTab = 'faturacao' | 'comissoes' | 'produtividade';

const TABS: { id: RelTab; label: string; icon: React.FC<any> }[] = [
    { id: 'faturacao', label: 'Faturação Mensal', icon: BarChart3 },
    { id: 'comissoes', label: 'Comissões', icon: TrendingUp },
    { id: 'produtividade', label: 'Produtividade Técnicos', icon: Users },
];

const FATURACAO_MENSAL = [
    { mes: 'Set 2025', os: 28, montagem: 620000, preventiva: 300000, corretiva: 210000, total: 1130000 },
    { mes: 'Out 2025', os: 31, montagem: 450000, preventiva: 340000, corretiva: 180000, total: 970000 },
    { mes: 'Nov 2025', os: 35, montagem: 780000, preventiva: 280000, corretiva: 220000, total: 1280000 },
    { mes: 'Dez 2025', os: 29, montagem: 350000, preventiva: 320000, corretiva: 140000, total: 810000 },
    { mes: 'Jan 2026', os: 33, montagem: 560000, preventiva: 360000, corretiva: 190000, total: 1110000 },
    { mes: 'Fev 2026', os: 38, montagem: 890000, preventiva: 390000, corretiva: 260000, total: 1540000 },
    { mes: 'Mar 2026', os: 37, montagem: 950000, preventiva: 340000, corretiva: 195000, total: 1485000 },
];

const COMISSOES = [
    { nome: 'Bruno Cunha', tipo: 'Técnico Campo', os: 18, montagem: 3, preventiva: 10, corretiva: 5, total: 960000 },
    { nome: 'Fátima Rodrigues', tipo: 'Técnico Campo', os: 14, montagem: 2, preventiva: 8, corretiva: 4, total: 720000 },
    { nome: 'Joana Tavares', tipo: 'Técnico Campo', os: 12, montagem: 5, preventiva: 5, corretiva: 2, total: 730000 },
    { nome: 'Gabriel Teixeira', tipo: 'Técnico Campo', os: 6, montagem: 0, preventiva: 4, corretiva: 2, total: 280000 },
    { nome: 'Daniel Nkosi', tipo: 'Vendedor', os: 8, montagem: 8, preventiva: 0, corretiva: 0, total: 385000 },
];

const PRODUTIVIDADE = [
    { nome: 'Bruno Cunha', osMes: 18, concluidas: 17, canceladas: 1, tempMedio: '2h 10min', satisfacao: 4.8 },
    { nome: 'Fátima Rodrigues', osMes: 14, concluidas: 14, canceladas: 0, tempMedio: '2h 35min', satisfacao: 4.9 },
    { nome: 'Joana Tavares', osMes: 12, concluidas: 11, canceladas: 1, tempMedio: '3h 00min', satisfacao: 4.6 },
    { nome: 'Gabriel Teixeira', osMes: 6, concluidas: 5, canceladas: 1, tempMedio: '2h 50min', satisfacao: 4.2 },
];

const RelatoriosPage: React.FC = () => {
    const [tab, setTab] = useState<RelTab>('faturacao');

    const maxTotal = Math.max(...FATURACAO_MENSAL.map(m => m.total));

    return (
        <AppLayout>
            <ActionBar title="Relatórios" breadcrumb="AQUATEX SGI · Relatórios">
                <div className="actionbar-spacer" />
                <button className="abtn abtn-secondary" type="button"><Download size={13} /> Exportar PDF</button>
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

                {/* FATURAÇÃO */}
                {tab === 'faturacao' && (
                    <>
                        <div className="stats-row" style={{ marginBottom: 16 }}>
                            {[
                                { label: 'Total 2026 (acum.)', value: 'Kz 5.925.000' },
                                { label: 'Média mensal', value: 'Kz 1.185.000' },
                                { label: 'Melhor mês', value: 'Mar 2026' },
                                { label: 'OS Faturadas (2026)', value: '135' },
                            ].map(s => (
                                <div key={s.label} className="stat-card">
                                    <span className="stat-label">{s.label}</span>
                                    <span className="stat-value blue" style={{ fontSize: '1rem' }}>{s.value}</span>
                                </div>
                            ))}
                        </div>

                        {/* Bar chart */}
                        <div className="panel" style={{ marginBottom: 16 }}>
                            <div className="panel-header"><span className="panel-title">Faturação Mensal (Kz)</span></div>
                            <div className="panel-body">
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160 }}>
                                    {FATURACAO_MENSAL.map(m => (
                                        <div key={m.mes} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--blue)' }}>
                                                {(m.total / 1000).toFixed(0)}K
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
                                                {[
                                                    { v: m.montagem, c: 'var(--blue)' },
                                                    { v: m.preventiva, c: 'var(--green)' },
                                                    { v: m.corretiva, c: 'var(--orange)' },
                                                ].map((bar, bi) => (
                                                    <div key={bi} style={{
                                                        width: 10, borderRadius: '2px 2px 0 0',
                                                        height: `${(bar.v / maxTotal) * 120}px`,
                                                        background: bar.c,
                                                        transition: 'height 300ms',
                                                    }} />
                                                ))}
                                            </div>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap' }}>
                                                {m.mes}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
                                    {[['Montagem', 'var(--blue)'], ['Preventiva', 'var(--green)'], ['Corretiva', 'var(--orange)']].map(([l, c]) => (
                                        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            <span style={{ width: 10, height: 10, background: c, borderRadius: 2, display: 'inline-block' }} />
                                            {l}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr><th>Mês</th><th style={{ textAlign: 'center' }}>OS</th><th style={{ textAlign: 'right' }}>Montagem</th><th style={{ textAlign: 'right' }}>Preventiva</th><th style={{ textAlign: 'right' }}>Corretiva</th><th style={{ textAlign: 'right', fontWeight: 800 }}>Total (Kz)</th></tr>
                                </thead>
                                <tbody>
                                    {FATURACAO_MENSAL.map(m => (
                                        <tr key={m.mes}>
                                            <td style={{ fontWeight: 700 }}>{m.mes}</td>
                                            <td style={{ textAlign: 'center', color: 'var(--blue)', fontWeight: 700 }}>{m.os}</td>
                                            <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>{m.montagem.toLocaleString('pt-PT')}</td>
                                            <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>{m.preventiva.toLocaleString('pt-PT')}</td>
                                            <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>{m.corretiva.toLocaleString('pt-PT')}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--blue)' }}>{m.total.toLocaleString('pt-PT')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* COMISSÕES */}
                {tab === 'comissoes' && (
                    <>
                        <div className="stats-row" style={{ marginBottom: 16 }}>
                            {[
                                { label: 'Total Comissões (mês)', value: 'Kz 3.075.000' },
                                { label: 'Técnicos Activos', value: '4' },
                                { label: 'Vendedores Activos', value: '1' },
                            ].map(s => (
                                <div key={s.label} className="stat-card">
                                    <span className="stat-label">{s.label}</span>
                                    <span className="stat-value blue" style={{ fontSize: '1rem' }}>{s.value}</span>
                                </div>
                            ))}
                        </div>
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr><th>Nome</th><th>Perfil</th><th style={{ textAlign: 'center' }}>OS</th><th style={{ textAlign: 'center' }}>Montagem</th><th style={{ textAlign: 'center' }}>Preventiva</th><th style={{ textAlign: 'center' }}>Corretiva</th><th style={{ textAlign: 'right', fontWeight: 800 }}>Total (Kz)</th></tr>
                                </thead>
                                <tbody>
                                    {COMISSOES.map(c => (
                                        <tr key={c.nome}>
                                            <td style={{ fontWeight: 700 }}>{c.nome}</td>
                                            <td><span className={c.tipo === 'Vendedor' ? 'tbadge tbadge-vendedor' : 'tbadge tbadge-campo'}>{c.tipo}</span></td>
                                            <td style={{ textAlign: 'center', color: 'var(--blue)', fontWeight: 700 }}>{c.os}</td>
                                            <td style={{ textAlign: 'center' }}>{c.montagem}</td>
                                            <td style={{ textAlign: 'center' }}>{c.preventiva}</td>
                                            <td style={{ textAlign: 'center' }}>{c.corretiva}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--green)' }}>{c.total.toLocaleString('pt-PT')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* PRODUTIVIDADE */}
                {tab === 'produtividade' && (
                    <>
                        <div className="stats-row" style={{ marginBottom: 16 }}>
                            {[
                                { label: 'Total OS (mês)', value: PRODUTIVIDADE.reduce((s, t) => s + t.osMes, 0) },
                                { label: 'Concluídas', value: PRODUTIVIDADE.reduce((s, t) => s + t.concluidas, 0), cls: 'green' },
                                { label: 'Canceladas', value: PRODUTIVIDADE.reduce((s, t) => s + t.canceladas, 0), cls: 'muted' },
                                { label: 'Satisfação Média', value: (PRODUTIVIDADE.reduce((s, t) => s + t.satisfacao, 0) / PRODUTIVIDADE.length).toFixed(1) + ' ★', cls: 'blue' },
                            ].map(s => (
                                <div key={s.label} className="stat-card">
                                    <span className="stat-label">{s.label}</span>
                                    <span className={`stat-value ${(s as any).cls || ''}`}>{s.value}</span>
                                </div>
                            ))}
                        </div>
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr><th>Técnico</th><th style={{ textAlign: 'center' }}>OS no Mês</th><th style={{ textAlign: 'center' }}>Concluídas</th><th style={{ textAlign: 'center' }}>Canceladas</th><th style={{ textAlign: 'center' }}>Tempo Médio</th><th style={{ textAlign: 'center' }}>Satisfação</th></tr>
                                </thead>
                                <tbody>
                                    {PRODUTIVIDADE.map(t => (
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
                        </div>
                    </>
                )}
            </div>
        </AppLayout>
    );
};

export default RelatoriosPage;
