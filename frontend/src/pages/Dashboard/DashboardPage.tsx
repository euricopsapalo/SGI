import React from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import {
    AlertTriangle, CheckCircle2, Clock, ClipboardList,
    TrendingUp, Users, Wrench, Calendar,
} from 'lucide-react';

/* ── Mock data ── */
const KPI_DATA = [
    { label: 'OS Abertas', value: 14, color: '--orange', dot: 'dot-orange' },
    { label: 'OS Concluídas (mês)', value: 37, color: '--blue', dot: 'dot-blue' },
    { label: 'Em Execução', value: 6, color: '--green', dot: 'dot-green' },
    { label: 'Manutenções a Vencer', value: 5, color: 'var(--red)', dot: 'dot-red' },
];

const OS_RECENTES = [
    { id: 'OS-0808', tipo: 'Preventiva', cliente: 'Empresa Alpha', tecnico: 'Bruno Cunha', estado: 'Em execução', data: '06/03/2026', cor: 'dot-blue' },
    { id: 'OS-0807', tipo: 'Corretiva', cliente: 'Hotel Marina', tecnico: 'Fátima Rodrigues', estado: 'Aberta', data: '06/03/2026', cor: 'dot-orange' },
    { id: 'OS-0806', tipo: 'Preventiva', cliente: 'Clínica São Jo', tecnico: 'Bruno Cunha', estado: 'Concluída', data: '05/03/2026', cor: 'dot-green' },
    { id: 'OS-0805', tipo: 'Montagem', cliente: 'GlobalTrade SA', tecnico: 'Joana Tavares', estado: 'Concluída', data: '05/03/2026', cor: 'dot-green' },
    { id: 'OS-0804', tipo: 'Remota', cliente: 'Escola Nação', tecnico: 'Carla Mendes', estado: 'Aberta', data: '04/03/2026', cor: 'dot-orange' },
];

const ALERTAS = [
    { msg: 'Máquina WP-0023 — manutenção preventiva em 3 dias', tipo: 'warning' },
    { msg: 'Máquina NTR-0051 — manutenção preventiva em 7 dias', tipo: 'warning' },
    { msg: 'OS-0807 atribuída sem técnico de campo', tipo: 'error' },
    { msg: 'Stock de Filtro AR G010 abaixo do mínimo (2 un.)', tipo: 'error' },
    { msg: '5 OS concluídas aguardam faturação', tipo: 'info' },
];

const TECNICOS_AGENDA = [
    { nome: 'Bruno Cunha', os: 3, hoje: 'Preventiva × 2, Corretiva × 1' },
    { nome: 'Fátima Rodrigues', os: 2, hoje: 'Montagem × 1, Preventiva × 1' },
    { nome: 'Joana Tavares', os: 2, hoje: 'Corretiva × 2' },
    { nome: 'Gabriel Teixeira', os: 0, hoje: '—' },
];

/* ── Components ── */
const KpiCard: React.FC<{ label: string; value: number; dot: string }> = ({ label, value, dot }) => (
    <div className="panel" style={{ flex: 1, minWidth: 140 }}>
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
                <div className="stat-label">{label}</div>
                <div className="stat-value" style={{ marginTop: 2 }}>{value}</div>
            </div>
            <span className={`dot ${dot}`} style={{ width: 14, height: 14 }} />
        </div>
    </div>
);

/* ════════════════════════════════════════════════ */
const DashboardPage: React.FC = () => (
    <AppLayout>
        <ActionBar title="Dashboard" breadcrumb="AQUATEX SGI · Início">
            <div className="actionbar-spacer" />
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Actualizado: 06/03/2026 09:00</span>
        </ActionBar>

        <div className="page-content">

            {/* KPIs */}
            <div className="stats-row">
                {KPI_DATA.map(k => <KpiCard key={k.label} label={k.label} value={k.value} dot={k.dot} />)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

                {/* OS Recentes */}
                <div>
                    <div className="panel-header" style={{ borderRadius: '4px 4px 0 0', border: '1px solid var(--panel-border)', borderBottom: 'none' }}>
                        <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ClipboardList size={14} /> Ordens de Serviço Recentes
                        </span>
                        <a href="/ordens" style={{ fontSize: '0.74rem', color: 'var(--text-link)' }}>Ver todas →</a>
                    </div>
                    <div className="table-container" style={{ borderRadius: '0 0 4px 4px' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 20 }} />
                                    <th>Código</th>
                                    <th>Tipo</th>
                                    <th>Cliente</th>
                                    <th>Estado</th>
                                    <th>Data</th>
                                </tr>
                            </thead>
                            <tbody>
                                {OS_RECENTES.map(os => (
                                    <tr key={os.id}>
                                        <td style={{ paddingLeft: 10 }}><span className={`dot ${os.cor}`} /></td>
                                        <td><span className="td-link">{os.id}</span></td>
                                        <td style={{ fontSize: '0.78rem' }}>{os.tipo}</td>
                                        <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{os.cliente}</td>
                                        <td style={{ fontSize: '0.76rem' }}>{os.estado}</td>
                                        <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{os.data}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Alertas */}
                <div>
                    <div className="panel-header" style={{ borderRadius: '4px 4px 0 0', border: '1px solid var(--panel-border)', borderBottom: 'none' }}>
                        <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <AlertTriangle size={14} /> Alertas do Sistema
                        </span>
                    </div>
                    <div className="panel" style={{ borderRadius: '0 0 4px 4px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12 }}>
                            {ALERTAS.map((a, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'flex-start', gap: 8,
                                    padding: '7px 10px',
                                    background: a.tipo === 'error' ? 'var(--red-bg)' : a.tipo === 'warning' ? 'var(--orange-bg)' : 'var(--blue-s-bg)',
                                    border: `1px solid ${a.tipo === 'error' ? '#FFCDD2' : a.tipo === 'warning' ? '#FFCC80' : 'var(--blue-border)'}`,
                                    borderRadius: 3,
                                    fontSize: '0.78rem',
                                    color: a.tipo === 'error' ? 'var(--red)' : a.tipo === 'warning' ? 'var(--orange)' : 'var(--blue-s)',
                                }}>
                                    {a.tipo === 'error'
                                        ? <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                                        : a.tipo === 'warning'
                                            ? <Clock size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                                            : <CheckCircle2 size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                                    }
                                    {a.msg}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Técnicos hoje */}
                <div>
                    <div className="panel-header" style={{ borderRadius: '4px 4px 0 0', border: '1px solid var(--panel-border)', borderBottom: 'none' }}>
                        <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Users size={14} /> Técnicos de Campo — Hoje
                        </span>
                        <a href="/agenda" style={{ fontSize: '0.74rem', color: 'var(--text-link)' }}>Agenda →</a>
                    </div>
                    <div className="table-container" style={{ borderRadius: '0 0 4px 4px' }}>
                        <table className="data-table">
                            <thead>
                                <tr><th>Técnico</th><th style={{ width: 50, textAlign: 'center' }}>OS</th><th>Intervenções</th></tr>
                            </thead>
                            <tbody>
                                {TECNICOS_AGENDA.map(t => (
                                    <tr key={t.nome}>
                                        <td><span className="user-cell">
                                            <span className="user-avatar" style={{ width: 26, height: 26, fontSize: '0.65rem', background: t.os === 0 ? 'var(--border-dark)' : 'var(--blue)' }}>
                                                {t.nome.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                            </span>
                                            {t.nome}
                                        </span></td>
                                        <td style={{ textAlign: 'center', fontWeight: 700, color: t.os === 0 ? 'var(--text-muted)' : 'var(--blue)' }}>{t.os}</td>
                                        <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{t.hoje}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Resumo mensal */}
                <div>
                    <div className="panel-header" style={{ borderRadius: '4px 4px 0 0', border: '1px solid var(--panel-border)', borderBottom: 'none' }}>
                        <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <TrendingUp size={14} /> Resumo Março 2026
                        </span>
                    </div>
                    <div className="panel" style={{ borderRadius: '0 0 4px 4px' }}>
                        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[
                                { label: 'OS Concluídas', value: '37', sub: 'Montagem:12 · Prev.:18 · Cor.:5 · Remote:2' },
                                { label: 'Faturação emitida', value: 'Kz 8.240.000', sub: '32 faturas emitidas' },
                                { label: 'Comissões técnicos', value: 'Kz 350.600', sub: '14 técnicos no mês' },
                                { label: 'Novos Clientes', value: '4', sub: 'Total activos: 147' },
                            ].map(r => (
                                <div key={r.label} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '7px 0', borderBottom: '1px solid var(--border-light)',
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{r.label}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{r.sub}</div>
                                    </div>
                                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--blue)' }}>{r.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </AppLayout>
);

export default DashboardPage;
