import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import SearchableSelect from '../../components/SearchableSelect';
import { useGlobal } from '../../contexts/GlobalContext';
import { extractErrorMessage, showToast } from '../../utils/errorHandler';
import { tesourariaApi, type Extrato } from '../../services/tesouraria';
import { mono, muted, num } from './ui';

/**
 * #166 — Extrato de conta corrente do cliente (v10 §6.5): débitos, créditos,
 * saldo corrido e saldo final; com data inicial, parte do saldo anterior.
 * Cliente e período ficam no URL (`ecliente`, `ede`, `eate`).
 */
const ExtratoTab: React.FC<{ versao: number }> = ({ versao }) => {
    const { clientes, fmtMoney } = useGlobal();
    const [sp, setSp] = useSearchParams();
    const clienteId = sp.get('ecliente') ?? '';
    const de = sp.get('ede') ?? '';
    const ate = sp.get('eate') ?? '';
    const [ext, setExt] = useState<Extrato | null>(null);

    const setParam = (k: string, v: string) => setSp(prev => {
        const n = new URLSearchParams(prev);
        if (v) n.set(k, v); else n.delete(k);
        return n;
    }, { replace: true });

    useEffect(() => {
        if (!clienteId) { setExt(null); return; }
        tesourariaApi.extrato(Number(clienteId), de || undefined, ate || undefined)
            .then(setExt).catch(e => showToast(extractErrorMessage(e), 'error'));
    }, [clienteId, de, ate, versao]);

    const opcoes = useMemo(() => clientes.map(c => ({ value: c.id, label: c.nome, sub: c.nif ? `NIF ${c.nif}` : undefined })), [clientes]);
    const moeda = 'AOA';

    return (
        <>
            <div className="filters-bar" style={{ flexWrap: 'wrap', gap: 8 }}>
                <div style={{ minWidth: 260 }}>
                    <SearchableSelect options={opcoes} value={clienteId} placeholder="Escolha o cliente…" onChange={v => setParam('ecliente', v)} />
                </div>
                <input className="filter-select" type="date" aria-label="De" value={de} onChange={e => setParam('ede', e.target.value)} />
                <input className="filter-select" type="date" aria-label="Até" value={ate} onChange={e => setParam('eate', e.target.value)} />
            </div>

            {!clienteId && <EmptyState icon={<BookOpen size={28} />} title="Extrato de conta corrente" description="Escolha um cliente para ver os débitos, créditos e o saldo." />}
            {clienteId && ext && (
                <div className="table-container">
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead><tr>
                                <th>Data</th><th>Documento</th><th>OT</th>
                                <th style={num}>Débito</th><th style={num}>Crédito</th><th style={num}>Desconto</th><th style={num}>Saldo</th>
                            </tr></thead>
                            <tbody>
                                {ext.de && (
                                    <tr style={{ fontStyle: 'italic' }}>
                                        <td colSpan={6} style={muted}>Saldo anterior a {ext.de}</td>
                                        <td style={{ ...num, fontWeight: 700 }}>{fmtMoney(ext.saldoAnterior, moeda)}</td>
                                    </tr>
                                )}
                                {ext.linhas.length === 0 && <tr><td colSpan={7} style={muted}>Sem movimentos no período.</td></tr>}
                                {ext.linhas.map(l => (
                                    <tr key={`${l.tipo}-${l.id}`}>
                                        <td style={{ fontSize: '0.78rem' }}>{l.data}</td>
                                        <td style={{ ...mono, fontWeight: 700 }}>{l.documento}</td>
                                        <td style={mono}>{l.otNumero ?? '—'}</td>
                                        <td style={num}>{l.debito ? fmtMoney(l.debito, moeda) : ''}</td>
                                        <td style={num}>{l.credito ? fmtMoney(l.credito, moeda) : ''}</td>
                                        <td style={num}>{l.desconto ? fmtMoney(l.desconto, moeda) : ''}</td>
                                        <td style={{ ...num, fontWeight: 600 }}>{fmtMoney(l.saldo, moeda)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr style={{ fontWeight: 800 }}>
                                    <td colSpan={3}>Saldo final — {ext.cliente.nome}</td>
                                    <td style={num}>{fmtMoney(ext.totais.debito, moeda)}</td>
                                    <td style={num}>{fmtMoney(ext.totais.credito, moeda)}</td>
                                    <td style={num}>{fmtMoney(ext.totais.desconto, moeda)}</td>
                                    <td style={{ ...num, color: ext.saldoFinal > 0 ? '#E65100' : '#2E7D32' }}>{fmtMoney(ext.saldoFinal, moeda)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
        </>
    );
};

export default ExtratoTab;
