import React, { useState, useMemo, useCallback } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import ExportModal, { ExportCol } from '../../components/ExportModal';
import { BarChart3, TrendingUp, Users, Download, Package, Search, Briefcase, Trophy, MapPin, Receipt } from 'lucide-react';
import { useGlobal } from '../../contexts/GlobalContext';
import VendasRelatorioTab from './VendasRelatorioTab';

/* fmtDate, fmtMoney, fmt vêm do GlobalContext */

type RelTab = 'faturacao' | 'comissoes' | 'produtividade' | 'movimentos' | 'carteira' | 'ranking' | 'regioes' | 'vendas';

const TABS: { id: RelTab; label: string; icon: React.FC<any> }[] = [
    { id: 'faturacao',     label: 'Faturação Mensal',      icon: BarChart3  },
    { id: 'comissoes',     label: 'Comissões',              icon: TrendingUp },
    { id: 'produtividade', label: 'Produtividade Técnicos', icon: Users      },
    { id: 'movimentos',    label: 'Movimentos de Stock',    icon: Package    },
    { id: 'carteira',      label: 'Carteira de Clientes',   icon: Briefcase  },
    { id: 'ranking',       label: 'Ranking de Clientes',    icon: Trophy     },
    { id: 'regioes',       label: 'Clientes por Região',    icon: MapPin     },
    { id: 'vendas',        label: 'Vendas',                 icon: Receipt    },
];

const MES_PT: Record<string, string> = {
    '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
    '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};

const TIPO_LABEL: Record<string, string> = {
    entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste',
    transferencia: 'Transferência', devolucao: 'Devolução',
};

const TIPO_MOV_COLOR: Record<string, string> = {
    'Entrada': 'var(--green)', 'Saída': 'var(--red,#ef4444)',
    'Ajuste': 'var(--blue)', 'Transferência': 'var(--orange)', 'Devolução': 'var(--text-muted)',
};

/** Colunas por separador; as de Vendas (#170) dependem da vista e vêm do próprio separador. */
const COLS: Record<Exclude<RelTab, 'vendas'>, ExportCol[]> = {
    faturacao: [
        { key: 'mes',        label: 'Mês'            },
        { key: 'os',         label: 'Nº OT'          },
        { key: 'montagem',   label: 'Montagem (Kz)'  },
        { key: 'preventiva', label: 'Preventiva (Kz)' },
        { key: 'corretiva',  label: 'Corretiva (Kz)' },
        { key: 'total',      label: 'Total (Kz)'     },
    ],
    comissoes: [
        { key: 'nome',       label: 'Nome'          },
        { key: 'tipo',       label: 'Perfil'        },
        { key: 'os',         label: 'Nº OT'         },
        { key: 'montagem',   label: 'Montagem'      },
        { key: 'preventiva', label: 'Preventiva'    },
        { key: 'corretiva',  label: 'Corretiva'     },
        { key: 'total',      label: 'Faturado (Kz)' },
        { key: 'comissao',   label: 'Comissão (Kz)' },
    ],
    produtividade: [
        { key: 'nome',       label: 'Técnico'    },
        { key: 'osMes',      label: 'Total OT'   },
        { key: 'concluidas', label: 'Concluídas' },
        { key: 'pendentes',  label: 'Pendentes'  },
    ],
    movimentos: [
        { key: 'data',       label: 'Data'       },
        { key: 'tipo',       label: 'Tipo'       },
        { key: 'codigo',     label: 'Código'     },
        { key: 'artigo',     label: 'Artigo'     },
        { key: 'armazem',    label: 'Armazém'    },
        { key: 'quantidade', label: 'Quantidade' },
        { key: 'origem',     label: 'Origem'     },
        { key: 'utilizador', label: 'Utilizador' },
    ],
    carteira: [
        { key: 'nome',          label: 'Cliente'       },
        { key: 'tipo',          label: 'Tipo'          },
        { key: 'nEquipamentos', label: 'Equipamentos'  },
        { key: 'nOT',           label: 'OT Total'      },
        { key: 'otAtivas',      label: 'OT Em Curso'   },
        { key: 'valorFaturado', label: 'Faturado (Kz)' },
        { key: 'estado',        label: 'Estado'        },
    ],
    ranking: [
        { key: 'posicao',       label: 'Posição'       },
        { key: 'nome',          label: 'Cliente'       },
        { key: 'nOT',           label: 'Nº OT'         },
        { key: 'valorFaturado', label: 'Faturado (Kz)' },
    ],
    regioes: [
        { key: 'regiao',    label: 'Região'     },
        { key: 'clientes',  label: 'Clientes'   },
        { key: 'ativos',    label: 'Activos'    },
        { key: 'inativos',  label: 'Inactivos'  },
        { key: 'nOT',       label: 'Total OT'   },
        { key: 'faturado',  label: 'Faturado'   },
    ],
};

/* ══════════════════════════════════════════════════════════ */
const RelatoriosPage: React.FC = () => {
    const { faturas, ordens, movimentosStock, artigos, armazens, clientes, equipInstalados, provincias, empresaConfig, fmtMoney, fmtDate, fmt: fmtNum } = useGlobal();
    const fmtKz = fmtMoney;

    // #170 — `?tab=vendas` abre directamente um separador.
    const [tab,        setTab]        = useState<RelTab>(() => {
        const pedido = new URLSearchParams(window.location.search).get('tab');
        return TABS.some(t => t.id === pedido) ? pedido as RelTab : 'faturacao';
    });
    const [showExport, setShowExport] = useState(false);

    /* ── Faturação mensal (computed from real faturas) ── */
    const faturacaoMensal = useMemo(() => {
        const byMonth: Record<string, { mes: string; mes_key: string; os: number; montagem: number; preventiva: number; corretiva: number; total: number }> = {};
        faturas.forEach(f => {
            const mes_key = (f.dataEmissao ?? '').substring(0, 7);
            if (!mes_key || mes_key.length < 7) return;
            const [y, m] = mes_key.split('-');
            const mesLabel = `${MES_PT[m] ?? m} ${y}`;
            if (!byMonth[mes_key]) byMonth[mes_key] = { mes: mesLabel, mes_key, os: 0, montagem: 0, preventiva: 0, corretiva: 0, total: 0 };
            byMonth[mes_key].total += Number(f.valorTotal);
            byMonth[mes_key].os += 1;
            const ot = ordens.find(o => o.id === f.otId);
            const nat = ot?.naturezaIntervencao ?? '';
            if (nat === 'Montagem / Instalação')    byMonth[mes_key].montagem   += Number(f.valorTotal);
            else if (nat === 'Reparação de avaria') byMonth[mes_key].corretiva  += Number(f.valorTotal);
            else                                    byMonth[mes_key].preventiva += Number(f.valorTotal);
        });
        return Object.values(byMonth).sort((a, b) => a.mes_key.localeCompare(b.mes_key));
    }, [faturas, ordens]);

    const mesKeys = faturacaoMensal.map(m => m.mes_key);
    const [fatDe,  setFatDe]  = useState('');
    const [fatAte, setFatAte] = useState('');
    const fatDeEff  = fatDe  || mesKeys[0]                  || '';
    const fatAteEff = fatAte || mesKeys[mesKeys.length - 1] || '';

    /* ── Comissões (issue #101) — taxa fixa por natureza × OT concluída, por técnico ──
       Comissão = Σ (taxa configurada da natureza de cada OT Finalizada). As taxas
       vêm de Configurações → Comissões (empresaConfig). "Faturado" fica separado
       como referência (não é comissão). */
    const comissoesData = useMemo(() => {
        const rMont = Number(empresaConfig.comissaoMontagem ?? 0);
        const rPrev = Number(empresaConfig.comissaoPreventiva ?? 0);
        const rCorr = Number(empresaConfig.comissaoCorretiva ?? 0);
        const byTec: Record<string, { nome: string; tipo: string; os: number; montagem: number; preventiva: number; corretiva: number; comissao: number; total: number }> = {};
        ordens.filter(o => o.estado === 'Finalizada').forEach(o => {
            if (!o.responsavel) return;
            if (!byTec[o.responsavel]) byTec[o.responsavel] = { nome: o.responsavel, tipo: 'Técnico Campo', os: 0, montagem: 0, preventiva: 0, corretiva: 0, comissao: 0, total: 0 };
            const t = byTec[o.responsavel];
            t.os++;
            const nat = o.naturezaIntervencao ?? '';
            if (nat === 'Montagem / Instalação')    { t.montagem++;   t.comissao += rMont; }
            else if (nat === 'Reparação de avaria') { t.corretiva++;  t.comissao += rCorr; }
            else                                    { t.preventiva++; t.comissao += rPrev; }
            const fat = faturas.find(f => f.otId === o.id);
            if (fat) t.total += Number(fat.valorTotal);
        });
        return Object.values(byTec).sort((a, b) => b.comissao - a.comissao);
    }, [ordens, faturas, empresaConfig]);

    /* ── Produtividade (real) — OTs por técnico ── */
    const produtividadeData = useMemo(() => {
        const byTec: Record<string, { nome: string; osMes: number; concluidas: number; pendentes: number }> = {};
        ordens.forEach(o => {
            if (!o.responsavel) return;
            if (!byTec[o.responsavel]) byTec[o.responsavel] = { nome: o.responsavel, osMes: 0, concluidas: 0, pendentes: 0 };
            byTec[o.responsavel].osMes++;
            if (o.estado === 'Finalizada') byTec[o.responsavel].concluidas++;
            else byTec[o.responsavel].pendentes++;
        });
        return Object.values(byTec).sort((a, b) => b.osMes - a.osMes);
    }, [ordens]);

    /* ── Carteira de Clientes ── */
    const carteiraData = useMemo(() => clientes.map(c => {
        const equips  = equipInstalados.filter(e => String(e.clienteId) === String(c.id));
        const cOrdens = ordens.filter(o => String(o.clienteId) === String(c.id));
        const otAtivas = cOrdens.filter(o => o.estado !== 'Finalizada').length;
        const valorFaturado = faturas.filter(f => String(f.clienteId) === String(c.id)).reduce((s, f) => s + Number(f.valorTotal), 0);
        return {
            id: c.id, nome: c.nome, tipo: c.tipo === 'empresa' ? 'Empresa' : 'Particular',
            nEquipamentos: equips.length, nOT: cOrdens.length, otAtivas,
            valorFaturado, estado: c.ativo ? 'Activo' : 'Inactivo',
        };
    }).sort((a, b) => b.nOT - a.nOT), [clientes, equipInstalados, ordens, faturas]);

    /* ── Ranking de Clientes ── */
    type RankSort = 'ot' | 'faturado';
    const [rankSort, setRankSort] = useState<RankSort>('faturado');
    const rankingData = useMemo(() => {
        const sorted = [...carteiraData].sort((a, b) =>
            rankSort === 'faturado' ? b.valorFaturado - a.valorFaturado : b.nOT - a.nOT
        );
        return sorted.map((c, i) => ({ posicao: i + 1, ...c }));
    }, [carteiraData, rankSort]);
    const rankMax = Math.max(...rankingData.map(r => rankSort === 'faturado' ? r.valorFaturado : r.nOT), 1);

    /* ── Clientes por Região ── */
    const regiaoData = useMemo(() => {
        const byProv = new Map<string, { regiao: string; ids: string[] }>();
        for (const c of clientes) {
            // Prefer: resolve province name via provinciaId; fallback to direct provincia string
            const provNome = (c.provinciaId
                ? (provincias.find(p => String(p.id) === String(c.provinciaId))?.nome ?? c.provincia?.trim())
                : c.provincia?.trim()) || 'Sem região';
            if (!byProv.has(provNome)) byProv.set(provNome, { regiao: provNome, ids: [] });
            byProv.get(provNome)!.ids.push(c.id);
        }
        return Array.from(byProv.values()).map(({ regiao, ids }) => {
            const regionClientes = clientes.filter(c => ids.includes(c.id));
            const nOT = ordens.filter(o => ids.some(id => String(o.clienteId) === id)).length;
            const faturado = faturas.filter(f => ids.some(id => String(f.clienteId) === id)).reduce((s, f) => s + Number(f.valorTotal), 0);
            return {
                regiao, clientes: ids.length,
                ativos:   regionClientes.filter(c => c.ativo).length,
                inativos: regionClientes.filter(c => !c.ativo).length,
                nOT, faturado,
            };
        }).sort((a, b) => b.clientes - a.clientes);
    }, [clientes, ordens, faturas, provincias]);
    const regiaoMaxClientes = Math.max(...regiaoData.map(r => r.clientes), 1);

    const [comTipo,    setComTipo]    = useState('');
    const [comSearch,  setComSearch]  = useState('');
    const [prodSearch, setProdSearch] = useState('');
    const [movTipo,    setMovTipo]    = useState('');
    const [movDe,      setMovDe]      = useState('');
    const [movAte,     setMovAte]     = useState('');
    const [movSearch,  setMovSearch]  = useState('');

    const filtFaturacao = useMemo(() =>
        faturacaoMensal.filter(m => (!fatDeEff || m.mes_key >= fatDeEff) && (!fatAteEff || m.mes_key <= fatAteEff)),
        [faturacaoMensal, fatDeEff, fatAteEff]
    );

    const filtComissoes = useMemo(() =>
        comissoesData.filter(c =>
            (!comTipo   || c.tipo === comTipo) &&
            (!comSearch || c.nome.toLowerCase().includes(comSearch.toLowerCase()))
        ),
        [comissoesData, comTipo, comSearch]
    );

    const filtProdutividade = useMemo(() =>
        produtividadeData.filter(t =>
            !prodSearch || t.nome.toLowerCase().includes(prodSearch.toLowerCase())
        ),
        [produtividadeData, prodSearch]
    );

    const movimentosEnrich = useMemo(() =>
        [...movimentosStock].sort((a, b) => b.data.localeCompare(a.data)).map(m => {
            const art  = artigos.find(a => a.id === m.artigoId);
            const resolveArm = (val?: string) => val ? (armazens.find(a => a.codigo === val || a.id === val)?.codigo ?? val) : '';
            const armLabel = m.armazemDestinoId
                ? `${resolveArm(m.armazemId)} → ${resolveArm(m.armazemDestinoId)}`
                : resolveArm(m.armazemId);
            const tipoLabel = TIPO_LABEL[m.tipo] ?? m.tipo;
            const qtdDisplay = m.tipo === 'saida' || m.tipo === 'devolucao' ? -Math.abs(m.quantidade) : m.quantidade;
            const rawData = m.data.includes('/') ? m.data.split('/').reverse().join('-') : m.data.split('T')[0];
            return {
                id: m.id, data: fmtDate(rawData), rawData,
                tipo: tipoLabel,
                artigo: art?.descricao ?? (m.artigoId || '—'), codigo: art?.codigo ?? '',
                armazem: armLabel,
                quantidade: qtdDisplay,
                origem: m.referencia ?? m.observacao ?? '',
                utilizador: m.usuario ?? '',
            };
        }),
        [movimentosStock, artigos, armazens, fmtDate]
    );

    const filtMovimentos = useMemo(() =>
        movimentosEnrich.filter(m =>
            (!movTipo   || m.tipo === movTipo) &&
            (!movDe     || m.rawData >= movDe) &&
            (!movAte    || m.rawData <= movAte) &&
            (!movSearch || m.artigo.toLowerCase().includes(movSearch.toLowerCase()) ||
                           m.codigo.toLowerCase().includes(movSearch.toLowerCase()))
        ),
        [movimentosEnrich, movTipo, movDe, movAte, movSearch]
    );

    const [carteiraSearch, setCarteiraSearch] = useState('');
    const filtCarteira = useMemo(() =>
        carteiraData.filter(c => !carteiraSearch || c.nome.toLowerCase().includes(carteiraSearch.toLowerCase())),
        [carteiraData, carteiraSearch]
    );

    // #170 — o separador de Vendas diz o que exportar (vista activa).
    const [vendasExport, setVendasExport] = useState<{ titulo: string; colunas: ExportCol[]; linhas: Record<string, any>[] }>({ titulo: 'Vendas', colunas: [], linhas: [] });
    const onVendasExportavel = useCallback((e: typeof vendasExport) => setVendasExport(e), []);

    const exportData: Record<Exclude<RelTab, 'vendas'>, Record<string, any>[]> = {
        faturacao:     filtFaturacao,
        comissoes:     filtComissoes,
        produtividade: filtProdutividade,
        movimentos:    filtMovimentos,
        carteira:      filtCarteira,
        ranking:       rankingData,
        regioes:       regiaoData,
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
                        <button key={t.id} onClick={() => setTab(t.id)} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '5px 14px', borderRadius: 4, border: 'none',
                            background: tab === t.id ? '#fff' : 'none',
                            boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                            fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: tab === t.id ? 700 : 600,
                            color: tab === t.id ? 'var(--blue)' : 'var(--text-secondary)',
                            cursor: 'pointer', transition: 'all 150ms', whiteSpace: 'nowrap',
                        }}>
                            <t.icon size={13} /> {t.label}
                        </button>
                    ))}
                </div>

                {/* ── FATURAÇÃO ── */}
                {tab === 'faturacao' && (
                    <>
                        {mesKeys.length > 0 && (
                            <div className="filters-bar" style={{ marginBottom: 14 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    De:
                                    <select className="filter-select" value={fatDeEff} onChange={e => setFatDe(e.target.value)}>
                                        {mesKeys.map(k => <option key={k} value={k}>{faturacaoMensal.find(m => m.mes_key === k)?.mes}</option>)}
                                    </select>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    Até:
                                    <select className="filter-select" value={fatAteEff} onChange={e => setFatAte(e.target.value)}>
                                        {mesKeys.filter(k => k >= fatDeEff).map(k => <option key={k} value={k}>{faturacaoMensal.find(m => m.mes_key === k)?.mes}</option>)}
                                    </select>
                                </label>
                            </div>
                        )}

                        <div className="stats-row" style={{ marginBottom: 16 }}>
                            {[
                                { label: 'Total período',  value: `Kz ${fmtKz(filtFaturacao.reduce((s, m) => s + m.total, 0))}` },
                                { label: 'Média mensal',   value: `Kz ${fmtKz(Math.round(filtFaturacao.reduce((s, m) => s + m.total, 0) / (filtFaturacao.length || 1)))}` },
                                { label: 'Melhor mês',     value: filtFaturacao.length ? filtFaturacao.reduce((a, m) => m.total > a.total ? m : a).mes : '—' },
                                { label: 'OT Faturadas',   value: fmtNum(filtFaturacao.reduce((s, m) => s + m.os, 0)) },
                            ].map(s => (
                                <div key={s.label} className="stat-card">
                                    <span className="stat-label">{s.label}</span>
                                    <span className="stat-value blue">{s.value}</span>
                                </div>
                            ))}
                        </div>

                        <div className="panel" style={{ marginBottom: 16 }}>
                            <div className="panel-header"><span className="panel-title">Faturação Mensal (Kz)</span></div>
                            <div className="panel-body">
                                {filtFaturacao.length === 0
                                    ? <div className="empty-state" style={{ height: 100 }}>Sem dados de faturação registados.</div>
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
                                { label: 'Total Comissões',   value: `Kz ${fmtKz(filtComissoes.reduce((s, c) => s + c.comissao, 0))}`, cls: 'green' },
                                { label: 'Total Faturado',    value: `Kz ${fmtKz(filtComissoes.reduce((s, c) => s + c.total, 0))}`, cls: 'blue' },
                                { label: 'OT Concluídas',     value: filtComissoes.reduce((s, c) => s + c.os, 0) },
                            ].map(s => (
                                <div key={s.label} className="stat-card">
                                    <span className="stat-label">{s.label}</span>
                                    <span className={`stat-value ${(s as any).cls ?? ''}`}>{s.value}</span>
                                </div>
                            ))}
                        </div>

                        <div className="table-container">
                            <table className="data-table">
                                <thead><tr><th>Nome</th><th>Perfil</th><th style={{ textAlign: 'center' }}>Total OT</th><th style={{ textAlign: 'center' }}>Montagem</th><th style={{ textAlign: 'center' }}>Preventiva</th><th style={{ textAlign: 'center' }}>Corretiva</th><th style={{ textAlign: 'right' }}>Faturado (Kz)</th><th style={{ textAlign: 'right', fontWeight: 800 }}>Comissão (Kz)</th></tr></thead>
                                <tbody>
                                    {filtComissoes.length === 0 && <tr><td colSpan={8}><div className="empty-state">Sem OT concluídas registadas.</div></td></tr>}
                                    {filtComissoes.map(c => (
                                        <tr key={c.nome}>
                                            <td style={{ fontWeight: 700 }}>{c.nome}</td>
                                            <td><span className={c.tipo === 'Vendedor' ? 'tbadge tbadge-vendedor' : 'tbadge tbadge-campo'}>{c.tipo}</span></td>
                                            <td style={{ textAlign: 'center', color: 'var(--blue)', fontWeight: 700 }}>{c.os}</td>
                                            <td style={{ textAlign: 'center' }}>{c.montagem}</td>
                                            <td style={{ textAlign: 'center' }}>{c.preventiva}</td>
                                            <td style={{ textAlign: 'center' }}>{c.corretiva}</td>
                                            <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{fmtKz(c.total)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--green)' }}>{fmtKz(c.comissao)}</td>
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
                                { label: 'Total OT',    value: filtProdutividade.reduce((s, t) => s + t.osMes, 0) },
                                { label: 'Concluídas',  value: filtProdutividade.reduce((s, t) => s + t.concluidas, 0), cls: 'green' },
                                { label: 'Em Curso',    value: filtProdutividade.reduce((s, t) => s + t.pendentes, 0), cls: 'blue' },
                                { label: 'Técnicos',    value: filtProdutividade.length, cls: 'muted' },
                            ].map(s => (
                                <div key={s.label} className="stat-card">
                                    <span className="stat-label">{s.label}</span>
                                    <span className={`stat-value ${(s as any).cls || ''}`}>{s.value}</span>
                                </div>
                            ))}
                        </div>

                        <div className="table-container">
                            <table className="data-table">
                                <thead><tr><th>Técnico</th><th style={{ textAlign: 'center' }}>Total OT</th><th style={{ textAlign: 'center' }}>Concluídas</th><th style={{ textAlign: 'center' }}>Em Curso/Prog.</th></tr></thead>
                                <tbody>
                                    {filtProdutividade.length === 0 && <tr><td colSpan={4}><div className="empty-state">Sem OT atribuídas a técnicos.</div></td></tr>}
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
                                            <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{t.pendentes}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="table-count">{filtProdutividade.length} técnicos</div>
                        </div>
                    </>
                )}

                {/* ── CARTEIRA DE CLIENTES ── */}
                {tab === 'carteira' && (
                    <>
                        <div className="filters-bar" style={{ marginBottom: 14 }}>
                            <div className="search-wrap">
                                <Search className="search-icon" />
                                <input className="search-input" placeholder="Pesquisar cliente…" value={carteiraSearch} onChange={e => setCarteiraSearch(e.target.value)} />
                            </div>
                        </div>

                        <div className="stats-row" style={{ marginBottom: 16 }}>
                            {[
                                { label: 'Total Clientes',   value: filtCarteira.length },
                                { label: 'Com Equipamentos', value: filtCarteira.filter(c => c.nEquipamentos > 0).length, cls: 'blue' },
                                { label: 'OT em Curso',      value: filtCarteira.reduce((s, c) => s + c.otAtivas, 0), cls: 'orange' },
                                { label: 'Total Faturado',   value: `Kz ${fmtKz(filtCarteira.reduce((s, c) => s + c.valorFaturado, 0))}`, cls: 'green' },
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
                                        <th>Cliente</th>
                                        <th>Tipo</th>
                                        <th style={{ textAlign: 'center' }}>Equipamentos</th>
                                        <th style={{ textAlign: 'center' }}>OT Total</th>
                                        <th style={{ textAlign: 'center' }}>OT Em Curso</th>
                                        <th style={{ textAlign: 'right' }}>Faturado (Kz)</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtCarteira.length === 0 && <tr><td colSpan={7}><div className="empty-state">Sem clientes.</div></td></tr>}
                                    {filtCarteira.map(c => (
                                        <tr key={c.id}>
                                            <td style={{ fontWeight: 700, fontSize: '0.83rem' }}>{c.nome}</td>
                                            <td><span style={{ fontSize: '0.74rem', padding: '1px 7px', borderRadius: 8, background: c.tipo === 'Empresa' ? 'var(--blue-light,#eff6ff)' : 'var(--bg-secondary)', color: c.tipo === 'Empresa' ? 'var(--blue)' : 'var(--text-secondary)', fontWeight: 600 }}>{c.tipo}</span></td>
                                            <td style={{ textAlign: 'center', fontWeight: 700, color: c.nEquipamentos > 0 ? 'var(--blue)' : 'var(--text-muted)' }}>{c.nEquipamentos}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{c.nOT}</td>
                                            <td style={{ textAlign: 'center', color: c.otAtivas > 0 ? 'var(--orange)' : 'var(--text-muted)' }}>{c.otAtivas}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 800, color: c.valorFaturado > 0 ? 'var(--green)' : 'var(--text-muted)' }}>{fmtKz(c.valorFaturado)}</td>
                                            <td><span style={{ fontSize: '0.74rem', padding: '1px 7px', borderRadius: 8, background: c.estado === 'Activo' ? 'var(--green-light,#f0fdf4)' : 'var(--bg-secondary)', color: c.estado === 'Activo' ? 'var(--green)' : 'var(--text-muted)', fontWeight: 600 }}>{c.estado}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="table-count">{filtCarteira.length} clientes</div>
                        </div>
                    </>
                )}

                {/* ── RANKING DE CLIENTES ── */}
                {tab === 'ranking' && (
                    <>
                        <div className="filters-bar" style={{ marginBottom: 14 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                Ordenar por:
                                <select className="filter-select" value={rankSort} onChange={e => setRankSort(e.target.value as RankSort)}>
                                    <option value="faturado">Valor Faturado</option>
                                    <option value="ot">Nº de OT</option>
                                </select>
                            </label>
                        </div>

                        <div className="stats-row" style={{ marginBottom: 16 }}>
                            {[
                                { label: 'Top Cliente',  value: rankingData[0]?.nome ?? '—', cls: '' },
                                { label: 'Total OT',     value: fmtNum(rankingData.reduce((s, r) => s + r.nOT, 0)), cls: 'blue' },
                                { label: 'Total Faturado', value: `Kz ${fmtKz(rankingData.reduce((s, r) => s + r.valorFaturado, 0))}`, cls: 'green' },
                            ].map(s => (
                                <div key={s.label} className="stat-card">
                                    <span className="stat-label">{s.label}</span>
                                    <span className={`stat-value ${s.cls}`}>{s.value}</span>
                                </div>
                            ))}
                        </div>

                        <div className="panel" style={{ marginBottom: 16 }}>
                            <div className="panel-header"><span className="panel-title">Ranking — {rankSort === 'faturado' ? 'Por Valor Faturado' : 'Por Nº de OT'} (Top 10)</span></div>
                            <div className="panel-body">
                                {rankingData.slice(0, 10).map((r, i) => {
                                    const val = rankSort === 'faturado' ? r.valorFaturado : r.nOT;
                                    const pct = Math.round((val / rankMax) * 100);
                                    const medals = ['🥇', '🥈', '🥉'];
                                    return (
                                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                            <div style={{ width: 24, textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                                                {i < 3 ? medals[i] : `#${i + 1}`}
                                            </div>
                                            <div style={{ width: 160, fontSize: '0.78rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome}</div>
                                            <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 4, height: 14, overflow: 'hidden' }}>
                                                <div style={{ width: `${pct}%`, height: '100%', background: i === 0 ? 'var(--blue)' : i === 1 ? 'var(--green)' : i === 2 ? 'var(--orange)' : 'var(--text-muted)', borderRadius: 4, transition: 'width 400ms' }} />
                                            </div>
                                            <div style={{ width: 120, textAlign: 'right', fontSize: '0.78rem', fontWeight: 700, color: 'var(--blue)' }}>
                                                {rankSort === 'faturado' ? `Kz ${fmtKz(r.valorFaturado)}` : `${r.nOT} OT`}
                                            </div>
                                        </div>
                                    );
                                })}
                                {rankingData.length === 0 && <div className="empty-state" style={{ height: 80 }}>Sem dados disponíveis.</div>}
                            </div>
                        </div>

                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 50, textAlign: 'center' }}>#</th>
                                        <th>Cliente</th>
                                        <th style={{ textAlign: 'center' }}>Nº OT</th>
                                        <th style={{ textAlign: 'center' }}>Equipamentos</th>
                                        <th style={{ textAlign: 'right' }}>Faturado (Kz)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rankingData.length === 0 && <tr><td colSpan={5}><div className="empty-state">Sem dados.</div></td></tr>}
                                    {rankingData.map(r => (
                                        <tr key={r.id}>
                                            <td style={{ textAlign: 'center', fontWeight: 800, color: r.posicao <= 3 ? 'var(--blue)' : 'var(--text-muted)' }}>{r.posicao}</td>
                                            <td style={{ fontWeight: 700 }}>{r.nome}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.nOT}</td>
                                            <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{r.nEquipamentos}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--green)' }}>{fmtKz(r.valorFaturado)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="table-count">{rankingData.length} clientes</div>
                        </div>
                    </>
                )}

                {/* ── CLIENTES POR REGIÃO ── */}
                {tab === 'regioes' && (
                    <>
                        <div className="stats-row" style={{ marginBottom: 16 }}>
                            {[
                                { label: 'Regiões',        value: regiaoData.length },
                                { label: 'Total Clientes', value: regiaoData.reduce((s, r) => s + r.clientes, 0) },
                                { label: 'Total OT',       value: fmtNum(regiaoData.reduce((s, r) => s + r.nOT, 0)), cls: 'blue' },
                                { label: 'Total Faturado', value: `Kz ${fmtKz(regiaoData.reduce((s, r) => s + r.faturado, 0))}`, cls: 'green' },
                            ].map(s => (
                                <div key={s.label} className="stat-card">
                                    <span className="stat-label">{s.label}</span>
                                    <span className={`stat-value ${(s as any).cls ?? ''}`}>{s.value}</span>
                                </div>
                            ))}
                        </div>

                        <div className="panel" style={{ marginBottom: 16 }}>
                            <div className="panel-header"><span className="panel-title">Distribuição Geográfica</span></div>
                            <div className="panel-body">
                                {regiaoData.length === 0
                                    ? <div className="empty-state" style={{ height: 80 }}>Sem dados geográficos.</div>
                                    : regiaoData.map(r => {
                                        const pct = Math.round((r.clientes / regiaoMaxClientes) * 100);
                                        return (
                                            <div key={r.regiao} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                <MapPin size={12} style={{ color: 'var(--blue)', flexShrink: 0 }} />
                                                <div style={{ width: 150, fontSize: '0.78rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.regiao}</div>
                                                <div style={{ flex: 1, background: 'var(--bg-secondary)', borderRadius: 4, height: 12, overflow: 'hidden' }}>
                                                    <div style={{ width: `${pct}%`, height: '100%', background: 'var(--blue)', borderRadius: 4, transition: 'width 400ms' }} />
                                                </div>
                                                <div style={{ width: 100, textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.clientes} cliente{r.clientes !== 1 ? 's' : ''}</div>
                                                <div style={{ width: 110, textAlign: 'right', fontSize: '0.75rem', color: 'var(--green)', fontWeight: 700 }}>Kz {fmtKz(r.faturado)}</div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>

                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Região (Província)</th>
                                        <th style={{ textAlign: 'center' }}>Total Clientes</th>
                                        <th style={{ textAlign: 'center' }}>Activos</th>
                                        <th style={{ textAlign: 'center' }}>Inactivos</th>
                                        <th style={{ textAlign: 'center' }}>Total OT</th>
                                        <th style={{ textAlign: 'right' }}>Faturado (Kz)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {regiaoData.length === 0 && <tr><td colSpan={6}><div className="empty-state">Sem dados geográficos registados.</div></td></tr>}
                                    {regiaoData.map(r => (
                                        <tr key={r.regiao}>
                                            <td style={{ fontWeight: 700 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <MapPin size={12} style={{ color: 'var(--blue)' }} />
                                                    {r.regiao}
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center', fontWeight: 800, color: 'var(--blue)' }}>{r.clientes}</td>
                                            <td style={{ textAlign: 'center', color: 'var(--green)' }}>{r.ativos}</td>
                                            <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{r.inativos}</td>
                                            <td style={{ textAlign: 'center' }}>{r.nOT}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700, color: r.faturado > 0 ? 'var(--green)' : 'var(--text-muted)' }}>{fmtKz(r.faturado)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="table-count">{regiaoData.length} regiões</div>
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
                                <option value="Ajuste">Ajuste</option>
                                <option value="Transferência">Transferência</option>
                                <option value="Devolução">Devolução</option>
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
                                { label: 'Total',    value: filtMovimentos.length },
                                { label: 'Entradas', value: filtMovimentos.filter(m => m.tipo === 'Entrada').length,                              cls: 'green' },
                                { label: 'Saídas',   value: filtMovimentos.filter(m => m.tipo === 'Saída' || m.tipo === 'Devolução').length,  cls: 'muted' },
                                { label: 'Outros',   value: filtMovimentos.filter(m => m.tipo === 'Ajuste' || m.tipo === 'Transferência').length, cls: 'blue' },
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
                                    {filtMovimentos.length === 0 && <tr><td colSpan={8}><div className="empty-state">Sem movimentos de stock registados.</div></td></tr>}
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

                {/* ── VENDAS (#170) ── */}
                {tab === 'vendas' && <VendasRelatorioTab onExportavel={onVendasExportavel} />}
            </div>

            {showExport && (
                <ExportModal
                    title={tab === 'vendas' ? vendasExport.titulo : tabLabel}
                    columns={tab === 'vendas' ? vendasExport.colunas : COLS[tab]}
                    data={tab === 'vendas' ? vendasExport.linhas : exportData[tab]}
                    filename={`relatorio_${tab}`}
                    onClose={() => setShowExport(false)}
                />
            )}
        </AppLayout>
    );
};

export default RelatoriosPage;
