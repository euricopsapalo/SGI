import React, { useState } from 'react';
import { useModalA11y } from '../../components/useModalA11y';
import { useGlobal, Encomenda } from '../../contexts/GlobalContext';
import { X, AlertCircle, FileText } from 'lucide-react';

/** #223 — extraído de EncomendaPage.tsx (divisão em componentes, sem alterações de comportamento). */

/* ══ Converter Nota de Entrada → Fatura Fornecedor ══════════ */
export interface ConvertFaturaModalProps {
    encomenda: Encomenda;
    onClose: () => void;
    onConfirm: (data: {
        tipoDocumento: string; numFaturaExterno: string;
        dataEmissao: string; dataVencimento: string;
        linhas: { artigoId: string; descricao: string; quantidade: number; unidadeVenda: string; precoUnitarioNet: number; taxaIva: number; valorIva: number; valorTotalLinha: number; }[];
        totalLiquido: number; totalIva: number; totalRetencao: number; totalFinal: number;
        moeda: string; taxaCambio: number; observacoes: string;
    }) => void;
}
export const ConvertFaturaModal: React.FC<ConvertFaturaModalProps> = ({ encomenda, onClose, onConfirm }) => {
    const modalRef = useModalA11y(onClose); // #223 — Esc fecha e foco no modal (#45)
    const { documentosCompra, artigos, taxasIva, fmt, fmtMoney } = useGlobal();
    const docOpts = documentosCompra.filter(d => d.codigo !== 'VNC');

    const [tipoDoc,     setTipoDoc]  = useState(docOpts[0]?.codigo ?? 'VFA');
    const [numFatura,   setNumFat]   = useState('');
    const [dataEmissao, setDataEm]   = useState(new Date().toISOString().split('T')[0]);
    const [dataVenc,    setDataVenc] = useState('');
    const [taxaRet,     setTaxaRet]  = useState(0);
    const [obs,         setObs]      = useState('');
    const [numErr,      setNumErr]   = useState(false);

    type LinhaEdit = {
        artigoId: string; descricao: string; codigo: string;
        qtdEnc: number; qtdRec: number; unidade: string;
        preco: number; taxaIva: number;
    };
    const [linhas, setLinhas] = useState<LinhaEdit[]>(() =>
        encomenda.linhas.map(l => {
            // Fallback: derive taxaIva from artigo when not yet persisted
            let taxa = l.taxaIva ?? 0;
            if (taxa === 0) {
                const art = artigos.find(a => a.id === l.artigoId);
                if (art?.codigoIva) taxa = taxasIva.find(t => t.codigo === art.codigoIva)?.taxa ?? 0;
            }
            return {
                artigoId: l.artigoId, descricao: l.descricao, codigo: l.codigo,
                qtdEnc: l.qtdEncomendada, qtdRec: l.qtdRecebida,
                unidade: l.unidade, preco: l.custoUnit,
                taxaIva: taxa,
            };
        })
    );

    const updateLinha = (i: number, field: 'preco' | 'taxaIva', val: number) =>
        setLinhas(p => p.map((l, j) => j === i ? { ...l, [field]: val } : l));

    const calcLinhas = linhas.map(l => {
        const base = l.qtdRec * l.preco;
        const iva  = Math.round(base * l.taxaIva / 100 * 100) / 100;
        return { ...l, base, iva, total: base + iva };
    });
    const totalLiq = calcLinhas.reduce((s, l) => s + l.base, 0);
    const totalIva = calcLinhas.reduce((s, l) => s + l.iva, 0);
    const retencao = Math.round(totalLiq * taxaRet / 100 * 100) / 100;
    const totalFin = totalLiq + totalIva - retencao;

    const qtdOk = encomenda.linhas.every(l => l.qtdRecebida >= l.qtdEncomendada);

    const handleConfirm = () => {
        if (!numFatura.trim()) { setNumErr(true); return; }
        onConfirm({
            tipoDocumento: tipoDoc, numFaturaExterno: numFatura.trim(),
            dataEmissao, dataVencimento: dataVenc, observacoes: obs,
            moeda: encomenda.moeda, taxaCambio: 1,
            totalLiquido: Math.round(totalLiq * 100) / 100,
            totalIva: Math.round(totalIva * 100) / 100,
            totalRetencao: retencao, totalFinal: Math.round(totalFin * 100) / 100,
            linhas: calcLinhas.map(l => ({
                artigoId: l.artigoId, descricao: l.descricao,
                quantidade: l.qtdRec, unidadeVenda: l.unidade,
                precoUnitarioNet: l.preco, taxaIva: l.taxaIva,
                valorIva: l.iva, valorTotalLinha: l.total,
            })),
        });
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" ref={modalRef} role="dialog" aria-modal="true" tabIndex={-1} style={{ maxWidth: 780 }}>
                <div className="modal-header">
                    <h3 className="modal-title">
                        <FileText size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                        Converter em Fatura Fornecedor — {encomenda.numero}
                    </h3>
                    <button className="modal-close" aria-label="Fechar" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                    {/* Verification */}
                    {!qtdOk && (
                        <div style={{ display: 'flex', gap: 8, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '10px 14px', marginBottom: 14 }}>
                            <AlertCircle size={14} style={{ color: '#b45309', flexShrink: 0, marginTop: 1 }} />
                            <div style={{ fontSize: '0.8rem', color: '#92400e' }}>
                                <strong>Atenção:</strong> Alguns artigos têm quantidade recebida inferior à encomendada. A fatura será gerada com base nas quantidades recebidas.
                            </div>
                        </div>
                    )}

                    {/* Doc info */}
                    <div style={{ background: 'var(--bg-subtle,#f8fafc)', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Dados do Documento</div>
                        <div className="form-row" style={{ margin: 0 }}>
                            <div className="form-group" style={{ margin: 0, flex: '0 0 160px' }}>
                                <label className="form-label req">Tipo de Documento</label>
                                <select className="form-select" value={tipoDoc} onChange={e => setTipoDoc(e.target.value)}>
                                    {docOpts.map(d => <option key={d.id} value={d.codigo}>{d.codigo} — {d.descricao}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label req">Nº da Fatura Física (do Fornecedor)</label>
                                <input className={`form-input${numErr ? ' err' : ''}`} value={numFatura}
                                    onChange={e => { setNumFat(e.target.value); setNumErr(false); }}
                                    placeholder="Ex: FAT-2026-00123" autoFocus />
                                {numErr && <span className="form-error"><AlertCircle size={11} /> Obrigatório</span>}
                            </div>
                        </div>
                        <div className="form-row" style={{ margin: '10px 0 0' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label req">Data de Emissão</label>
                                <input type="date" className="form-input" value={dataEmissao} onChange={e => setDataEm(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">Data de Vencimento</label>
                                <input type="date" className="form-input" value={dataVenc} onChange={e => setDataVenc(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ margin: 0, flex: '0 0 120px' }}>
                                <label className="form-label">Retenção %</label>
                                <input type="number" min={0} max={100} step={0.5} className="form-input" value={taxaRet}
                                    onChange={e => setTaxaRet(Number(e.target.value))} />
                            </div>
                        </div>
                    </div>

                    {/* Linhas */}
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                        Artigos — Confirmar / Ajustar
                    </div>
                    <table className="data-table" style={{ marginBottom: 0 }}>
                        <thead>
                            <tr>
                                <th>Artigo</th>
                                <th style={{ textAlign: 'right', width: 70 }}>Enc.</th>
                                <th style={{ textAlign: 'right', width: 70 }}>Rec.</th>
                                <th style={{ textAlign: 'right', width: 60 }}>UN</th>
                                <th style={{ textAlign: 'right', width: 120 }}>Preço Unit.</th>
                                <th style={{ textAlign: 'right', width: 80 }}>IVA %</th>
                                <th style={{ textAlign: 'right', width: 100 }}>Total c/ IVA</th>
                            </tr>
                        </thead>
                        <tbody>
                            {calcLinhas.map((l, i) => (
                                <tr key={i} style={{ background: l.qtdRec < l.qtdEnc ? '#fffbeb' : undefined }}>
                                    <td>
                                        <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{l.descricao}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{l.codigo}</div>
                                    </td>
                                    <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{fmt(l.qtdEnc)}</td>
                                    <td style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 700,
                                        color: l.qtdRec < l.qtdEnc ? '#b45309' : '#15803d' }}>
                                        {fmt(l.qtdRec)}
                                    </td>
                                    <td style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{l.unidade}</td>
                                    <td>
                                        <input type="number" min={0} step={0.01} className="form-input"
                                            style={{ textAlign: 'right', padding: '3px 6px', height: 28, fontSize: '0.78rem' }}
                                            value={l.preco}
                                            onChange={e => updateLinha(i, 'preco', Number(e.target.value))} />
                                    </td>
                                    <td>
                                        <input type="number" min={0} max={100} step={0.5} className="form-input"
                                            style={{ textAlign: 'right', padding: '3px 6px', height: 28, fontSize: '0.78rem' }}
                                            value={l.taxaIva}
                                            onChange={e => updateLinha(i, 'taxaIva', Number(e.target.value))} />
                                    </td>
                                    <td style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 600 }}>
                                        <div>{fmtMoney(l.total, encomenda.moeda)}</div>
                                        {l.taxaIva > 0 && <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', fontWeight: 400 }}>IVA: {fmtMoney(l.iva)}</div>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {/* Totals */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 20, borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Subtotal s/ IVA</div>
                            <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{fmtMoney(totalLiq, encomenda.moeda)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>IVA</div>
                            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--blue)' }}>{fmtMoney(totalIva)}</div>
                        </div>
                        {taxaRet > 0 && (
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Retenção ({taxaRet}%)</div>
                                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#dc2626' }}>-{fmtMoney(retencao)}</div>
                            </div>
                        )}
                        <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border)', paddingLeft: 20 }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total a Pagar</div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--blue)' }}>{fmtMoney(totalFin, encomenda.moeda)}</div>
                        </div>
                    </div>
                    {/* Obs */}
                    <div className="form-group" style={{ marginTop: 12 }}>
                        <label className="form-label">Observações</label>
                        <textarea className="form-input" rows={2} style={{ resize: 'vertical' }} value={obs} onChange={e => setObs(e.target.value)} />
                    </div>
                </div>
                <div className="modal-footer">
                    <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                    <button type="button" className="abtn abtn-primary" onClick={handleConfirm}>
                        <FileText size={12} /> Gravar Fatura
                    </button>
                </div>
            </div>
        </div>
    );
};
