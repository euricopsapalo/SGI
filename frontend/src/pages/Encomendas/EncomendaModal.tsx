import React, { useState } from 'react';
import { useModalA11y } from '../../components/useModalA11y';
import { extractErrorMessage, extractFieldErrors } from '../../utils/errorHandler';
import SearchableSelect from '../../components/SearchableSelect';
import { useGlobal, Encomenda, EncomendaLinha, EncomendaEstado } from '../../contexts/GlobalContext';
import { Plus, X, AlertCircle, Check, Package, Printer, Ban, RotateCcw } from 'lucide-react';
import { linhaTotal } from './encomendas.utils';
import { printNotaEntrada } from './encomendasImpressao';

/** #223 — extraído de EncomendaPage.tsx (divisão em componentes, sem alterações de comportamento). */

/* ══ Encomenda Form Modal ═══════════════════════════════════ */
export const TABS_E = [
    { id: 'cabecalho', label: 'Cabeçalho' },
    { id: 'artigos',   label: 'Artigos' },
    { id: 'recebido',  label: 'Recebido' },
] as const;
export type ETab = typeof TABS_E[number]['id'];

export interface EncomendaModalProps {
    encomenda?: Encomenda;
    onClose: () => void;
    onSave: (e: Omit<Encomenda, 'id' | 'numero'>) => Promise<void>;
    onAnularRececao?: (rececaoId: string) => void;
}
export const EncomendaModal: React.FC<EncomendaModalProps> = ({ encomenda, onClose, onSave, onAnularRececao }) => {
    const modalRef = useModalA11y(onClose); // #223 — Esc fecha e foco no modal (#45)
    const { fornecedores, artigos, taxasIva, currentUser, empresaConfig, fmt, fmtMoney } = useGlobal();
    const [tab, setTab] = useState<ETab>('cabecalho');

    // Cabeçalho
    const [fornecedorId,    setFornId]   = useState(encomenda?.fornecedorId          ?? '');
    const [data,            setData]     = useState(encomenda?.data                  ?? new Date().toISOString().split('T')[0]);
    const [dataEntrega,     setDataEnt]  = useState(encomenda?.dataEntrega            ?? '');
    const [condPagamento,   setCondPag]  = useState(encomenda?.condicoesPagamento     ?? '30 Dias');
    const [responsavel]                  = useState(encomenda?.responsavel            ?? currentUser?.nome ?? 'Administrador');
    const [moeda,           setMoeda]    = useState(encomenda?.moeda                  ?? 'AOA');
    const [descricao,       setDesc]     = useState(encomenda?.descricao              ?? '');
    const [observacoes,     setObs]      = useState(encomenda?.observacoes            ?? '');

    // Linhas artigos — fallback: derivar taxaIva do artigo se não estiver persistido
    const [linhas, setLinhas] = useState<EncomendaLinha[]>(() =>
        (encomenda?.linhas ?? []).map(l => {
            if ((l.taxaIva ?? 0) !== 0) return l;
            const art = artigos.find(a => a.id === l.artigoId);
            if (!art?.codigoIva) return l;
            const taxa = taxasIva.find(t => t.codigo === art.codigoIva)?.taxa ?? 0;
            return { ...l, codigoIva: art.codigoIva, taxaIva: taxa };
        })
    );
    const [lineArtId, setLineArtId] = useState<string[]>(encomenda?.linhas.map(l => l.artigoId) ?? []);

    const fornOpts = fornecedores.map(f => ({ value: f.id, label: f.nome, sub: f.nif }));
    const artigosFornecedor = fornecedorId
        ? artigos.filter(a => a.refFornecedor === fornecedorId)
        : artigos;
    const artigoOpts = artigosFornecedor.map(a => ({ value: a.id, label: a.descricao, sub: a.codigo }));

    const addLinha = () => {
        setLinhas(p => [...p, { artigoId: '', codigo: '', descricao: '', qtdEncomendada: 1, qtdRecebida: 0, unidade: 'UN', custoUnit: 0, desconto: 0, taxaIva: 0 }]);
        setLineArtId(p => [...p, '']);
    };
    const removeLinha = (i: number) => {
        setLinhas(p => p.filter((_, j) => j !== i));
        setLineArtId(p => p.filter((_, j) => j !== i));
    };
    const updateLinha = <K extends keyof EncomendaLinha>(i: number, field: K, val: EncomendaLinha[K]) => {
        setLinhas(p => p.map((l, j) => j === i ? { ...l, [field]: val } : l));
    };
    const selectArtigo = (i: number, artigoId: string) => {
        const a = artigos.find(x => x.id === artigoId);
        if (a) {
            const taxaIva = a.codigoIva ? (taxasIva.find(t => t.codigo === a.codigoIva)?.taxa ?? 0) : 0;
            setLinhas(p => p.map((l, j) => j === i ? {
                ...l, artigoId: a.id, codigo: a.codigo, descricao: a.descricao,
                custoUnit: a.precoCusto || a.custoMedio || a.precoUnitario,
                unidade: a.unidadeMedida || 'UN',
                codigoIva: a.codigoIva || undefined, taxaIva,
            } : l));
        }
        setLineArtId(p => p.map((v, j) => j === i ? artigoId : v));
    };

    const [errors, setErrors] = useState<Record<string, string>>({});
    const validate = () => {
        const e: Record<string, string> = {};
        if (!fornecedorId) e.fornecedor = 'Obrigatório';
        if (!descricao.trim()) e.descricao = 'Obrigatório';
        if (linhas.length === 0) e.linhas = 'Adicione pelo menos uma linha';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    // #212 — espera pelo servidor; em erro o modal fica aberto com o motivo.
    const [submitError, setSubmitError] = useState('');
    const [saving, setSaving] = useState(false);
    const handleSave = async () => {
        if (saving) return;
        if (!validate()) { setTab('cabecalho'); return; }
        const estado: EncomendaEstado = encomenda?.estado ?? 'Aberta';
        setSubmitError('');
        setSaving(true);
        try {
            await onSave({ fornecedorId, data, dataEntrega, condicoesPagamento: condPagamento, responsavel, moeda, descricao, observacoes, estado, linhas, rececoes: encomenda?.rececoes ?? [] });
        } catch (err) {
            const fe = extractFieldErrors(err);
            if (Object.keys(fe).length) setErrors(prev => ({ ...prev, ...fe }));
            setSubmitError(extractErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const subtotalEnc = linhas.reduce((s, l) => s + linhaTotal(l), 0);
    const totalIvaEnc = linhas.reduce((s, l) => s + linhaTotal(l) * ((l.taxaIva ?? 0) / 100), 0);
    const totalEnc    = subtotalEnc + totalIvaEnc;

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" ref={modalRef} role="dialog" aria-modal="true" tabIndex={-1} style={{ maxWidth: 760 }}>
                <div className="modal-header">
                    <h3 className="modal-title">{encomenda ? `Encomenda ${encomenda.numero}` : 'Nova Encomenda'}</h3>
                    <button className="modal-close" aria-label="Fechar" type="button" onClick={onClose}><X size={13} /></button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 20px' }}>
                    {TABS_E.map(t => (
                        <button key={t.id} type="button"
                            onClick={() => setTab(t.id)}
                            style={{
                                padding: '8px 14px', fontSize: '0.8rem', fontWeight: tab === t.id ? 600 : 400,
                                border: 'none', borderBottom: tab === t.id ? '2px solid var(--blue)' : '2px solid transparent',
                                background: 'none', cursor: 'pointer',
                                color: tab === t.id ? 'var(--blue)' : 'var(--text-secondary)',
                                marginBottom: -1,
                            }}>
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="modal-body">
                    {/* ── Cabeçalho ── */}
                    {tab === 'cabecalho' && (<>
                        {/* Grupo: Entidade */}
                        <div style={{ background: 'var(--bg-subtle,#f8fafc)', borderRadius: 8, padding: '14px 14px 6px', marginBottom: 12 }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Entidade</div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label req">Fornecedor</label>
                                <SearchableSelect
                                    options={fornOpts}
                                    value={fornecedorId}
                                    onChange={v => {
                                        setFornId(v);
                                        if (!encomenda) { setLinhas([]); setLineArtId([]); }
                                    }}
                                    placeholder="Seleccionar fornecedor..."
                                />
                                {errors.fornecedor && <span className="form-error"><AlertCircle size={11} /> {errors.fornecedor}</span>}
                            </div>
                            <div className="form-row" style={{ margin: '10px 0 0' }}>
                                <div className="form-group">
                                    <label className="form-label">Responsável</label>
                                    <input className="form-input" value={responsavel} readOnly
                                        style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'default' }} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Moeda</label>
                                    <select className="form-select" value={moeda} onChange={e => setMoeda(e.target.value)}>
                                        <option value="AOA">AOA — Kwanza</option>
                                        <option value="USD">USD — Dólar</option>
                                        <option value="EUR">EUR — Euro</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        {/* Grupo: Datas e Condições */}
                        <div style={{ background: 'var(--bg-subtle,#f8fafc)', borderRadius: 8, padding: '14px 14px 6px', marginBottom: 12 }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Datas e Condições</div>
                            <div className="form-row" style={{ margin: 0 }}>
                                <div className="form-group">
                                    <label className="form-label req">Data do Pedido</label>
                                    <input type="date" className="form-input" value={data} onChange={e => setData(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Data de Entrega</label>
                                    <input type="date" className="form-input" value={dataEntrega} onChange={e => setDataEnt(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Cond. Pagamento</label>
                                    <select className="form-select" value={condPagamento} onChange={e => setCondPag(e.target.value)}>
                                        <option value="Pronto Pagamento">Pronto Pagamento</option>
                                        <option value="15 Dias">15 Dias</option>
                                        <option value="30 Dias">30 Dias</option>
                                        <option value="30 - 30 Dias">30 - 30 Dias</option>
                                        <option value="60 Dias">60 Dias</option>
                                        <option value="90 Dias">90 Dias</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        {/* Grupo: Descrição e Notas */}
                        <div className="form-group">
                            <label className="form-label req">Descrição</label>
                            <input className={`form-input${errors.descricao ? ' err' : ''}`} value={descricao}
                                onChange={e => setDesc(e.target.value)} placeholder="Ex: Pedido Compra N.º 0000004" />
                            {errors.descricao && <span className="form-error"><AlertCircle size={11} /> {errors.descricao}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Observações</label>
                            <textarea className="form-input" rows={3} style={{ resize: 'vertical', lineHeight: 1.6 }}
                                value={observacoes} onChange={e => setObs(e.target.value)}
                                placeholder="Notas internas sobre esta encomenda..." />
                        </div>
                    </>)}

                    {/* ── Artigos ── */}
                    {tab === 'artigos' && (<>
                        {errors.linhas && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--red,#ef4444)', fontSize: '0.8rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', marginBottom: 10 }}>
                                <AlertCircle size={13} />{errors.linhas}
                            </div>
                        )}
                        {linhas.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '32px 0 24px', color: 'var(--text-muted)' }}>
                                <Package size={32} style={{ marginBottom: 10, opacity: 0.35 }} />
                                <div style={{ fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Nenhum artigo adicionado</div>
                                <div style={{ fontSize: '0.78rem', marginBottom: 16 }}>Clique no botão abaixo para adicionar artigos à encomenda.</div>
                                <button type="button" className="abtn abtn-secondary" onClick={addLinha}>
                                    <Plus size={12} /> Adicionar primeiro artigo
                                </button>
                            </div>
                        ) : (<>
                            <table className="data-table" style={{ marginBottom: 0 }}>
                                <thead>
                                    <tr>
                                        <th>Artigo</th>
                                        <th style={{ width: 44, textAlign: 'center' }}>UN</th>
                                        <th style={{ width: 65, textAlign: 'right' }}>Qtd</th>
                                        <th style={{ width: 105, textAlign: 'right' }}>Custo Unit.</th>
                                        <th style={{ width: 52, textAlign: 'right' }}>Desc%</th>
                                        <th style={{ width: 52, textAlign: 'right' }}>IVA%</th>
                                        <th style={{ width: 105, textAlign: 'right' }}>Total c/ IVA</th>
                                        <th style={{ width: 28 }} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {linhas.map((l, i) => (
                                        <tr key={i}>
                                            <td>
                                                <SearchableSelect
                                                    options={artigoOpts}
                                                    value={lineArtId[i]}
                                                    onChange={v => selectArtigo(i, v)}
                                                    placeholder="Seleccionar artigo..."
                                                />
                                                {l.codigo && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{l.codigo}</div>}
                                            </td>
                                            <td style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                                {l.unidade || 'UN'}
                                            </td>
                                            <td>
                                                <input type="number" min={1} className="form-input"
                                                    style={{ textAlign: 'right', padding: '4px 6px', fontSize: '0.78rem' }}
                                                    value={l.qtdEncomendada}
                                                    onChange={e => updateLinha(i, 'qtdEncomendada', Number(e.target.value))} />
                                            </td>
                                            <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-primary)', paddingRight: 8 }}>
                                                {fmt(l.custoUnit)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontSize: '0.8rem', color: l.desconto > 0 ? 'var(--orange,#f97316)' : 'var(--text-muted)', paddingRight: 8 }}>
                                                {l.desconto > 0 ? `${l.desconto}%` : '—'}
                                            </td>
                                            <td style={{ textAlign: 'right', fontSize: '0.8rem', paddingRight: 8 }}>
                                                {(l.taxaIva ?? 0) > 0
                                                    ? <span style={{ color: 'var(--blue)', fontWeight: 600 }}>{l.taxaIva}%</span>
                                                    : <span style={{ color: 'var(--text-muted)' }}>—</span>
                                                }
                                            </td>
                                            <td style={{ textAlign: 'right', fontSize: '0.78rem', fontWeight: 600 }}>
                                                <div>{fmt(Math.round(linhaTotal(l) * (1 + (l.taxaIva ?? 0) / 100)))}</div>
                                                {(l.taxaIva ?? 0) > 0 && (
                                                    <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                                        IVA: {fmt(Math.round(linhaTotal(l) * (l.taxaIva! / 100)))}
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <button type="button" className="icon-btn" title="Remover linha" onClick={() => removeLinha(i)}>
                                                    <X size={11} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {/* Summary + Add */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 2 }}>
                                <button type="button" className="abtn abtn-ghost" onClick={addLinha} style={{ fontSize: '0.78rem' }}>
                                    <Plus size={12} /> Adicionar Linha
                                </button>
                                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Subtotal s/ IVA</div>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{fmtMoney(Math.round(subtotalEnc), moeda)}</div>
                                    </div>
                                    {totalIvaEnc > 0 && (
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>IVA</div>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--blue)' }}>{fmtMoney(Math.round(totalIvaEnc), moeda)}</div>
                                        </div>
                                    )}
                                    <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border)', paddingLeft: 20 }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total Encomenda</div>
                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--blue)' }}>{fmtMoney(Math.round(totalEnc), moeda)}</div>
                                    </div>
                                </div>
                            </div>
                        </>)}
                    </>)}

                    {/* ── Recebido ── */}
                    {tab === 'recebido' && (
                        encomenda ? (<>
                            {/* ── Progresso por artigo ── */}
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                                    Progresso de Recepção
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {linhas.map((l, i) => {
                                        const pct = l.qtdEncomendada > 0 ? Math.min(100, (l.qtdRecebida / l.qtdEncomendada) * 100) : 0;
                                        const pendente = l.qtdEncomendada - l.qtdRecebida;
                                        const completo = pendente <= 0;
                                        return (
                                            <div key={i} style={{ background: 'var(--bg-subtle,#f8fafc)', borderRadius: 8, padding: '10px 14px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                                    <div>
                                                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{l.descricao}</span>
                                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 6 }}>{l.codigo}</span>
                                                    </div>
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, borderRadius: 10, padding: '2px 8px', flexShrink: 0,
                                                        background: completo ? '#dcfce7' : '#fffbeb',
                                                        color: completo ? '#15803d' : '#b45309' }}>
                                                        {completo ? 'Completo' : `Pendente: ${fmt(pendente)} ${l.unidade}`}
                                                    </span>
                                                </div>
                                                <div style={{ height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`,
                                                        background: completo ? 'var(--green,#22c55e)' : 'var(--blue)', transition: 'width 0.4s' }} />
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                                    <span>Recebido: <strong style={{ color: 'var(--green,#22c55e)' }}>{fmt(l.qtdRecebida)}</strong></span>
                                                    <span>Total: {fmt(l.qtdEncomendada)} {l.unidade}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            {/* ── Histórico de receções ── */}
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                                Histórico de Entregas
                            </div>
                            {encomenda.rececoes.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                    Nenhuma entrega registada ainda.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {[...encomenda.rececoes].sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime()).map((r, idx, arr) => (
                                        <div key={r.id} style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            background: r.estado === 'Anulada' ? 'transparent' : 'var(--bg-subtle,#f8fafc)',
                                            border: `1px solid ${r.estado === 'Anulada' ? 'var(--border)' : 'transparent'}`,
                                            borderRadius: 8, padding: '10px 14px',
                                            opacity: r.estado === 'Anulada' ? 0.55 : 1,
                                        }}>
                                            <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: r.estado === 'Anulada' ? '#fee2e2' : idx === 0 ? '#dcfce7' : 'var(--bg-secondary)',
                                                color: r.estado === 'Anulada' ? '#dc2626' : idx === 0 ? '#15803d' : 'var(--text-muted)' }}>
                                                {r.estado === 'Anulada' ? <Ban size={15} /> : <RotateCcw size={15} />}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.84rem', color: r.estado === 'Anulada' ? 'var(--red,#dc2626)' : 'var(--text-primary)' }}>
                                                        {r.guiaRemessa}
                                                    </span>
                                                    {idx === 0 && r.estado === 'Ativa' && (
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 600, background: '#dcfce7', color: '#15803d', borderRadius: 4, padding: '1px 6px' }}>mais recente</span>
                                                    )}
                                                    {r.estado === 'Anulada' && (
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 600, background: '#fee2e2', color: '#dc2626', borderRadius: 4, padding: '1px 6px' }}>Anulada</span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                    {new Date(r.dataHora).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    {' · '}{r.operador}{' · '}{r.armazem}
                                                    {' · '}{r.itens.length} artigo{r.itens.length !== 1 ? 's' : ''}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                                <button className="icon-btn" title="Reimprimir nota de entrada"
                                                    onClick={() => printNotaEntrada(r, encomenda, empresaConfig)}>
                                                    <Printer size={13} />
                                                </button>
                                                {r.estado === 'Ativa' && onAnularRececao && (
                                                    <button className="icon-btn" title="Anular receção" style={{ color: 'var(--red,#dc2626)' }}
                                                        onClick={() => onAnularRececao(r.id)}>
                                                        <Ban size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>) : (
                            <div style={{ textAlign: 'center', padding: '32px 0 24px', color: 'var(--text-muted)' }}>
                                <Package size={32} style={{ marginBottom: 10, opacity: 0.3 }} />
                                <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>Guarde a encomenda para registar recepções.</div>
                            </div>
                        )
                    )}
                </div>

                {submitError && (
                    <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 16px 4px', padding: '8px 10px', border: '1px solid var(--red)', borderRadius: 4, background: 'rgba(220,38,38,0.06)' }}>
                        <AlertCircle size={13} /> {submitError}
                    </div>
                )}
                <div className="modal-footer">
                    <button type="button" className="abtn abtn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
                    <button type="button" className="abtn abtn-primary" onClick={handleSave} disabled={saving} aria-busy={saving}>
                        <Check size={12} /> {saving ? 'A guardar…' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
};
