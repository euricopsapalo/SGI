import React from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import { useGlobal } from '../../contexts/GlobalContext';
import {
    AlertTriangle, CheckCircle2, Clock, ClipboardList,
    TrendingUp, Users, Package, Wrench, FileText, ShoppingCart,
} from 'lucide-react';
import { useResumoFaturacao } from '../../utils/useResumoFaturacao';
import { faturadoNoMes, recebidoNoMes } from '../../utils/faturacaoResumo';

const DashboardPage: React.FC = () => {
    const { ordens, clientes, tecnicos, artigos, equipInstalados, encomendas, currentUser, fmtMoney } = useGlobal();

    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.slice(0, 7);

    const isTecnicoCampo = currentUser?.role === 'Técnico de Campo';
    // #206 — faturação a partir dos documentos de venda e das liquidações (não da tabela antiga `faturas`).
    const { resumo, liquidacoes } = useResumoFaturacao(!isTecnicoCampo);
    const minhasOrdens = isTecnicoCampo
        ? ordens.filter(o => o.responsavel === (currentUser?.tecnicoNome ?? currentUser?.nome))
        : ordens;

    // KPIs
    const programadas   = minhasOrdens.filter(o => o.estado === 'Programada' || o.estado === 'Registada' || o.estado === 'Adiada' || o.estado === 'Confirmada').length;
    const emCurso       = minhasOrdens.filter(o => o.estado === 'Em execução').length;
    const terminadasMes = minhasOrdens.filter(o => o.estado === 'Finalizada' && o.dataFim?.startsWith(thisMonth)).length;
    const manutUrgente  = equipInstalados.filter(e => {
        // Próxima manutenção deriva das OTs em aberto (mesma fonte do ecrã Parque),
        // não da coluna persistida dataProximaManutencao, que nunca é preenchida (#92).
        const openDates = ordens
            .filter(o => String(o.equipInstaladoId) === String(e.id) && o.estado !== 'Finalizada')
            .map(o => o.dataAgendada)
            .filter(Boolean) as string[];
        if (openDates.length === 0) return false;
        const prox = [...openDates].sort()[0];
        const diff = Math.round((new Date(prox).getTime() - Date.now()) / 86400000);
        return diff <= 7 && diff >= 0;
    }).length;

    // Alertas
    const artigosAbaixo = artigos.filter(a => a.critico && a.existencia <= a.stockSeguranca);
    const semStock      = artigos.filter(a => a.existencia === 0);
    const otAtrasadas   = minhasOrdens.filter(o => (o.estado === 'Programada' || o.estado === 'Confirmada') && o.dataAgendada && o.dataAgendada < today);
    const fatPendentes  = resumo.filter(f => f.emAberto).length;
    const encAbertas    = encomendas.filter(e => e.estado === 'Aberta' || e.estado === 'Parcial').length;

    const alertas: { msg: string; tipo: 'error' | 'warning' | 'info' }[] = [
        ...otAtrasadas.map(o => ({ msg: `OT ${o.id} (${o.naturezaIntervencao ?? "—"}) — data programada já passou`, tipo: 'error' as const })),
        ...(!isTecnicoCampo ? artigosAbaixo.map(a => ({ msg: `Stock crítico: ${a.descricao} (${a.existencia} / ${a.stockSeguranca})`, tipo: 'error' as const })) : []),
        ...(!isTecnicoCampo ? semStock.map(a => ({ msg: `Sem stock: ${a.descricao}`, tipo: 'warning' as const })) : []),
        ...(manutUrgente > 0 ? [{ msg: `${manutUrgente} equipamento(s) com manutenção urgente (≤7 dias)`, tipo: 'warning' as const }] : []),
        ...(!isTecnicoCampo && fatPendentes > 0 ? [{ msg: `${fatPendentes} fatura(s) pendentes de pagamento`, tipo: 'info' as const }] : []),
        ...(!isTecnicoCampo && encAbertas > 0   ? [{ msg: `${encAbertas} encomenda(s) a fornecedores em aberto`, tipo: 'info' as const }] : []),
    ].slice(0, 8);

    const otRecentes = [...minhasOrdens]
        .sort((a, b) => (b.dataAgendada ?? '').localeCompare(a.dataAgendada ?? ''))
        .slice(0, 6);

    const DOT: Record<string, string> = {
        'Registada': 'dot-gray', 'Programada': 'dot-blue', 'Adiada': 'dot-orange',
        'Confirmada': 'dot-purple', 'Em execução': 'dot-yellow', 'Finalizada': 'dot-green',
    };
    const getClienteNome = (id: string) => clientes.find(c => c.id === id)?.nome ?? id;

    const campoTecs = isTecnicoCampo
        ? tecnicos.filter(t => t.ativo && t.id === currentUser?.tecnicoId)
        : tecnicos.filter(t => t.ativo);
    const otHoje = minhasOrdens.filter(o => o.dataAgendada === today);

    const totalFaturado   = faturadoNoMes(resumo, thisMonth);
    const totalFatPagas   = recebidoNoMes(liquidacoes, thisMonth);
    const artigosAtivos   = artigos.filter(a => !a.inativo).length;

    // Resumo mini-cards
    const resumoCards = isTecnicoCampo ? [
        { label: 'OT Terminadas', value: String(terminadasMes), sub: 'este mês',         icon: <CheckCircle2 size={16} />, color: 'var(--green)' },
        { label: 'Em Curso',      value: String(emCurso),       sub: 'em progresso',     icon: <Wrench size={16} />,       color: 'var(--orange)' },
        { label: 'Programadas',   value: String(programadas),   sub: 'aguardam início',  icon: <Clock size={16} />,        color: 'var(--blue)' },
        { label: 'Atrasadas',     value: String(otAtrasadas.length), sub: 'data ultrapassada', icon: <AlertTriangle size={16} />, color: 'var(--red)' },
    ] : [
        { label: 'OT Terminadas',    value: String(terminadasMes),      sub: 'este mês',       icon: <CheckCircle2 size={16} />, color: 'var(--green)' },
        { label: 'Faturação emitida',value: fmtMoney(totalFaturado),    sub: 'este mês',       icon: <FileText size={16} />,     color: 'var(--blue)' },
        { label: 'Faturação recebida',value: fmtMoney(totalFatPagas),   sub: 'recebido este mês',       icon: <TrendingUp size={16} />,   color: totalFatPagas > 0 ? 'var(--green)' : 'var(--text-muted)' },
        { label: 'Clientes activos', value: String(clientes.filter(c => c.ativo).length), sub: 'em carteira', icon: <Users size={16} />, color: 'var(--blue)' },
        { label: 'Artigos em stock', value: String(artigosAtivos),      sub: `${semStock.length} sem stock`, icon: <Package size={16} />, color: semStock.length > 0 ? 'var(--orange)' : 'var(--text-muted)' },
        { label: 'Encomendas abertas',value: String(encAbertas),        sub: 'a fornecedores', icon: <ShoppingCart size={16} />, color: encAbertas > 0 ? 'var(--orange)' : 'var(--text-muted)' },
    ];

    const panelHdr = (title: React.ReactNode, action?: React.ReactNode) => (
        <div className="panel-header" style={{ borderRadius: '4px 4px 0 0', border: '1px solid var(--panel-border)', borderBottom: 'none' }}>
            <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{title}</span>
            {action}
        </div>
    );

    return (
        <AppLayout>
            <ActionBar title="Dashboard" breadcrumb="AQUATEX SGI · Início">
                <div className="actionbar-spacer" />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
            </ActionBar>

            <div className="page-content">
                {/* ── KPI row ── */}
                <div className="stats-row" style={{ marginBottom: 16 }}>
                    {[
                        { label: 'OT Programadas',      value: programadas,    sub: 'aguardam execução', dot: 'dot-blue' },
                        { label: 'Em Curso',             value: emCurso,        sub: 'em progresso',      dot: 'dot-orange' },
                        { label: 'Terminadas (mês)',     value: terminadasMes,  sub: 'concluídas no mês', dot: 'dot-green' },
                        { label: 'Manutenções Urgentes', value: manutUrgente,   sub: '≤ 7 dias',          dot: 'dot-red' },
                    ].map(k => (
                        <div key={k.label} className="stat-card">
                            <span className="stat-label">{k.label}</span>
                            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 }}>
                                <span className="stat-value blue">{k.value}</span>
                                <span className={`dot ${k.dot}`} style={{ width: 12, height: 12, marginBottom: 4 }} />
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{k.sub}</div>
                        </div>
                    ))}
                </div>

                {/* ── Main grid — named areas ── */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr',
                    gridTemplateRows: 'auto auto',
                    gap: 16,
                }}>
                    {/* OTs recentes — wide top-left */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {panelHdr(
                            <><ClipboardList size={14} /> Ordens de Trabalho Recentes</>,
                            <a href="/ordens" style={{ fontSize: '0.74rem', color: 'var(--text-link)' }}>Ver todas →</a>
                        )}
                        <div className="table-container" style={{ borderRadius: '0 0 4px 4px', flex: 1 }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 20 }} />
                                        <th>OT</th><th>Tipo</th><th>Cliente</th><th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {otRecentes.length === 0 ? (
                                        <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>Sem ordens de trabalho.</td></tr>
                                    ) : otRecentes.map(ot => (
                                        <tr key={ot.id}>
                                            <td style={{ paddingLeft: 10 }}><span className={`dot ${DOT[ot.estado] ?? 'dot-gray'}`} /></td>
                                            <td><span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--blue)', fontWeight: 600 }}>{ot.id}</span></td>
                                            <td style={{ fontSize: '0.78rem' }}>{ot.naturezaIntervencao}</td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{getClienteNome(ot.clienteId)}</td>
                                            <td style={{ fontSize: '0.76rem' }}>{ot.estado}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Alertas — narrow top-right */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {panelHdr(<><AlertTriangle size={14} /> Alertas do Sistema</>)}
                        <div className="panel" style={{ borderRadius: '0 0 4px 4px', flex: 1 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: 10 }}>
                                {alertas.length === 0 ? (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 8px' }}>
                                        <CheckCircle2 size={20} style={{ marginBottom: 4, color: 'var(--green)', display: 'block', margin: '0 auto 6px' }} />
                                        Sem alertas activos.
                                    </div>
                                ) : alertas.map((a, i) => (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 7,
                                        padding: '6px 8px',
                                        background: a.tipo === 'error' ? 'var(--red-bg)' : a.tipo === 'warning' ? 'var(--orange-bg)' : 'var(--blue-s-bg)',
                                        border: `1px solid ${a.tipo === 'error' ? '#FFCDD2' : a.tipo === 'warning' ? '#FFCC80' : 'var(--blue-border)'}`,
                                        borderRadius: 3, fontSize: '0.75rem',
                                        color: a.tipo === 'error' ? 'var(--red)' : a.tipo === 'warning' ? 'var(--orange)' : 'var(--blue-s)',
                                    }}>
                                        {a.tipo === 'error'   ? <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                                         : a.tipo === 'warning' ? <Clock size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                                         : <CheckCircle2 size={12} style={{ flexShrink: 0, marginTop: 1 }} />}
                                        {a.msg}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Resumo mensal — wide bottom-left (mini-cards 2×3) */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {panelHdr(<><TrendingUp size={14} /> Resumo Mensal</>)}
                        <div className="panel" style={{ borderRadius: '0 0 4px 4px', flex: 1 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, padding: 12 }}>
                                {resumoCards.map(r => (
                                    <div key={r.label} style={{
                                        display: 'flex', flexDirection: 'column', gap: 4,
                                        padding: '12px 14px', borderRadius: 6,
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-light)',
                                    }}>
                                        <div style={{ color: r.color, display: 'flex', alignItems: 'center', gap: 5 }}>
                                            {r.icon}
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{r.label}</span>
                                        </div>
                                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: r.color, lineHeight: 1 }}>{r.value}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{r.sub}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Técnicos hoje — narrow bottom-right */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {panelHdr(
                            <><Users size={14} /> Técnicos de Campo — Hoje</>,
                            <a href="/agenda" style={{ fontSize: '0.74rem', color: 'var(--text-link)' }}>Agenda →</a>
                        )}
                        <div className="table-container" style={{ borderRadius: '0 0 4px 4px', flex: 1 }}>
                            <table className="data-table">
                                <thead>
                                    <tr><th>Técnico</th><th style={{ width: 50, textAlign: 'center' }}>OT</th><th>Estado</th></tr>
                                </thead>
                                <tbody>
                                    {campoTecs.length === 0 ? (
                                        <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16 }}>Sem técnicos activos.</td></tr>
                                    ) : campoTecs.map(t => {
                                        const cnt = otHoje.filter(o => o.responsavel === t.nome).length;
                                        return (
                                            <tr key={t.id}>
                                                <td><span className="user-cell">
                                                    <span className="user-avatar" style={{ width: 26, height: 26, fontSize: '0.65rem', background: cnt === 0 ? 'var(--border-dark)' : 'var(--blue)' }}>
                                                        {t.nome.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                                                    </span>
                                                    {t.nome}
                                                </span></td>
                                                <td style={{ textAlign: 'center', fontWeight: 700, color: cnt === 0 ? 'var(--text-muted)' : 'var(--blue)' }}>{cnt}</td>
                                                <td style={{ fontSize: '0.76rem', color: cnt === 0 ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                                                    {cnt === 0 ? 'Disponível' : `${cnt} intervenção(ões)`}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};

export default DashboardPage;
