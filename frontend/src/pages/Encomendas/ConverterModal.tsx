import React, { useState } from 'react';
import { useModalA11y } from '../../components/useModalA11y';
import SearchableSelect from '../../components/SearchableSelect';
import { useGlobal, Artigo } from '../../contexts/GlobalContext';
import { X, AlertCircle, ShoppingBag } from 'lucide-react';

/** #223 — extraído de EncomendaPage.tsx (divisão em componentes, sem alterações de comportamento). */

/* ══ Converter em Encomenda Modal ═══════════════════════════ */
export interface ConverterItem { artigoId: string; codigo: string; descricao: string; qtd: number; preco: number; }
export interface ConverterModalProps {
    artigos: Artigo[];
    onClose: () => void;
    onConfirm: (fornecedorId: string, dataEntrega: string, descricao: string, items: ConverterItem[]) => void;
}
export const ConverterModal: React.FC<ConverterModalProps> = ({ artigos, onClose, onConfirm }) => {
    const modalRef = useModalA11y(onClose); // #223 — Esc fecha e foco no modal (#45)
    const { fornecedores, fmt, fmtMoney } = useGlobal();
    const [fornId,      setFornId]  = useState('');
    const [dataEntrega, setDatEnt]  = useState('');
    const [descricao,   setDesc]    = useState(`Reposição de stock — ${new Date().toLocaleDateString('pt-PT')}`);
    const [err,         setErr]     = useState('');

    // One editable row per article
    type Row = { selected: boolean; qtd: string; preco: string };
    const [rows, setRows] = useState<Record<string, Row>>(() => {
        const init: Record<string, Row> = {};
        artigos.forEach(a => {
            const disp   = a.stockDisponivel ?? Math.max(0, a.existencia - a.stockReservado);
            const deficit = Math.max(1, Math.ceil(a.stockSeguranca - (disp + a.stockEncomendado)));
            const preco  = a.precoCusto || a.custoMedio || a.precoUnitario;
            init[a.id] = { selected: true, qtd: String(deficit), preco: String(preco) };
        });
        return init;
    });

    const fornOpts = fornecedores.map(f => ({ value: f.id, label: f.nome, sub: f.nif }));
    const allSelected = artigos.every(a => rows[a.id]?.selected);

    const toggleAll = () => {
        setRows(p => {
            const next = { ...p };
            artigos.forEach(a => { next[a.id] = { ...next[a.id], selected: !allSelected }; });
            return next;
        });
    };

    const setField = (id: string, field: 'selected' | 'qtd' | 'preco', val: string | boolean) =>
        setRows(p => ({ ...p, [id]: { ...p[id], [field]: val } }));

    const selectedItems = artigos.filter(a => rows[a.id]?.selected);
    const total = selectedItems.reduce((s, a) => {
        const r = rows[a.id];
        return s + (Number(r?.qtd) || 0) * (Number(r?.preco) || 0);
    }, 0);

    const handleConfirm = () => {
        if (!fornId) { setErr('Seleccione um fornecedor'); return; }
        if (!descricao.trim()) { setErr('Introduza uma descrição'); return; }
        if (selectedItems.length === 0) { setErr('Seleccione pelo menos um artigo'); return; }
        const items: ConverterItem[] = selectedItems.map(a => ({
            artigoId: a.id, codigo: a.codigo, descricao: a.descricao,
            qtd: Math.max(1, Number(rows[a.id]?.qtd) || 1),
            preco: Math.max(0, Number(rows[a.id]?.preco) || 0),
        }));
        onConfirm(fornId, dataEntrega, descricao, items);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" ref={modalRef} role="dialog" aria-modal="true" tabIndex={-1} style={{ maxWidth: 860 }}>
                <div className="modal-header">
                    <h3 className="modal-title">Converter em Encomenda</h3>
                    <button className="modal-close" aria-label="Fechar" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                    {/* Cabeçalho encomenda */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label req">Fornecedor</label>
                            <SearchableSelect options={fornOpts} value={fornId} onChange={setFornId} placeholder="Seleccionar fornecedor..." />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label req">Descrição</label>
                            <input className="form-input" value={descricao} onChange={e => setDesc(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">Data Entrega</label>
                            <input type="date" className="form-input" value={dataEntrega} onChange={e => setDatEnt(e.target.value)} />
                        </div>
                    </div>
                    {err && <div style={{ color: 'var(--red,#ef4444)', fontSize: '0.78rem', marginBottom: 10 }}><AlertCircle size={11} /> {err}</div>}

                    {/* Tabela de artigos */}
                    <table className="data-table" style={{ fontSize: '0.8rem' }}>
                        <thead>
                            <tr>
                                <th style={{ width: 32, textAlign: 'center' }}>
                                    <input type="checkbox" checked={allSelected} onChange={toggleAll} title={allSelected ? 'Desmarcar todos' : 'Seleccionar todos'} />
                                </th>
                                <th>Artigo</th>
                                <th style={{ textAlign: 'right', width: 80 }}>Défice</th>
                                <th style={{ textAlign: 'right', width: 100 }}>Qtd. Enc.</th>
                                <th style={{ textAlign: 'right', width: 130 }}>Preço Compra</th>
                                <th style={{ textAlign: 'right', width: 130 }}>Total Linha</th>
                            </tr>
                        </thead>
                        <tbody>
                            {artigos.map(a => {
                                const disp   = a.stockDisponivel ?? Math.max(0, a.existencia - a.stockReservado);
                                const deficit = Math.max(0, a.stockSeguranca - (disp + a.stockEncomendado));
                                const r = rows[a.id] ?? { selected: false, qtd: '0', preco: '0' };
                                const linhaTotal = (Number(r.qtd) || 0) * (Number(r.preco) || 0);
                                return (
                                    <tr key={a.id} style={{ opacity: r.selected ? 1 : 0.45 }}>
                                        <td style={{ textAlign: 'center' }}>
                                            <input type="checkbox" checked={r.selected}
                                                onChange={e => setField(a.id, 'selected', e.target.checked)} />
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{a.descricao}</div>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'monospace' }}>{a.codigo}</div>
                                        </td>
                                        <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>{fmt(deficit)}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            <input type="number" min={1} step={1}
                                                className="form-input"
                                                style={{ width: 90, textAlign: 'right', padding: '3px 6px', height: 28, fontSize: '0.8rem' }}
                                                value={r.qtd}
                                                disabled={!r.selected}
                                                onChange={e => setField(a.id, 'qtd', e.target.value)} />
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <input type="number" min={0} step={0.01}
                                                className="form-input"
                                                style={{ width: 120, textAlign: 'right', padding: '3px 6px', height: 28, fontSize: '0.8rem' }}
                                                value={r.preco}
                                                disabled={!r.selected}
                                                onChange={e => setField(a.id, 'preco', e.target.value)} />
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: r.selected ? 600 : 400 }}>
                                            {fmtMoney(linhaTotal, a.moeda)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.83rem', padding: '8px 12px', borderTop: '2px solid var(--blue)' }}>
                                    TOTAL ({selectedItems.length} artigo(s) seleccionado(s))
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.9rem', color: 'var(--blue)', padding: '8px 12px', borderTop: '2px solid var(--blue)' }}>
                                    {fmtMoney(total)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div className="modal-footer">
                    <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                    <button type="button" className="abtn abtn-primary" onClick={handleConfirm}>
                        <ShoppingBag size={12} /> Criar Encomenda ({selectedItems.length})
                    </button>
                </div>
            </div>
        </div>
    );
};
