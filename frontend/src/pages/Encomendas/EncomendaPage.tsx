import React, { useState } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import SearchableSelect from '../../components/SearchableSelect';
import {
    useGlobal, Encomenda, EncomendaLinha, EncomendaEstado,
} from '../../contexts/GlobalContext';
import {
    Search, Plus, X, AlertCircle, Check, ShoppingCart,
    Package, Printer, ChevronDown, Archive, Download,
} from 'lucide-react';
import ExportModal, { ExportCol } from '../../components/ExportModal';

/* ══ Helpers ════════════════════════════════════════════════ */
const fmt = (n: number) => n.toLocaleString('pt-PT');
const fmtMoney = (n: number, m = 'AOA') => `${fmt(n)} ${m}`;
const fmtDate  = (s: string) => s ? new Date(s).toLocaleDateString('pt-PT') : '—';
const linhaTotal = (l: EncomendaLinha) =>
    l.qtdEncomendada * l.custoUnit * (1 - l.desconto / 100);
const encTotal = (e: Encomenda) => e.linhas.reduce((s, l) => s + linhaTotal(l), 0);

const ESTADO_STYLE: Record<EncomendaEstado, { cls: string; label: string }> = {
    Aberta:    { cls: 'tbadge tbadge-campo',   label: 'Aberta' },
    Parcial:   { cls: 'tbadge tbadge-suporte', label: 'Parcial' },
    Recebida:  { cls: 'tbadge tbadge-admin',   label: 'Recebida' },
    Cancelada: { cls: 'tbadge tbadge-vendedor', label: 'Cancelada' },
};

/* ══ Receber Modal ══════════════════════════════════════════ */
interface ReceberModalProps {
    encomenda: Encomenda;
    onClose: () => void;
    onConfirm: (recebidas: { artigoId: string; qtd: number }[], armazem: string) => void;
}
const ReceberModal: React.FC<ReceberModalProps> = ({ encomenda, onClose, onConfirm }) => {
    const { armazens } = useGlobal();
    const armazensOpts = armazens.map(a => ({ value: a.codigo, label: `${a.codigo} — ${a.nome}` }));
    const defaultArmazem = armazens[0]?.codigo ?? '';

    const [qtds, setQtds]       = useState<Record<string, string>>(
        Object.fromEntries(
            encomenda.linhas.map(l => [l.artigoId, String(l.qtdEncomendada - l.qtdRecebida)])
        )
    );
    const [armazem, setArmazem] = useState(defaultArmazem);

    const handleConfirm = () => {
        const recebidas = encomenda.linhas
            .map(l => ({ artigoId: l.artigoId, qtd: Number(qtds[l.artigoId] ?? 0) }))
            .filter(r => r.qtd > 0);
        if (recebidas.length === 0) return;
        onConfirm(recebidas, armazem);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 560 }}>
                <div className="modal-header">
                    <h3 className="modal-title">Receber Encomenda — {encomenda.numero}</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body">
                    <div className="form-group" style={{ marginBottom: 14 }}>
                        <label className="form-label req">Armazém de Destino</label>
                        <select className="form-select" value={armazem} onChange={e => setArmazem(e.target.value)}>
                            {armazensOpts.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                        </select>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            Os artigos recebidos serão registados neste armazém.
                        </div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                        Indique as quantidades efectivamente recebidas nesta entrega:
                    </div>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Artigo</th>
                                <th style={{ textAlign: 'right' }}>Enc.</th>
                                <th style={{ textAlign: 'right' }}>Já rec.</th>
                                <th style={{ textAlign: 'right' }}>Pendente</th>
                                <th style={{ width: 90, textAlign: 'right' }}>Receber agora</th>
                            </tr>
                        </thead>
                        <tbody>
                            {encomenda.linhas.map(l => {
                                const pendente = l.qtdEncomendada - l.qtdRecebida;
                                return (
                                    <tr key={l.artigoId}>
                                        <td style={{ fontSize: '0.8rem' }}>
                                            <div style={{ fontWeight: 600 }}>{l.descricao}</div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.73rem' }}>{l.codigo}</div>
                                        </td>
                                        <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>{fmt(l.qtdEncomendada)}</td>
                                        <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{fmt(l.qtdRecebida)}</td>
                                        <td style={{ textAlign: 'right', fontSize: '0.8rem', color: pendente === 0 ? 'var(--green)' : 'var(--orange,#f97316)', fontWeight: 600 }}>
                                            {fmt(pendente)}
                                        </td>
                                        <td>
                                            <input type="number" min={0} max={pendente}
                                                className="form-input"
                                                style={{ textAlign: 'right', padding: '4px 8px', height: 30, fontSize: '0.8rem' }}
                                                value={qtds[l.artigoId] ?? ''}
                                                disabled={pendente === 0}
                                                onChange={e => setQtds(p => ({ ...p, [l.artigoId]: e.target.value }))}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="modal-footer">
                    <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                    <button type="button" className="abtn abtn-primary" onClick={handleConfirm}>
                        <Check size={12} /> Confirmar Recepção
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ══ Print Modal (Nota de Encomenda) ════════════════════════ */
const PrintModal: React.FC<{ encomenda: Encomenda; fornecedorNome: string; onClose: () => void }> = ({ encomenda, fornecedorNome, onClose }) => {
    const total = encTotal(encomenda);
    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 700, fontFamily: 'monospace' }}>
                <div className="modal-header">
                    <h3 className="modal-title"><Printer size={14} style={{ marginRight: 6 }} />Nota de Encomenda</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body" style={{ fontSize: '0.8rem' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>AQUATEX — Tratamento de Águas, Lda.</div>
                            <div style={{ color: 'var(--text-muted)' }}>Rua da Samba, Luanda, Angola</div>
                            <div style={{ color: 'var(--text-muted)' }}>NIF: 5000012345 · Tel: +244 222 123 456</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>NOTA DE ENCOMENDA</div>
                            <div>Nº {encomenda.numero}</div>
                            <div style={{ color: 'var(--text-muted)' }}>Data: {fmtDate(encomenda.data)}</div>
                        </div>
                    </div>
                    <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
                    {/* Supplier */}
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontWeight: 600 }}>Fornecedor</div>
                        <div>{fornecedorNome}</div>
                        <div style={{ color: 'var(--text-muted)' }}>Data prevista entrega: {fmtDate(encomenda.dataEntrega)}</div>
                        <div style={{ color: 'var(--text-muted)' }}>Cond. pagamento: {encomenda.condicoesPagamento}</div>
                    </div>
                    {/* Lines */}
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Código</th>
                                <th>Descrição</th>
                                <th style={{ textAlign: 'center' }}>UN</th>
                                <th style={{ textAlign: 'right' }}>Qtd</th>
                                <th style={{ textAlign: 'right' }}>Custo Un.</th>
                                <th style={{ textAlign: 'right' }}>Desc.%</th>
                                <th style={{ textAlign: 'right' }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {encomenda.linhas.map((l, i) => (
                                <tr key={i}>
                                    <td style={{ fontFamily: 'monospace', fontSize: '0.76rem' }}>{l.codigo}</td>
                                    <td style={{ fontSize: '0.8rem' }}>{l.descricao}</td>
                                    <td style={{ textAlign: 'center', fontSize: '0.78rem' }}>{l.unidade}</td>
                                    <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>{fmt(l.qtdEncomendada)}</td>
                                    <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>{fmtMoney(l.custoUnit, encomenda.moeda)}</td>
                                    <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>{l.desconto > 0 ? `${l.desconto}%` : '—'}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.8rem' }}>{fmtMoney(linhaTotal(l), encomenda.moeda)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700, paddingTop: 8 }}>Total</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.9rem', paddingTop: 8 }}>{fmtMoney(total, encomenda.moeda)}</td>
                            </tr>
                        </tfoot>
                    </table>
                    {encomenda.observacoes && (
                        <div style={{ marginTop: 16, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Obs: {encomenda.observacoes}
                        </div>
                    )}
                    <div style={{ marginTop: 24, color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                        Responsável: {encomenda.responsavel}
                    </div>
                </div>
                <div className="modal-footer">
                    <button type="button" className="abtn abtn-secondary" onClick={onClose}>Fechar</button>
                    <button type="button" className="abtn abtn-primary" onClick={() => window.print()}>
                        <Printer size={12} /> Imprimir
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ══ Encomenda Form Modal ═══════════════════════════════════ */
const TABS_E = [
    { id: 'cabecalho', label: 'Cabeçalho' },
    { id: 'artigos',   label: 'Artigos' },
    { id: 'recebido',  label: 'Recebido' },
] as const;
type ETab = typeof TABS_E[number]['id'];

interface EncomendaModalProps {
    encomenda?: Encomenda;
    onClose: () => void;
    onSave: (e: Omit<Encomenda, 'id' | 'numero'>) => void;
}
const EncomendaModal: React.FC<EncomendaModalProps> = ({ encomenda, onClose, onSave }) => {
    const { fornecedores, artigos, currentUser } = useGlobal();
    const [tab, setTab] = useState<ETab>('cabecalho');

    // Cabeçalho
    const [fornecedorId,    setFornId]   = useState(encomenda?.fornecedorId          ?? '');
    const [data,            setData]     = useState(encomenda?.data                  ?? new Date().toISOString().split('T')[0]);
    const [dataEntrega,     setDataEnt]  = useState(encomenda?.dataEntrega            ?? '');
    const [condPagamento,   setCondPag]  = useState(encomenda?.condicoesPagamento     ?? '30 Dias');
    const [responsavel,     setResp]     = useState(encomenda?.responsavel            ?? currentUser?.nome ?? 'Administrador');
    const [moeda,           setMoeda]    = useState(encomenda?.moeda                  ?? 'AOA');
    const [descricao,       setDesc]     = useState(encomenda?.descricao              ?? '');
    const [observacoes,     setObs]      = useState(encomenda?.observacoes            ?? '');

    // Linhas artigos
    const [linhas, setLinhas] = useState<EncomendaLinha[]>(
        encomenda?.linhas ?? []
    );
    const [lineArtId, setLineArtId] = useState<string[]>(encomenda?.linhas.map(l => l.artigoId) ?? []);

    const fornOpts = fornecedores.map(f => ({ value: f.id, label: f.nome, sub: f.nif }));
    const artigoOpts = artigos.map(a => ({ value: a.id, label: a.descricao, sub: a.codigo }));

    const addLinha = () => {
        setLinhas(p => [...p, { artigoId: '', codigo: '', descricao: '', qtdEncomendada: 1, qtdRecebida: 0, unidade: 'UN', custoUnit: 0, desconto: 0 }]);
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
            setLinhas(p => p.map((l, j) => j === i ? { ...l, artigoId: a.id, codigo: a.codigo, descricao: a.descricao, custoUnit: a.custoMedio || a.precoUnitario, unidade: 'UN' } : l));
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

    const handleSave = () => {
        if (!validate()) { setTab('cabecalho'); return; }
        const totalRec = linhas.reduce((s, l) => s + l.qtdRecebida, 0);
        const totalEnc = linhas.reduce((s, l) => s + l.qtdEncomendada, 0);
        const estado: EncomendaEstado = encomenda?.estado ?? 'Aberta';
        onSave({ fornecedorId, data, dataEntrega, condicoesPagamento: condPagamento, responsavel, moeda, descricao, observacoes, estado, linhas });
    };

    const totalEnc  = linhas.reduce((s, l) => s + linhaTotal(l), 0);

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 760 }}>
                <div className="modal-header">
                    <h3 className="modal-title">{encomenda ? `Encomenda ${encomenda.numero}` : 'Nova Encomenda'}</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
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
                        <div className="form-row">
                            <div className="form-group" style={{ flex: 2 }}>
                                <label className="form-label req">Fornecedor</label>
                                <SearchableSelect
                                    options={fornOpts}
                                    value={fornecedorId}
                                    onChange={v => setFornId(v)}
                                    placeholder="Seleccionar fornecedor..."
                                />
                                {errors.fornecedor && <span className="form-error"><AlertCircle size={11} /> {errors.fornecedor}</span>}
                            </div>
                            <div className="form-group">
                                <label className="form-label req">Data</label>
                                <input type="date" className="form-input" value={data} onChange={e => setData(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Data Entrega</label>
                                <input type="date" className="form-input" value={dataEntrega} onChange={e => setDataEnt(e.target.value)} />
                            </div>
                        </div>
                        <div className="form-row">
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
                            <div className="form-group">
                                <label className="form-label">Responsável</label>
                                <input className="form-input" value={responsavel} readOnly style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'default' }} />
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
                        <div className="form-group">
                            <label className="form-label req">Descrição</label>
                            <input className={`form-input${errors.descricao ? ' err' : ''}`} value={descricao}
                                onChange={e => setDesc(e.target.value)} placeholder="Ex: Pedido Compra N.º 0000004" />
                            {errors.descricao && <span className="form-error"><AlertCircle size={11} /> {errors.descricao}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Observações</label>
                            <textarea className="form-input" rows={2} style={{ resize: 'vertical' }}
                                value={observacoes} onChange={e => setObs(e.target.value)}
                                placeholder="Notas internas..." />
                        </div>
                    </>)}

                    {/* ── Artigos ── */}
                    {tab === 'artigos' && (<>
                        {errors.linhas && (
                            <div style={{ color: 'var(--red,#ef4444)', fontSize: '0.8rem', marginBottom: 8 }}>
                                <AlertCircle size={11} style={{ marginRight: 4 }} />{errors.linhas}
                            </div>
                        )}
                        <table className="data-table" style={{ marginBottom: 8 }}>
                            <thead>
                                <tr>
                                    <th>Artigo</th>
                                    <th style={{ width: 50, textAlign: 'center' }}>UN</th>
                                    <th style={{ width: 70, textAlign: 'right' }}>Qtd</th>
                                    <th style={{ width: 110, textAlign: 'right' }}>Custo Unit.</th>
                                    <th style={{ width: 60, textAlign: 'right' }}>Desc%</th>
                                    <th style={{ width: 110, textAlign: 'right' }}>Total</th>
                                    <th style={{ width: 30 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {linhas.length === 0 && (
                                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16, fontSize: '0.8rem' }}>
                                        Nenhuma linha. Clique em "Adicionar Linha".
                                    </td></tr>
                                )}
                                {linhas.map((l, i) => (
                                    <tr key={i}>
                                        <td>
                                            <SearchableSelect
                                                options={artigoOpts}
                                                value={lineArtId[i]}
                                                onChange={v => selectArtigo(i, v)}
                                                placeholder="Artigo..."
                                            />
                                            {l.codigo && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{l.codigo}</div>}
                                        </td>
                                        <td>
                                            <input className="form-input" style={{ textAlign: 'center', padding: '4px 6px', fontSize: '0.78rem' }}
                                                value={l.unidade} onChange={e => updateLinha(i, 'unidade', e.target.value)} />
                                        </td>
                                        <td>
                                            <input type="number" min={1} className="form-input"
                                                style={{ textAlign: 'right', padding: '4px 6px', fontSize: '0.78rem' }}
                                                value={l.qtdEncomendada}
                                                onChange={e => updateLinha(i, 'qtdEncomendada', Number(e.target.value))} />
                                        </td>
                                        <td>
                                            <input type="number" min={0} step="0.01" className="form-input"
                                                style={{ textAlign: 'right', padding: '4px 6px', fontSize: '0.78rem' }}
                                                value={l.custoUnit}
                                                onChange={e => updateLinha(i, 'custoUnit', Number(e.target.value))} />
                                        </td>
                                        <td>
                                            <input type="number" min={0} max={100} className="form-input"
                                                style={{ textAlign: 'right', padding: '4px 6px', fontSize: '0.78rem' }}
                                                value={l.desconto}
                                                onChange={e => updateLinha(i, 'desconto', Number(e.target.value))} />
                                        </td>
                                        <td style={{ textAlign: 'right', fontSize: '0.78rem', fontWeight: 600 }}>
                                            {fmt(Math.round(linhaTotal(l)))}
                                        </td>
                                        <td>
                                            <button type="button" className="icon-btn" title="Remover" onClick={() => removeLinha(i)}>
                                                <X size={11} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            {linhas.length > 0 && (
                                <tfoot>
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.82rem', paddingTop: 8 }}>Total Encomenda</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.88rem', color: 'var(--blue)', paddingTop: 8 }}>
                                            {fmtMoney(Math.round(totalEnc), moeda)}
                                        </td>
                                        <td />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                        <button type="button" className="abtn abtn-ghost" onClick={addLinha} style={{ fontSize: '0.78rem' }}>
                            <Plus size={12} /> Adicionar Linha
                        </button>
                    </>)}

                    {/* ── Recebido ── */}
                    {tab === 'recebido' && (
                        encomenda ? (
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Artigo</th>
                                        <th style={{ textAlign: 'right' }}>Encomendado</th>
                                        <th style={{ textAlign: 'right' }}>Recebido</th>
                                        <th style={{ textAlign: 'right' }}>Pendente</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {linhas.map((l, i) => {
                                        const pendente = l.qtdEncomendada - l.qtdRecebida;
                                        return (
                                            <tr key={i}>
                                                <td style={{ fontSize: '0.8rem' }}>
                                                    <div style={{ fontWeight: 600 }}>{l.descricao}</div>
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.73rem' }}>{l.codigo}</div>
                                                </td>
                                                <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>{fmt(l.qtdEncomendada)}</td>
                                                <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--green)', fontWeight: 600 }}>{fmt(l.qtdRecebida)}</td>
                                                <td style={{ textAlign: 'right', fontSize: '0.8rem', color: pendente > 0 ? 'var(--orange,#f97316)' : 'var(--green)', fontWeight: 600 }}>{fmt(pendente)}</td>
                                                <td>
                                                    <span style={{
                                                        fontSize: '0.73rem', borderRadius: 10, padding: '2px 8px',
                                                        background: pendente === 0 ? 'var(--green-light,#f0fdf4)' : '#fffbeb',
                                                        color: pendente === 0 ? 'var(--green)' : 'var(--orange,#f97316)',
                                                        fontWeight: 600,
                                                    }}>
                                                        {pendente === 0 ? 'Recebido' : 'Pendente'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: 24 }}>
                                Guarde a encomenda para registar recepções.
                            </div>
                        )
                    )}
                </div>

                <div className="modal-footer">
                    <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                    <button type="button" className="abtn abtn-primary" onClick={handleSave}>
                        <Check size={12} /> Guardar
                    </button>
                </div>
            </div>
        </div>
    );
};

const COLS_ENC: ExportCol[] = [
    { key: 'numero',         label: 'Nº Encomenda' },
    { key: 'fornecedorNome', label: 'Fornecedor' },
    { key: 'data',           label: 'Data' },
    { key: 'dataEntrega',    label: 'Data Entrega' },
    { key: 'responsavel',    label: 'Responsável' },
    { key: 'estado',         label: 'Estado' },
    { key: 'total',          label: 'Total' },
];

/* ══ Page ════════════════════════════════════════════════════ */
const EncomendaPage: React.FC = () => {
    const { encomendas, addEncomenda, updateEncomenda, receberLinhas, fornecedores, updateArtigo, addMovimento, currentUser } = useGlobal();

    const [search,    setSearch]    = useState('');
    const [filterEst, setFEst]      = useState('');
    const [modal,     setModal]     = useState<'new' | string | null>(null);
    const [receber,   setReceber]   = useState<string | null>(null);
    const [printId,   setPrintId]   = useState<string | null>(null);
    const [toast,      setToast]     = useState('');
    const [showExport, setShowExport] = useState(false);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    const getFornNome = (id: string) => fornecedores.find(f => f.id === id)?.nome ?? id;

    const filtered = encomendas.filter(e => {
        const q = search.toLowerCase();
        const matchQ = !q || e.numero.toLowerCase().includes(q) || e.descricao.toLowerCase().includes(q) || getFornNome(e.fornecedorId).toLowerCase().includes(q);
        const matchE = !filterEst || e.estado === filterEst;
        return matchQ && matchE;
    });

    const exportData = filtered.map(e => ({
        ...e,
        fornecedorNome: getFornNome(e.fornecedorId),
        data: fmtDate(e.data),
        dataEntrega: fmtDate(e.dataEntrega),
        total: Math.round(encTotal(e)),
    }));

    // Stats
    const abertas   = encomendas.filter(e => e.estado === 'Aberta').length;
    const parciais  = encomendas.filter(e => e.estado === 'Parcial').length;
    const recebidas = encomendas.filter(e => e.estado === 'Recebida').length;
    const valorAberto = encomendas.filter(e => e.estado !== 'Cancelada' && e.estado !== 'Recebida').reduce((s, e) => s + encTotal(e), 0);

    const editTarget  = typeof modal === 'string' && modal !== 'new' ? encomendas.find(e => e.id === modal) : undefined;
    const receberEnc  = receber ? encomendas.find(e => e.id === receber) : null;
    const printEnc    = printId ? encomendas.find(e => e.id === printId) : null;

    const handleSave = (data: Omit<Encomenda, 'id' | 'numero'>) => {
        if (typeof modal === 'string' && modal !== 'new') {
            updateEncomenda(modal, data);
            showToast('Encomenda actualizada.');
        } else {
            const numero = `N-${String(encomendas.length + 1).padStart(6, '0')}`;
            const e = addEncomenda({ ...data, numero });
            showToast(`Encomenda ${e.numero} criada.`);
        }
        setModal(null);
    };

    const handleReceber = (encId: string, recebidas: { artigoId: string; qtd: number }[], armazem: string) => {
        receberLinhas(encId, recebidas);
        const hoje = new Date().toISOString().split('T')[0];
        recebidas.forEach(r => {
            updateArtigo(r.artigoId, { codigoArmazem: armazem });
            addMovimento({ artigoId: r.artigoId, tipo: 'entrada', quantidade: r.qtd, armazemId: armazem, referencia: encId, usuario: currentUser?.email, observacao: `Recepção ${encId}`, data: hoje });
        });
        showToast(`Recepção registada → ${armazem}. Stock actualizado.`);
    };

    const handleCancelar = (id: string) => {
        updateEncomenda(id, { estado: 'Cancelada' });
        showToast('Encomenda cancelada.');
    };

    return (
        <AppLayout>
            <ActionBar title="Encomendas" breadcrumb="AQUATEX SGI · Encomendas">
                <div className="actionbar-spacer" />
                <button className="abtn abtn-secondary" type="button" onClick={() => setShowExport(true)}>
                    <Download size={13} /> Exportar
                </button>
                <button className="abtn abtn-primary" type="button" onClick={() => setModal('new')}>
                    <Plus size={13} /> Nova Encomenda
                </button>
            </ActionBar>

            <div className="page-content">
                {/* Stats */}
                <div className="stats-row">
                    {[
                        { label: 'Em Aberto',       value: abertas,                    cls: 'blue' },
                        { label: 'Parcialmente Rec.', value: parciais,                  cls: 'orange' },
                        { label: 'Recebidas',        value: recebidas,                  cls: 'green' },
                        { label: 'Valor em Aberto',  value: fmtMoney(valorAberto),      cls: 'blue' },
                    ].map(s => (
                        <div key={s.label} className="stat-card">
                            <span className="stat-label">{s.label}</span>
                            <span className={`stat-value ${s.cls}`} >{s.value}</span>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="filters-bar">
                    <div className="search-wrap">
                        <Search className="search-icon" />
                        <input className="search-input" placeholder="Pesquisar por número, fornecedor ou descrição..."
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select className="filter-select" value={filterEst} onChange={e => setFEst(e.target.value)}>
                        <option value="">Todos os estados</option>
                        <option value="Aberta">Aberta</option>
                        <option value="Parcial">Parcial</option>
                        <option value="Recebida">Recebida</option>
                        <option value="Cancelada">Cancelada</option>
                    </select>
                </div>

                {/* Table */}
                <div className="table-container">
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 20 }} />
                                    <th>Nº Encomenda</th>
                                    <th>Fornecedor</th>
                                    <th>Data</th>
                                    <th>Data Entrega</th>
                                    <th>Responsável</th>
                                    <th style={{ textAlign: 'right' }}>Total</th>
                                    <th>Estado</th>
                                    <th style={{ width: 130 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr><td colSpan={9}><div className="empty-state"><ShoppingCart size={28} /><br />Nenhuma encomenda encontrada.</div></td></tr>
                                )}
                                {filtered.map(e => {
                                    const vencida = e.dataEntrega && e.estado === 'Aberta' && new Date(e.dataEntrega) < new Date();
                                    return (
                                        <tr key={e.id} style={{ opacity: e.estado === 'Cancelada' ? 0.5 : 1 }}>
                                            <td style={{ paddingLeft: 10 }}>
                                                <span className={`dot ${e.estado === 'Recebida' ? 'dot-green' : e.estado === 'Parcial' ? 'dot-orange' : e.estado === 'Cancelada' ? 'dot-gray' : vencida ? 'dot-red' : 'dot-blue'}`} />
                                            </td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 600, color: 'var(--blue)' }}>
                                                {e.numero}
                                            </td>
                                            <td style={{ fontWeight: 600, fontSize: '0.83rem' }}>{getFornNome(e.fornecedorId)}</td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fmtDate(e.data)}</td>
                                            <td style={{ fontSize: '0.78rem', color: vencida ? 'var(--red,#ef4444)' : 'var(--text-muted)', fontWeight: vencida ? 600 : 400 }}>
                                                {fmtDate(e.dataEntrega)}
                                                {vencida && ' ⚠'}
                                            </td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{e.responsavel || '—'}</td>
                                            <td style={{ textAlign: 'right', fontSize: '0.78rem', fontWeight: 600 }}>
                                                {fmtMoney(Math.round(encTotal(e)), e.moeda)}
                                            </td>
                                            <td>
                                                <span className={ESTADO_STYLE[e.estado].cls}>{ESTADO_STYLE[e.estado].label}</span>
                                            </td>
                                            <td>
                                                <div className="row-actions" style={{ gap: 4 }}>
                                                    <button className="icon-btn" title="Editar" onClick={() => setModal(e.id)}>
                                                        <Package size={12} />
                                                    </button>
                                                    {(e.estado === 'Aberta' || e.estado === 'Parcial') && (
                                                        <button className="abtn abtn-ghost" title="Receber" style={{ fontSize: '0.72rem', padding: '2px 8px', height: 24 }}
                                                            onClick={() => setReceber(e.id)}>
                                                            <Archive size={11} /> Receber
                                                        </button>
                                                    )}
                                                    <button className="icon-btn" title="Imprimir" onClick={() => setPrintId(e.id)}>
                                                        <Printer size={12} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="table-count">{filtered.length} encomendas</div>
                </div>
            </div>

            {/* Modals */}
            {modal !== null && (
                <EncomendaModal
                    encomenda={editTarget}
                    onClose={() => setModal(null)}
                    onSave={handleSave}
                />
            )}

            {receberEnc && (
                <ReceberModal
                    encomenda={receberEnc}
                    onClose={() => setReceber(null)}
                    onConfirm={(rec, arm) => handleReceber(receberEnc.id, rec, arm)}
                />
            )}

            {printEnc && (
                <PrintModal
                    encomenda={printEnc}
                    fornecedorNome={getFornNome(printEnc.fornecedorId)}
                    onClose={() => setPrintId(null)}
                />
            )}

            {showExport && (
                <ExportModal
                    title="Encomendas"
                    columns={COLS_ENC}
                    data={exportData}
                    filename="encomendas"
                    onClose={() => setShowExport(false)}
                />
            )}

            {toast && (
                <div className="toast" role="status">
                    <Check size={14} strokeWidth={2.5} style={{ color: 'var(--green)' }} />
                    <span>{toast}</span>
                </div>
            )}
        </AppLayout>
    );
};

export default EncomendaPage;
