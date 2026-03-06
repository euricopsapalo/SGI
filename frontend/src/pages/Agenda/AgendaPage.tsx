import React, { useState } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

/* ── Mock agenda data ── */
interface AgendaItem {
    id: string; tipo: string; cliente: string; tecnico: string;
    hora: string; duracao: string; estado: 'Agendada' | 'Em execução' | 'Concluída' | 'Cancelada';
}

const MOCK_AGENDA: Record<string, AgendaItem[]> = {
    '2026-03-06': [
        { id: 'OS-0808', tipo: 'Preventiva', cliente: 'Hotel Marina Palace', tecnico: 'Bruno Cunha', hora: '09:00', duracao: '2h', estado: 'Em execução' },
        { id: 'OS-0807', tipo: 'Corretiva', cliente: 'Empresa Alpha, LDA', tecnico: '—', hora: '14:00', duracao: '3h', estado: 'Agendada' },
        { id: 'OS-0811', tipo: 'Montagem', cliente: 'Petro Servicing', tecnico: 'Joana Tavares', hora: '08:00', duracao: '4h', estado: 'Concluída' },
    ],
    '2026-03-07': [
        { id: 'OS-0812', tipo: 'Preventiva', cliente: 'MINSA Dir. Luanda', tecnico: 'Fátima Rodrigues', hora: '09:00', duracao: '2h', estado: 'Agendada' },
        { id: 'OS-0813', tipo: 'Preventiva', cliente: 'Clínica São João', tecnico: 'Bruno Cunha', hora: '14:00', duracao: '2h', estado: 'Agendada' },
    ],
    '2026-03-10': [
        { id: 'OS-0815', tipo: 'Corretiva', cliente: 'Farmácia Saúde +', tecnico: 'Joana Tavares', hora: '10:00', duracao: '3h', estado: 'Agendada' },
    ],
    '2026-03-12': [
        { id: 'OS-0816', tipo: 'Preventiva', cliente: 'Residencial Vista Mar', tecnico: 'Bruno Cunha', hora: '08:00', duracao: '3h', estado: 'Agendada' },
        { id: 'OS-0817', tipo: 'Preventiva', cliente: 'Supermercado Maxi', tecnico: 'Fátima Rodrigues', hora: '13:00', duracao: '2h', estado: 'Agendada' },
    ],
};

const ESTADO_DOT: Record<string, string> = {
    'Agendada': 'dot-blue', 'Em execução': 'dot-orange', 'Concluída': 'dot-green', 'Cancelada': 'dot-gray',
};

const TIPO_BADGE: Record<string, string> = {
    'Montagem': 'tbadge tbadge-campo', 'Preventiva': 'tbadge tbadge-suporte',
    'Corretiva': 'tbadge tbadge-admin', 'Remota': 'tbadge tbadge-vendedor',
};

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const AgendaPage: React.FC = () => {
    const [year, setYear] = useState(2026);
    const [month, setMonth] = useState(2); // 0-indexed, 2 = March
    const [selectedDay, setSelectedDay] = useState('2026-03-06');

    const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
    const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

    // Build calendar grid
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [
        ...Array(firstDay).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const fmtKey = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    const selectedItems = MOCK_AGENDA[selectedDay] || [];
    const today = '2026-03-06';

    return (
        <AppLayout>
            <ActionBar title="Agenda" breadcrumb="AQUATEX SGI · Agenda">
                <div className="actionbar-spacer" />
                <button className="abtn abtn-primary" type="button">
                    <Calendar size={13} /> Nova OS Agendada
                </button>
            </ActionBar>

            <div className="page-content" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>

                {/* Calendar */}
                <div>
                    <div className="panel">
                        <div className="panel-header">
                            <button className="icon-btn" onClick={prevMonth} type="button"><ChevronLeft size={14} /></button>
                            <span className="panel-title" style={{ flex: 1, textAlign: 'center' }}>{MONTHS[month]} {year}</span>
                            <button className="icon-btn" onClick={nextMonth} type="button"><ChevronRight size={14} /></button>
                        </div>

                        <div style={{ padding: '10px 8px 8px' }}>
                            {/* Week header */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
                                {WEEK.map(w => (
                                    <div key={w} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', padding: '2px 0' }}>{w}</div>
                                ))}
                            </div>
                            {/* Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                                {cells.map((d, i) => {
                                    if (!d) return <div key={i} />;
                                    const key = fmtKey(d);
                                    const hasOS = Boolean(MOCK_AGENDA[key]);
                                    const isToday = key === today;
                                    const isSelected = key === selectedDay;
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => setSelectedDay(key)}
                                            style={{
                                                border: 'none', cursor: 'pointer',
                                                borderRadius: 4, padding: '4px 0',
                                                fontFamily: 'inherit', fontSize: '0.8rem',
                                                fontWeight: isToday || isSelected ? 700 : 400,
                                                color: isSelected ? '#fff' : isToday ? 'var(--blue)' : 'var(--text-primary)',
                                                background: isSelected ? 'var(--blue)' : isToday ? 'var(--blue-light)' : 'transparent',
                                                position: 'relative',
                                            }}
                                        >
                                            {d}
                                            {hasOS && !isSelected && (
                                                <span style={{
                                                    position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)',
                                                    width: 4, height: 4, borderRadius: '50%', background: 'var(--blue)', display: 'block',
                                                }} />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Técnicos legend */}
                    <div className="panel" style={{ marginTop: 12 }}>
                        <div className="panel-header"><span className="panel-title">Técnicos Campo</span></div>
                        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {['Bruno Cunha', 'Fátima Rodrigues', 'Joana Tavares', 'Gabriel Teixeira'].map((t, i) => (
                                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem' }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: ['var(--blue)', 'var(--green)', 'var(--orange)', 'var(--border-dark)'][i] }} />
                                    {t}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Day agenda */}
                <div>
                    <div className="panel-header" style={{ borderRadius: '4px 4px 0 0', border: '1px solid var(--panel-border)', borderBottom: 'none' }}>
                        <span className="panel-title">
                            {new Date(selectedDay + 'T12:00').toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{selectedItems.length} OS agendadas</span>
                    </div>

                    {selectedItems.length === 0 ? (
                        <div className="panel" style={{ borderRadius: '0 0 4px 4px' }}>
                            <div className="empty-state">Nenhuma OS agendada para este dia.</div>
                        </div>
                    ) : (
                        <div className="table-container" style={{ borderRadius: '0 0 4px 4px' }}>
                            <table className="data-table">
                                <thead>
                                    <tr><th style={{ width: 60 }}>Hora</th><th>OS</th><th>Tipo</th><th>Cliente</th><th>Técnico</th><th>Duração</th><th>Estado</th></tr>
                                </thead>
                                <tbody>
                                    {selectedItems.map(item => (
                                        <tr key={item.id}>
                                            <td style={{ fontWeight: 700, color: 'var(--blue)', fontSize: '0.82rem' }}>{item.hora}</td>
                                            <td><span className="td-link">{item.id}</span></td>
                                            <td><span className={TIPO_BADGE[item.tipo]}>{item.tipo}</span></td>
                                            <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{item.cliente}</td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{item.tecnico}</td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.duracao}</td>
                                            <td>
                                                <div className="status-dot">
                                                    <span className={`dot ${ESTADO_DOT[item.estado]}`} />
                                                    <span style={{ fontSize: '0.78rem' }}>{item.estado}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Upcoming in month */}
                    <div style={{ marginTop: 16 }}>
                        <div className="panel-header" style={{ borderRadius: '4px 4px 0 0', border: '1px solid var(--panel-border)', borderBottom: 'none' }}>
                            <span className="panel-title">Próximas OS no mês</span>
                        </div>
                        <div className="table-container" style={{ borderRadius: '0 0 4px 4px' }}>
                            <table className="data-table">
                                <thead>
                                    <tr><th>Data</th><th>OS</th><th>Tipo</th><th>Cliente</th><th>Técnico</th><th>Estado</th></tr>
                                </thead>
                                <tbody>
                                    {Object.entries(MOCK_AGENDA).sort().flatMap(([date, items]) =>
                                        items.filter(i => i.estado === 'Agendada').map(item => (
                                            <tr key={`${date}-${item.id}`}>
                                                <td style={{ fontWeight: 700, color: 'var(--blue)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                                    {new Date(date + 'T12:00').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })} {item.hora}
                                                </td>
                                                <td><span className="td-link">{item.id}</span></td>
                                                <td><span className={TIPO_BADGE[item.tipo]}>{item.tipo}</span></td>
                                                <td style={{ fontSize: '0.8rem', fontWeight: 600 }}>{item.cliente}</td>
                                                <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{item.tecnico}</td>
                                                <td>
                                                    <div className="status-dot">
                                                        <span className={`dot ${ESTADO_DOT[item.estado]}`} />
                                                        <span style={{ fontSize: '0.76rem' }}>{item.estado}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

            </div>
        </AppLayout>
    );
};

export default AgendaPage;
