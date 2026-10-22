import React, { useState } from 'react';
import { useModalA11y } from '../../components/useModalA11y';
import { useGlobal, Encomenda } from '../../contexts/GlobalContext';
import { X, AlertCircle, Check } from 'lucide-react';

/** #223 — extraído de EncomendaPage.tsx (divisão em componentes, sem alterações de comportamento). */

/* ══ Receber Modal ══════════════════════════════════════════ */
export interface ReceberModalProps {
    encomenda: Encomenda;
    onClose: () => void;
    onConfirm: (recebidas: { artigoId: string; qtd: number }[], armazem: string, guiaRemessa: string) => void;
}
export const ReceberModal: React.FC<ReceberModalProps> = ({ encomenda, onClose, onConfirm }) => {
    const modalRef = useModalA11y(onClose); // #223 — Esc fecha e foco no modal (#45)
    const { armazens, fmt } = useGlobal();
    const armazensOpts = armazens.map(a => ({ value: a.codigo, label: `${a.codigo} — ${a.nome}` }));
    const defaultArmazem = armazens[0]?.codigo ?? '';

    const [qtds, setQtds]          = useState<Record<string, string>>(
        Object.fromEntries(
            encomenda.linhas.map(l => [l.artigoId, String(l.qtdEncomendada - l.qtdRecebida)])
        )
    );
    const [armazem,     setArmazem] = useState(defaultArmazem);
    const [guiaRemessa, setGuia]    = useState('');
    const [guiaErr,     setGuiaErr] = useState(false);

    const rececoesPrev = encomenda.rececoes.filter(r => r.estado === 'Ativa');

    const handleConfirm = () => {
        if (!guiaRemessa.trim()) { setGuiaErr(true); return; }
        const recebidas = encomenda.linhas
            .map(l => ({ artigoId: l.artigoId, qtd: Number(qtds[l.artigoId] ?? 0) }))
            .filter(r => r.qtd > 0);
        if (recebidas.length === 0) return;
        onConfirm(recebidas, armazem, guiaRemessa.trim());
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" ref={modalRef} role="dialog" aria-modal="true" tabIndex={-1} style={{ maxWidth: 580 }}>
                <div className="modal-header">
                    <h3 className="modal-title">Receber Encomenda — {encomenda.numero}</h3>
                    <button className="modal-close" aria-label="Fechar" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body">
                    {rececoesPrev.length > 0 && (
                        <div style={{ background: 'var(--surface-alt,#f5f7fa)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: '0.78rem' }}>
                            <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text-muted)' }}>Entregas anteriores ({rececoesPrev.length})</div>
                            {rececoesPrev.map(r => (
                                <div key={r.id} style={{ display: 'flex', gap: 10, alignItems: 'center', paddingBottom: 3 }}>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--blue,#0D6EBF)' }}>{r.guiaRemessa}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>{new Date(r.dataHora).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    <span style={{ color: 'var(--text-muted)' }}>· {r.operador}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="form-row" style={{ marginBottom: 14 }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label req">Nº Guia de Remessa — Esta Entrega</label>
                            <input
                                className={`form-input${guiaErr ? ' err' : ''}`}
                                value={guiaRemessa}
                                onChange={e => { setGuia(e.target.value); setGuiaErr(false); }}
                                placeholder="Ex: GR-2026-001"
                                autoFocus
                            />
                            {guiaErr && <span className="form-error"><AlertCircle size={11} /> Obrigatório</span>}
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label req">Armazém de Destino</label>
                            <select className="form-select" value={armazem} onChange={e => setArmazem(e.target.value)}>
                                {armazensOpts.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                            </select>
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
