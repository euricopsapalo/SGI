import React, { useState } from 'react';
import { useModalA11y } from '../../components/useModalA11y';
import SearchableSelect from '../../components/SearchableSelect';
import { useGlobal, FaturaFornecedor } from '../../contexts/GlobalContext';
import { Plus, X, AlertCircle, Check, CreditCard } from 'lucide-react';

/** #223 — extraído de EncomendaPage.tsx (divisão em componentes, sem alterações de comportamento). */

/* ══ Compra Direta Modal ════════════════════════════════════ */
export interface CompraDiretaModalProps {
    onClose: () => void;
    onSave: (f: Omit<FaturaFornecedor, 'id'> & { faturasAssociadasIds?: string[] }) => void;
}
export const CompraDiretaModal: React.FC<CompraDiretaModalProps> = ({ onClose, onSave }) => {
    const modalRef = useModalA11y(onClose); // #223 — Esc fecha e foco no modal (#45)
    const { fornecedores, artigos, documentosCompra, taxasIva, fmtMoney, condicoesPagamento, modosPagamento, faturasFornecedor } = useGlobal();

    const [modalTab,    setModalTab]= useState<'documento' | 'condicoes'>('documento');
    const [fornId,      setFornId]  = useState('');
    const [tipoDoc,     setTipoDoc] = useState(documentosCompra[0]?.codigo ?? 'VFA');
    const [numFatura,   setNumFat]  = useState('');
    const [dataEm,      setDataEm]  = useState(new Date().toISOString().split('T')[0]);
    const [dataVenc,    setDataVenc]= useState('');
    const [desc,        setDesc]    = useState('');
    const [obs,         setObs]     = useState('');
    const [moeda,       setMoeda]   = useState('AOA');
    const [taxaRet,     setTaxaRet] = useState(0);
    const [condicaoPagId, setCondId]= useState('');
    const [modoPagId,   setModoId]  = useState('');

    // VNC-specific state
    const isVNC = tipoDoc === 'VNC';
    const [tipoNC,          setTipoNC]         = useState<'Devolucao' | 'AcertoPreco' | ''>('');
    const [faturasAssocIds, setFaturasAssocIds] = useState<string[]>([]);

    type Linha = {
        produtoId: string; descricaoCustomizada: string;
        quantidade: string; unidadeVenda: string;
        precoUnitarioNet: string; taxaIva: number;
        valorIva: number; codigoIsencao: string; valorTotalLinha: number;
    };
    const emptyLinha = (): Linha => ({
        produtoId: '', descricaoCustomizada: '', quantidade: '1',
        unidadeVenda: 'UN', precoUnitarioNet: '0', taxaIva: 0,
        valorIva: 0, codigoIsencao: '', valorTotalLinha: 0,
    });
    const [linhas, setLinhas] = useState<Linha[]>([emptyLinha()]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Auto-fill payment conditions from selected supplier
    React.useEffect(() => {
        const forn = fornecedores.find(f => f.id === fornId);
        if (forn) {
            if (forn.condicaoPagamentoId) setCondId(String(forn.condicaoPagamentoId));
            if (forn.modoPagamentoId)     setModoId(String(forn.modoPagamentoId));
        }
    }, [fornId, fornecedores]);

    // Reset VNC fields when document type changes
    React.useEffect(() => {
        if (tipoDoc !== 'VNC') { setTipoNC(''); setFaturasAssocIds([]); }
    }, [tipoDoc]);

    // Pre-populate article lines from associated invoices (Devolução mode)
    React.useEffect(() => {
        if (tipoDoc !== 'VNC' || tipoNC !== 'Devolucao' || faturasAssocIds.length === 0) return;
        const novasLinhas: typeof linhas = [];
        for (const fatId of faturasAssocIds) {
            const fat = faturasFornecedor.find(f => f.id === fatId);
            if (!fat) continue;
            for (const l of fat.linhas) {
                novasLinhas.push({
                    produtoId: l.produtoId ?? '', descricaoCustomizada: l.descricaoCustomizada ?? '',
                    quantidade: String(l.quantidade), unidadeVenda: l.unidadeVenda,
                    precoUnitarioNet: String(l.precoUnitarioNet), taxaIva: l.taxaIva,
                    valorIva: l.valorIva, codigoIsencao: l.codigoIsencao ?? '',
                    valorTotalLinha: l.valorTotalLinha,
                });
            }
        }
        if (novasLinhas.length > 0) setLinhas(novasLinhas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [faturasAssocIds, tipoNC, tipoDoc]);

    const fornOpts = fornecedores.map(f => ({ value: f.id, label: f.nome, sub: f.nif }));
    // refFornecedor stores the supplier ID — filter artigos by selected supplier
    const artigoOpts = artigos
        .filter(a => !fornId || !a.refFornecedor || a.refFornecedor === fornId)
        .map(a => ({ value: a.id, label: a.descricao, sub: a.codigo }));

    const selectArtigo = (i: number, artigoId: string) => {
        const a = artigos.find(x => x.id === artigoId);
        if (!a) return;
        // Auto-fill supplier when article is selected first
        if (!fornId && a.refFornecedor) setFornId(a.refFornecedor);
        const taxaIva = a.codigoIva ? (taxasIva.find(t => t.codigo === a.codigoIva)?.taxa ?? 0) : 0;
        const preco = a.precoCusto || a.custoMedio || 0;
        setLinhas(p => p.map((l, j) => j === i ? {
            ...l, produtoId: artigoId, descricaoCustomizada: a.descricao,
            unidadeVenda: a.unidadeMedida || 'UN', precoUnitarioNet: String(preco), taxaIva,
        } : l));
    };
    const updateLinha = <K extends keyof Linha>(i: number, field: K, val: Linha[K]) =>
        setLinhas(p => p.map((l, j) => j === i ? { ...l, [field]: val } : l));
    const recalcLinha = (l: Linha): Linha => {
        const qtd  = Number(l.quantidade) || 0;
        const preco = Number(l.precoUnitarioNet) || 0;
        const base = qtd * preco;
        const iva  = Math.round(base * l.taxaIva / 100 * 100) / 100;
        return { ...l, valorIva: iva, valorTotalLinha: base + iva };
    };

    const linhasCalc = linhas.map(recalcLinha);
    const totalLiq = linhasCalc.reduce((s, l) => s + (Number(l.quantidade) || 0) * (Number(l.precoUnitarioNet) || 0), 0);
    const totalIva = linhasCalc.reduce((s, l) => s + l.valorIva, 0);
    const retencao = Math.round(totalLiq * taxaRet / 100 * 100) / 100;
    const totalFin = totalLiq + totalIva - retencao;

    const validate = () => {
        const e: Record<string, string> = {};
        if (!fornId) e.fornecedor = 'Obrigatório';
        if (!numFatura.trim()) e.numFatura = 'Obrigatório';
        if (isVNC && !tipoNC) e.tipoNC = 'Seleccione o tipo de nota de crédito';
        if (!isVNC && linhasCalc.length === 0) e.linhas = 'Adicione pelo menos uma linha';
        if (isVNC && tipoNC === 'AcertoPreco' && (!linhas[0]?.descricaoCustomizada?.trim() || !(Number(linhas[0]?.precoUnitarioNet) > 0)))
            e.linhas = 'Indique a descrição e o valor do acerto';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSave = () => {
        if (!validate()) return;
        onSave({
            fornecedorId: fornId, tipoDocumento: tipoDoc,
            numFaturaExterno: numFatura.trim(), dataEmissao: dataEm,
            dataVencimento: dataVenc || undefined, moeda, taxaCambio: 1,
            totalLiquido: Math.round(totalLiq * 100) / 100,
            totalIva: Math.round(totalIva * 100) / 100,
            totalRetencao: retencao,
            totalFinal: Math.round(totalFin * 100) / 100,
            estadoPagamento: 'Pendente', observacoes: obs || undefined,
            descricao: desc || undefined,
            condicaoPagamentoId: condicaoPagId || undefined,
            modoPagamentoId: modoPagId || undefined,
            tipoNotaCredito: isVNC ? (tipoNC as 'Devolucao' | 'AcertoPreco') || null : null,
            estadoDocumento: isVNC ? 'Rascunho' : 'NA',
            faturasAssociadasIds: isVNC ? faturasAssocIds : [],
            linhas: linhasCalc.map(l => ({
                produtoId: l.produtoId || undefined, descricaoCustomizada: l.descricaoCustomizada,
                quantidade: Number(l.quantidade) || 0, unidadeVenda: l.unidadeVenda,
                precoUnitarioNet: Number(l.precoUnitarioNet) || 0,
                taxaIva: l.taxaIva, valorIva: l.valorIva,
                codigoIsencao: l.codigoIsencao || undefined, valorTotalLinha: l.valorTotalLinha,
            })),
        });
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" ref={modalRef} role="dialog" aria-modal="true" tabIndex={-1} style={{ maxWidth: 820 }}>
                <div className="modal-header">
                    <h3 className="modal-title">
                        <CreditCard size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                        Compra
                    </h3>
                    <button className="modal-close" aria-label="Fechar" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
                    {(['documento', 'condicoes'] as const).map(t => (
                        <button key={t} type="button" onClick={() => setModalTab(t)}
                            style={{ padding: '8px 14px', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer', borderBottom: modalTab === t ? '2px solid var(--primary)' : '2px solid transparent', color: modalTab === t ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: modalTab === t ? 600 : 400 }}>
                            {t === 'documento' ? 'Documento' : 'Condições'}
                            {t === 'condicoes' && (condicaoPagId || modoPagId) && (
                                <span style={{ marginLeft: 5, width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block', verticalAlign: 'middle' }} />
                            )}
                        </button>
                    ))}
                </div>
                <div className="modal-body" style={{ maxHeight: '74vh', overflowY: 'auto' }}>
                {modalTab === 'condicoes' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ background: 'var(--bg-subtle,#f8fafc)', borderRadius: 8, padding: '12px 14px' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Condições Comerciais</div>
                            <div className="form-group">
                                <label className="form-label">Condição de Pagamento</label>
                                <select className="form-select" value={condicaoPagId} onChange={e => setCondId(e.target.value)}>
                                    <option value="">Seleccionar...</option>
                                    {condicoesPagamento.map(c => <option key={c.id} value={c.id}>{c.descricao}{c.numDias > 0 ? ` (${c.numDias} dias)` : ''}</option>)}
                                </select>
                                {condicaoPagId && (() => {
                                    const c = condicoesPagamento.find(x => x.id === condicaoPagId);
                                    return c ? (
                                        <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: 4, padding: '6px 10px', display: 'flex', gap: 16 }}>
                                            <span><strong>Prazo:</strong> {c.numDias === 0 ? 'Pronto pagamento' : `${c.numDias} dias`}</span>
                                            {c.desconto > 0 && <span><strong>Desconto:</strong> {c.desconto}%</span>}
                                        </div>
                                    ) : null;
                                })()}
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Modo de Pagamento</label>
                                <select className="form-select" value={modoPagId} onChange={e => setModoId(e.target.value)}>
                                    <option value="">Seleccionar...</option>
                                    {modosPagamento.map(m => <option key={m.id} value={m.id}>{m.movimento} — {m.descricao}</option>)}
                                </select>
                            </div>
                        </div>
                        {!fornId && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                                Seleccione um fornecedor no separador Documento para pré-preencher automaticamente.
                            </div>
                        )}
                    </div>
                )}
                {modalTab === 'documento' && <>
                    {/* Cabeçalho */}
                    <div style={{ background: 'var(--bg-subtle,#f8fafc)', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Dados do Documento</div>
                        <div className="form-row" style={{ margin: 0 }}>
                            <div className="form-group" style={{ margin: 0, flex: 2 }}>
                                <label className="form-label req">Fornecedor</label>
                                <SearchableSelect options={fornOpts} value={fornId} onChange={setFornId} placeholder="Seleccionar fornecedor..." />
                                {errors.fornecedor && <span className="form-error"><AlertCircle size={11} /> {errors.fornecedor}</span>}
                            </div>
                            <div className="form-group" style={{ margin: 0, flex: '0 0 160px' }}>
                                <label className="form-label req">Tipo Documento</label>
                                <select className="form-select" value={tipoDoc} onChange={e => setTipoDoc(e.target.value)}>
                                    {documentosCompra.map(d => <option key={d.id} value={d.codigo}>{d.codigo} — {d.descricao}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label req">Nº Fatura Física</label>
                                <input className={`form-input${errors.numFatura ? ' err' : ''}`} value={numFatura}
                                    onChange={e => { setNumFat(e.target.value); setErrors(p => ({ ...p, numFatura: '' })); }}
                                    placeholder={isVNC ? 'Ex: NC/2026/001' : 'Ex: FAT-2026-00123'} />
                                {errors.numFatura && <span className="form-error"><AlertCircle size={11} /> {errors.numFatura}</span>}
                            </div>
                        </div>
                        {/* VNC: Tipo de Nota de Crédito + Faturas Associadas */}
                        {isVNC && (
                            <>
                                <div className="form-row" style={{ margin: '10px 0 0' }}>
                                    <div className="form-group" style={{ margin: 0, flex: 1 }}>
                                        <label className="form-label req">Tipo de Nota de Crédito</label>
                                        <select className="form-select" value={tipoNC} onChange={e => setTipoNC(e.target.value as any)}>
                                            <option value="">Seleccionar tipo...</option>
                                            <option value="Devolucao">Devolução (Impacto Logístico + Financeiro)</option>
                                            <option value="AcertoPreco">Acerto de Preço (Impacto Financeiro apenas)</option>
                                        </select>
                                        {errors.tipoNC && <span className="form-error"><AlertCircle size={11} /> {errors.tipoNC}</span>}
                                    </div>
                                </div>
                                <div className="form-row" style={{ margin: '10px 0 0' }}>
                                    <div className="form-group" style={{ margin: 0, flex: 1 }}>
                                        <label className="form-label">Faturas Associadas (VFA/VFR do mesmo fornecedor)</label>
                                        <div style={{ border: '1px solid var(--border)', borderRadius: 4, maxHeight: 130, overflowY: 'auto', padding: '4px 0', background: '#fff' }}>
                                            {(() => {
                                                const elegiveis = faturasFornecedor.filter(f =>
                                                    (f.tipoDocumento === 'VFA' || f.tipoDocumento === 'VFR') &&
                                                    (!fornId || f.fornecedorId === fornId)
                                                );
                                                if (elegiveis.length === 0) return (
                                                    <div style={{ padding: '6px 10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                        {fornId ? 'Nenhuma fatura VFA/VFR deste fornecedor.' : 'Seleccione um fornecedor para filtrar.'}
                                                    </div>
                                                );
                                                return elegiveis.map(f => (
                                                    <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', cursor: 'pointer', fontSize: '0.8rem' }}>
                                                        <input type="checkbox" checked={faturasAssocIds.includes(f.id)}
                                                            onChange={e => setFaturasAssocIds(prev => e.target.checked ? [...prev, f.id] : prev.filter(x => x !== f.id))} />
                                                        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', background: '#eff6ff', color: '#1d4ed8', borderRadius: 3, padding: '1px 5px' }}>{f.tipoDocumento}</span>
                                                        <span style={{ fontWeight: 600 }}>{f.numFaturaExterno}</span>
                                                        <span style={{ color: 'var(--text-muted)' }}>({f.dataEmissao})</span>
                                                    </label>
                                                ));
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                        <div className="form-row" style={{ margin: '10px 0 0' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label req">Data de Emissão</label>
                                <input type="date" className="form-input" value={dataEm} onChange={e => setDataEm(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Data de Vencimento</label>
                                <input type="date" className="form-input" value={dataVenc} onChange={e => setDataVenc(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ margin: 0, flex: '0 0 100px' }}>
                                <label className="form-label">Retenção %</label>
                                <input type="number" min={0} max={100} step={0.5} className="form-input" value={taxaRet} onChange={e => setTaxaRet(Number(e.target.value))} />
                            </div>
                            <div className="form-group" style={{ margin: 0, flex: '0 0 90px' }}>
                                <label className="form-label">Moeda</label>
                                <select className="form-select" value={moeda} onChange={e => setMoeda(e.target.value)}>
                                    <option value="AOA">AOA</option><option value="USD">USD</option><option value="EUR">EUR</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-row" style={{ margin: '10px 0 0' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Descrição</label>
                                <input className="form-input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Descrição da compra..." />
                            </div>
                        </div>
                    </div>

                    {/* Linhas */}
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                        {isVNC && tipoNC === 'AcertoPreco' ? 'Acerto / Serviço' : 'Artigos'}
                    </div>
                    {errors.linhas && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--red,#ef4444)', marginBottom: 8 }}><AlertCircle size={11} /> {errors.linhas}</div>
                    )}

                    {/* AcertoPreco: simplified single-line form */}
                    {isVNC && tipoNC === 'AcertoPreco' ? (
                        <div style={{ background: 'var(--bg-subtle,#f8fafc)', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
                            <div className="form-row" style={{ margin: 0 }}>
                                <div className="form-group" style={{ margin: 0, flex: 3 }}>
                                    <label className="form-label req">Descrição do Acerto</label>
                                    <input className="form-input" placeholder="Ex: Acerto de preço factura VFA-2026-001..."
                                        value={linhas[0]?.descricaoCustomizada ?? ''}
                                        onChange={e => setLinhas([{ ...emptyLinha(), descricaoCustomizada: e.target.value, produtoId: '' }])} />
                                </div>
                                <div className="form-group" style={{ margin: 0, flex: 1 }}>
                                    <label className="form-label req">Valor (sem IVA)</label>
                                    <input type="number" min={0} step={0.01} className="form-input"
                                        value={linhas[0]?.precoUnitarioNet ?? '0'}
                                        onChange={e => setLinhas([{ ...emptyLinha(), descricaoCustomizada: linhas[0]?.descricaoCustomizada ?? '', produtoId: '', precoUnitarioNet: e.target.value, quantidade: '1' }])} />
                                </div>
                                <div className="form-group" style={{ margin: 0, flex: '0 0 80px' }}>
                                    <label className="form-label">IVA %</label>
                                    <input type="number" min={0} max={100} step={0.5} className="form-input"
                                        value={linhas[0]?.taxaIva ?? 0}
                                        onChange={e => setLinhas(p => p.map((l, i) => i === 0 ? { ...l, taxaIva: Number(e.target.value) } : l))} />
                                </div>
                            </div>
                            <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                Acerto de Preço: sem impacto em stock. Só financeiro.
                            </div>
                        </div>
                    ) : (
                    <>
                    <table className="data-table" style={{ marginBottom: 0 }}>
                        <thead>
                            <tr>
                                <th>Artigo / Descrição</th>
                                <th style={{ width: 70, textAlign: 'right' }}>Qtd</th>
                                <th style={{ width: 55, textAlign: 'center' }}>UN</th>
                                <th style={{ width: 110, textAlign: 'right' }}>Preço Unit.</th>
                                <th style={{ width: 75, textAlign: 'right' }}>IVA %</th>
                                <th style={{ width: 110, textAlign: 'right' }}>Total</th>
                                <th style={{ width: 28 }} />
                            </tr>
                        </thead>
                        <tbody>
                            {linhas.map((l, i) => {
                                const calc = linhasCalc[i];
                                return (
                                    <tr key={i}>
                                        <td>
                                            <SearchableSelect options={artigoOpts} value={l.produtoId} onChange={v => selectArtigo(i, v)} placeholder="Seleccionar artigo..." />
                                        </td>
                                        <td>
                                            <input type="number" min={0} step={0.001} className="form-input"
                                                style={{ textAlign: 'right', padding: '3px 6px', height: 28, fontSize: '0.78rem' }}
                                                value={l.quantidade} onChange={e => updateLinha(i, 'quantidade', e.target.value)} />
                                        </td>
                                        <td>
                                            <input className="form-input"
                                                style={{ textAlign: 'center', padding: '3px 4px', height: 28, fontSize: '0.75rem' }}
                                                value={l.unidadeVenda} onChange={e => updateLinha(i, 'unidadeVenda', e.target.value)} />
                                        </td>
                                        <td>
                                            <input type="number" min={0} step={0.01} className="form-input"
                                                style={{ textAlign: 'right', padding: '3px 6px', height: 28, fontSize: '0.78rem' }}
                                                value={l.precoUnitarioNet} onChange={e => updateLinha(i, 'precoUnitarioNet', e.target.value)} />
                                        </td>
                                        <td>
                                            <input type="number" min={0} max={100} step={0.5} className="form-input"
                                                style={{ textAlign: 'right', padding: '3px 6px', height: 28, fontSize: '0.78rem' }}
                                                value={l.taxaIva} onChange={e => updateLinha(i, 'taxaIva', Number(e.target.value))} />
                                        </td>
                                        <td style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 600 }}>
                                            <div>{fmtMoney(calc.valorTotalLinha, moeda)}</div>
                                            {calc.valorIva > 0 && <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', fontWeight: 400 }}>IVA: {fmtMoney(calc.valorIva)}</div>}
                                        </td>
                                        <td>
                                            <button type="button" className="icon-btn" onClick={() => setLinhas(p => p.filter((_, j) => j !== i))}><X size={11} /></button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 2 }}>
                        <button type="button" className="abtn abtn-ghost" onClick={() => setLinhas(p => [...p, emptyLinha()])} style={{ fontSize: '0.78rem' }}>
                            <Plus size={12} /> Adicionar Linha
                        </button>
                        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Subtotal</div>
                                <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{fmtMoney(totalLiq, moeda)}</div>
                            </div>
                            {totalIva > 0 && (
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>IVA</div>
                                    <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--blue)' }}>{fmtMoney(totalIva)}</div>
                                </div>
                            )}
                            {retencao > 0 && (
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Retenção</div>
                                    <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#dc2626' }}>-{fmtMoney(retencao)}</div>
                                </div>
                            )}
                            <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border)', paddingLeft: 20 }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total a Pagar</div>
                                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--blue)' }}>{fmtMoney(totalFin, moeda)}</div>
                            </div>
                        </div>
                    </div>
                    </>
                    )}
                    {/* Totals summary for AcertoPreco */}
                    {isVNC && tipoNC === 'AcertoPreco' && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 20, borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 2 }}>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total a Pagar</div>
                                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--blue)' }}>{fmtMoney(totalFin, moeda)}</div>
                            </div>
                        </div>
                    )}
                    <div className="form-group" style={{ marginTop: 12 }}>
                        <label className="form-label">Observações</label>
                        <textarea className="form-input" rows={2} style={{ resize: 'vertical' }} value={obs} onChange={e => setObs(e.target.value)} />
                    </div>
                </>}
                </div>
                <div className="modal-footer">
                    <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                    <button type="button" className="abtn abtn-primary" onClick={handleSave}>
                        <Check size={12} /> {isVNC ? 'Criar VNC (Rascunho)' : 'Registar Compra'}
                    </button>
                </div>
            </div>
        </div>
    );
};
