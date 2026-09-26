import React, { useCallback, useEffect, useState } from 'react';
import { HandCoins } from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import { useGlobal } from '../../contexts/GlobalContext';
import { extractErrorMessage, showToast } from '../../utils/errorHandler';
import { tesourariaApi, type Liquidacao } from '../../services/tesouraria';
import { fmtDataHora, Modal, mono, muted, num } from './ui';

/** #166 — Recebimentos (`RE`) emitidos e os Movimentos em conta que geraram. */

const DetalheRecebimento: React.FC<{ id: number; onClose: () => void }> = ({ id, onClose }) => {
    const { fmtMoney } = useGlobal();
    const [l, setL] = useState<Liquidacao | null>(null);
    useEffect(() => {
        tesourariaApi.liquidacao(id).then(setL).catch(e => { showToast(extractErrorMessage(e), 'error'); onClose(); });
    }, [id, onClose]);
    if (!l) return <Modal titulo="Recebimento" onClose={onClose} footer={null}><div style={muted}>A carregar…</div></Modal>;
    return (
        <Modal titulo={`Recebimento ${l.numeroDocumento}`} largura={760} onClose={onClose}
            footer={<button type="button" className="abtn abtn-secondary" onClick={onClose}>Fechar</button>}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 12 }}>
                <div><div style={muted}>Cliente</div><div style={{ fontWeight: 700 }}>{l.clienteNome}</div></div>
                <div><div style={muted}>Data-hora</div><div>{fmtDataHora(l.dataHora)}</div></div>
                <div><div style={muted}>Conta de destino</div><div>{l.contaCodigo} — {l.contaDescricao}</div></div>
            </div>
            <table className="data-table">
                <thead><tr><th>Documento</th><th>OT</th><th style={num}>Pendente anterior</th><th style={num}>Pago</th><th style={num}>Desconto</th><th style={num}>Fica pendente</th></tr></thead>
                <tbody>{(l.linhas ?? []).map(x => (
                    <tr key={x.id}>
                        <td style={{ ...mono, fontWeight: 700 }}>{x.numeroDocumento ?? `#${x.movimentoCcId}`}</td>
                        <td style={mono}>{x.otNumero ?? '—'}</td>
                        <td style={num}>{fmtMoney(x.pendenteAnterior, l.moeda)}</td>
                        <td style={{ ...num, fontWeight: 700 }}>{fmtMoney(x.valorPago, l.moeda)}</td>
                        <td style={num}>{x.desconto ? fmtMoney(x.desconto, l.moeda) : '—'}</td>
                        <td style={num}>{fmtMoney(x.pendenteAnterior - x.valorPago - x.desconto, l.moeda)}</td>
                    </tr>
                ))}</tbody>
            </table>
            <div style={{ ...muted, margin: '12px 0 4px', fontWeight: 700 }}>Movimentos em conta gerados</div>
            <table className="data-table">
                <thead><tr><th>Documento</th><th>Modo de pagamento</th><th style={num}>Valor</th></tr></thead>
                <tbody>{(l.movimentosConta ?? []).map(mc => (
                    <tr key={mc.id}><td style={mono}>{mc.numeroDocumento}</td><td>{mc.modoPagamentoDescricao ?? '—'}</td><td style={num}>{fmtMoney(mc.valor, l.moeda)}</td></tr>
                ))}</tbody>
            </table>
            {l.observacoes && <div style={{ ...muted, marginTop: 12 }}>Observações: {l.observacoes}</div>}
        </Modal>
    );
};

const RecebimentosTab: React.FC<{ versao: number }> = ({ versao }) => {
    const { fmtMoney } = useGlobal();
    const [lista, setLista] = useState<Liquidacao[] | null>(null);
    const [detalhe, setDetalhe] = useState<number | null>(null);
    const fechar = useCallback(() => setDetalhe(null), []);

    useEffect(() => {
        tesourariaApi.liquidacoes().then(setLista).catch(e => showToast(extractErrorMessage(e), 'error'));
    }, [versao]);

    return (
        <>
            <div className="table-container">
                <div className="table-scroll">
                    <table className="data-table">
                        <thead><tr><th>Documento</th><th>Data</th><th>Cliente</th><th>Conta</th><th style={num}>Recebido</th><th style={num}>Desconto</th></tr></thead>
                        <tbody>
                            {!lista && <tr><td colSpan={6} style={muted}>A carregar…</td></tr>}
                            {lista?.length === 0 && (
                                <tr><td colSpan={6}><EmptyState icon={<HandCoins size={28} />} title="Sem recebimentos" description="Os recebimentos registam-se a partir do separador Pendentes." /></td></tr>
                            )}
                            {lista?.map(l => (
                                <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => setDetalhe(l.id)}>
                                    <td style={{ ...mono, fontWeight: 700, color: 'var(--blue)' }}>{l.numeroDocumento}</td>
                                    <td style={{ fontSize: '0.78rem' }}>{fmtDataHora(l.dataHora)}</td>
                                    <td style={{ fontWeight: 600 }}>{l.clienteNome}</td>
                                    <td style={{ fontSize: '0.78rem' }}>{l.contaCodigo}</td>
                                    <td style={{ ...num, fontWeight: 700 }}>{fmtMoney(l.total, l.moeda)}</td>
                                    <td style={num}>{l.desconto ? fmtMoney(l.desconto, l.moeda) : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="table-count">{lista?.length ?? 0} recebimento(s)</div>
            </div>
            {detalhe !== null && <DetalheRecebimento id={detalhe} onClose={fechar} />}
        </>
    );
};

export default RecebimentosTab;
