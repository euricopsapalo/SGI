import React from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import { useGlobal } from '../../contexts/GlobalContext';
import {
    AlertTriangle, CheckCircle2, Clock, ClipboardList,
    TrendingUp, Users, Package,
} from 'lucide-react';

const fmtMoney = (v: number) => v.toLocaleString('pt-PT') + ' AOA';

const DashboardPage: React.FC = () => {
    const { ordens, clientes, tecnicos, artigos, faturas, equipInstalados, encomendas, currentUser } = useGlobal();

    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.slice(0, 7);

    const isTecnicoCampo = currentUser?.role === 'Técnico de Campo';
    // For técnico de campo: scope all OT stats to their own orders
    const minhasOrdens = isTecnicoCampo
        ? ordens.filter(o => o.responsavel === (currentUser?.tecnicoNome ?? currentUser?.nome))
        : ordens;

    // KPIs
    const programadas    = minhasOrdens.filter(o => o.estado === 'Programado').length;
    const emCurso        = minhasOrdens.filter(o => o.estado === 'Em curso').length;
    const terminadasMes  = minhasOrdens.filter(o => o.estado === 'Terminado' && o.dataFim?.startsWith(thisMonth)).length;
    const manutUrgente   = equipInstalados.filter(e => {
        if (!e.dataProximaManutencao) return false;
        const diff = Math.round((new Date(e.dataProximaManutencao).getTime() - Date.now()) / 86400000);
        return diff <= 7 && diff >= 0;
    }).length;

    // Alertas
    const artigosAbaixo  = artigos.filter(a => a.critico && a.existencia <= a.stockSeguranca);
    const semStock       = artigos.filter(a => a.existencia === 0);
    const otAtrasadas    = minhasOrdens.filter(o => o.estado === 'Programado' && o.dataProgInicio && o.dataProgInicio < today);
    const fatPendentes   = faturas.filter(f => f.estado === 'Pendente').length;
    const encAbertas     = encomendas.filter(e => e.estado === 'Aberta' || e.estado === 'Parcial').length;

    const alertas: { msg: string; tipo: 'error' | 'warning' | 'info' }[] = [
        ...otAtrasadas.map(o => ({ msg: `OT ${o.id} (${o.tipoTrabalho}) — data programada já passou`, tipo: 'error' as const })),
        ...(!isTecnicoCampo ? artigosAbaixo.map(a => ({ msg: `Stock crítico: ${a.descricao} (${a.existencia} / ${a.stockSeguranca})`, tipo: 'error' as const })) : []),
        ...(!isTecnicoCampo ? semStock.map(a => ({ msg: `Sem stock: ${a.descricao}`, tipo: 'warning' as const })) : []),
        ...(manutUrgente > 0 ? [{ msg: `${manutUrgente} equipamento(s) com manutenção urgente (≤7 dias)`, tipo: 'warning' as const }] : []),
        ...(!isTecnicoCampo && fatPendentes > 0 ? [{ msg: `${fatPendentes} fatura(s) pendentes de pagamento`, tipo: 'info' as const }] : []),
        ...(!isTecnicoCampo && encAbertas > 0   ? [{ msg: `${encAbertas} encomenda(s) a fornecedores em aberto`, tipo: 'info' as const }] : []),
    ].slice(0, 7);

    // OTs recentes (filtradas por utilizador se técnico de campo)
    const otRecentes = [...minhasOrdens]
        .sort((a, b) => (b.dataEmissao ?? b.dataProgInicio ?? '').localeCompare(a.dataEmissao ?? a.dataProgInicio ?? ''))
        .slice(0, 5);

    const DOT: Record<string, string> = {
        'Programado': 'dot-blue', 'Em curso': 'dot-orange', 'Terminado': 'dot-green', 'Encerrado': 'dot-gray',
    };

    const getClienteNome = (id: string) => clientes.find(c => c.id === id)?.nome ?? id;

    // Técnicos activos com OTs hoje
    const campoTecs = isTecnicoCampo
        ? tecnicos.filter(t => t.ativo && t.id === currentUser?.tecnicoId)
        : tecnicos.filter(t => t.ativo);
    const otHoje = minhasOrdens.filter(o => o.dataProgInicio === today);

    // Resumo mensal
    const totalFaturado    = faturas.filter(f => f.dataEmissao.startsWith(thisMonth)).reduce((s, f) => s + f.valorTotal, 0);
    const totalFatPagas    = faturas.filter(f => f.estado === 'Paga' && f.dataEmissao.startsWith(thisMonth)).reduce((s, f) => s + f.valorTotal, 0);
    const novosClientesMes = clientes.filter(c => c.ativo).length;

    return (
        <AppLayout>
            <ActionBar title="Dashboard" breadcrumb="AQUATEX SGI · Início">
                <div className="actionbar-spacer" />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
            </ActionBar>

            <div className="page-content">
                {/* KPIs */}
                <div className="stats-row">
                    {[
                        { label: 'OT Programadas', value: programadas, dot: 'dot-blue' },
                        { label: 'Em Curso',        value: emCurso,     dot: 'dot-orange' },
                        { label: 'Terminadas (mês)', value: terminadasMes, dot: 'dot-green' },
                        { label: 'Manutenções Urgentes', value: manutUrgente, dot: 'dot-red' },
                    ].map(k => (
                        <div key={k.label} className="stat-card">
                            <span className="stat-label">{k.label}</span>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                                <span className="stat-value blue">{k.value}</span>
                                <span className={`dot ${k.dot}`} style={{ width: 12, height: 12 }} />
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>

                    {/* OTs recentes */}
                    <div>
                        <div className="panel-header" style={{ borderRadius: '4px 4px 0 0', border: '1px solid var(--panel-border)', borderBottom: 'none' }}>
                            <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <ClipboardList size={14} /> Ordens de Trabalho Recentes
                            </span>
                            <a href="/ordens" style={{ fontSize: '0.74rem', color: 'var(--text-link)' }}>Ver todas →</a>
                        </div>
                        <div className="table-container" style={{ borderRadius: '0 0 4px 4px' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 20 }} />
                                        <th>OT</th>
                                        <th>Tipo</th>
                                        <th>Cliente</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {otRecentes.map(ot => (
                                        <tr key={ot.id}>
                                            <td style={{ paddingLeft: 10 }}><span className={`dot ${DOT[ot.estado] ?? 'dot-gray'}`} /></td>
                                            <td><span className="td-link" style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--blue)' }}>{ot.id}</span></td>
                                            <td style={{ fontSize: '0.78rem' }}>{ot.tipoTrabalho}</td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{getClienteNome(ot.clienteId)}</td>
                                            <td style={{ fontSize: '0.76rem' }}>{ot.estado}</td>
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
                                {alertas.length === 0 ? (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>
                                        <CheckCircle2 size={20} style={{ marginBottom: 4, color: 'var(--green)' }} /><br />Sem alertas activos.
                                    </div>
                                ) : alertas.map((a, i) => (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 8,
                                        padding: '7px 10px',
                                        background: a.tipo === 'error' ? 'var(--red-bg)' : a.tipo === 'warning' ? 'var(--orange-bg)' : 'var(--blue-s-bg)',
                                        border: `1px solid ${a.tipo === 'error' ? '#FFCDD2' : a.tipo === 'warning' ? '#FFCC80' : 'var(--blue-border)'}`,
                                        borderRadius: 3, fontSize: '0.78rem',
                                        color: a.tipo === 'error' ? 'var(--red)' : a.tipo === 'warning' ? 'var(--orange)' : 'var(--blue-s)',
                                    }}>
                                        {a.tipo === 'error' ? <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                                            : a.tipo === 'warning' ? <Clock size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                                            : <CheckCircle2 size={13} style={{ flexShrink: 0, marginTop: 1 }} />}
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
                                    <tr><th>Técnico</th><th style={{ width: 50, textAlign: 'center' }}>OT</th><th>Estado</th></tr>
                                </thead>
                                <tbody>
                                    {campoTecs.map(t => {
                                        const cnt = otHoje.filter(o => o.responsavel === t.nome).length;
                                        return (
                                            <tr key={t.id}>
                                                <td><span className="user-cell">
                                                    <span className="user-avatar" style={{ width: 26, height: 26, fontSize: '0.65rem', background: cnt === 0 ? 'var(--border-dark)' : 'var(--blue)' }}>
                                                        {t.nome.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                    </span>
                                                    {t.nome}
                                                </span></td>
                                                <td style={{ textAlign: 'center', fontWeight: 700, color: cnt === 0 ? 'var(--text-muted)' : 'var(--blue)' }}>{cnt}</td>
                                                <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{cnt === 0 ? 'Disponível' : `${cnt} intervenção(ões)`}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Resumo mensal */}
                    <div>
                        <div className="panel-header" style={{ borderRadius: '4px 4px 0 0', border: '1px solid var(--panel-border)', borderBottom: 'none' }}>
                            <span className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <TrendingUp size={14} /> Resumo Mensal
                            </span>
                        </div>
                        <div className="panel" style={{ borderRadius: '0 0 4px 4px' }}>
                            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {[
                                    { label: 'OT Terminadas (mês)',  value: String(terminadasMes),       sub: 'ordens de trabalho' },
                                    { label: 'OT Programadas',       value: String(programadas),         sub: 'aguardam execução', hide: !isTecnicoCampo },
                                    ...(!isTecnicoCampo ? [
                                        { label: 'Faturação emitida',  value: fmtMoney(totalFaturado),   sub: 'emitidas no mês' },
                                        { label: 'Faturação recebida', value: fmtMoney(totalFatPagas),   sub: 'pagas no mês' },
                                        { label: 'Clientes activos',   value: String(novosClientesMes),  sub: 'total em carteira' },
                                        { label: 'Artigos em stock',   value: String(artigos.filter(a => !a.inativo).length), sub: `${semStock.length} sem stock` },
                                    ] : [
                                        { label: 'Em curso',           value: String(emCurso),           sub: 'intervenções activas' },
                                        { label: 'OT Encerradas',      value: String(minhasOrdens.filter(o => o.estado === 'Encerrado').length), sub: 'concluídas' },
                                    ]),
                                ].filter(r => !('hide' in r && r.hide)).map(r => (
                                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border-light)' }}>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{r.label}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{r.sub}</div>
                                        </div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--blue)' }}>{r.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </AppLayout>
    );
};

export default DashboardPage;
