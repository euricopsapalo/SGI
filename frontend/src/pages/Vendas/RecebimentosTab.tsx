import React, { useCallback, useEffect, useState } from 'react';
import { HandCoins, Printer, RotateCcw } from 'lucide-react';
import { buildReciboHtml, imprimirDocumento } from './impressao';
import EmptyState from '../../components/EmptyState';
import SubmitButton from '../../components/SubmitButton';
import FieldError, { fieldAria } from '../../components/FieldError';
import { useGlobal } from '../../contexts/GlobalContext';
import { extractErrorMessage, extractFieldErrors, showToast } from '../../utils/errorHandler';
import { tesourariaApi, type Liquidacao } from '../../services/tesouraria';
import { vendasConfigApi, type MotivoEstorno } from '../../services/vendasConfig';
import { fmtDataHora, Modal, mono, muted, num } from './ui';

/**
 * #166 — Recebimentos (`RE`) emitidos e os Movimentos em conta que geraram.
 * #169 — Estorno do recebimento (`ERE`): repõe o pendente e devolve o valor da conta.
 */

/** #178 — imprime o recibo (a 1.ª impressão é o Original, as seguintes Segunda via). */
export const imprimirRecibo = (id: number) =>
    imprimirDocumento(async () => buildReciboHtml(await tesourariaApi.imprimir(id)));

const badge = (bg: string, color: string): React.CSSProperties =>
    ({ fontSize: '0.7rem', padding: '1px 7px', borderRadius: 10, fontWeight: 700, background: bg, color, whiteSpace: 'nowrap' });

/** #169 — painel de confirmação do estorno: motivo e observações. */
const EstornarRecebimento: React.FC<{ l: Liquidacao; onFeito: () => void; onCancelar: () => void }> = ({ l, onFeito, onCancelar }) => {
    const { fmtMoney } = useGlobal();
    const [motivos, setMotivos] = useState<MotivoEstorno[]>([]);
    const [motivoId, setMotivoId] = useState('');
    const [observacoes, setObservacoes] = useState('');
    const [erros, setErros] = useState<Record<string, string>>({});
    const [aEmitir, setAEmitir] = useState(false);
    useEffect(() => {
        vendasConfigApi.motivos().then(ms => setMotivos(ms.filter(m => m.ativo))).catch(e => showToast(extractErrorMessage(e), 'error'));
    }, []);

    const estornar = async () => {
        if (!motivoId) { setErros({ motivoEstornoId: 'Indique o motivo do estorno' }); return; }
        setAEmitir(true); setErros({});
        try {
            const r = await tesourariaApi.estornar(l.id, { motivoEstornoId: Number(motivoId), observacoes: observacoes.trim() || undefined });
            showToast(`${r.numeroDocumento} emitido — ${fmtMoney(l.total, l.moeda)} devolvidos de ${l.contaCodigo}; o pendente foi reposto`, 'success');
            onFeito();
        } catch (e) {
            setErros(extractFieldErrors(e));
            showToast(extractErrorMessage(e), 'error');
        } finally { setAEmitir(false); }
    };

    return (
        <div style={{ marginTop: 14, padding: 12, border: '1px solid #F5C2C7', background: '#FDF2F2', borderRadius: 6 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Estornar {l.numeroDocumento}</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ margin: 0, minWidth: 240 }}>
                    <label className="form-label" htmlFor="ere-motivo">Motivo</label>
                    <select id="ere-motivo" className="form-control" value={motivoId} onChange={e => setMotivoId(e.target.value)} {...fieldAria('ere-motivo-err', erros.motivoEstornoId)}>
                        <option value="">—</option>
                        {motivos.map(m => <option key={m.id} value={m.id}>{m.descricao}</option>)}
                    </select>
                    <FieldError id="ere-motivo-err" message={erros.motivoEstornoId} />
                </div>
                <div className="form-group" style={{ margin: 0, flex: '1 1 240px' }}>
                    <label className="form-label" htmlFor="ere-obs">Observações</label>
                    <input id="ere-obs" className="form-control" value={observacoes} maxLength={5000} onChange={e => setObservacoes(e.target.value)} />
                </div>
                <button type="button" className="abtn abtn-secondary" onClick={onCancelar}>Cancelar</button>
                <SubmitButton type="button" submitting={aEmitir} loadingLabel="A estornar…" onClick={estornar} icon={<RotateCcw size={12} />}>Confirmar estorno</SubmitButton>
            </div>
            <FieldError id="ere-conta-err" message={erros.contaBancariaId ?? erros.dataHora ?? erros.documentoConfigId} />
            <div style={{ ...muted, marginTop: 8 }}>
                Repõe o pendente dos documentos liquidados e devolve {fmtMoney(l.total, l.moeda)} de {l.contaCodigo} (movimento em conta de sinal contrário
                {' '}— numa caixa, tem de estar aberta e com saldo). O recebimento original não é alterado.
            </div>
        </div>
    );
};

const DetalheRecebimento: React.FC<{ id: number; podeEstornar: boolean; onClose: () => void; onMudou: () => void; onAbrir: (id: number) => void }> = ({ id, podeEstornar, onClose, onMudou, onAbrir }) => {
    const { fmtMoney } = useGlobal();
    const [l, setL] = useState<Liquidacao | null>(null);
    const [aEstornar, setAEstornar] = useState(false);
    const carregar = useCallback(() => {
        tesourariaApi.liquidacao(id).then(setL).catch(e => { showToast(extractErrorMessage(e), 'error'); onClose(); });
    }, [id, onClose]);
    useEffect(() => { carregar(); }, [carregar]);
    if (!l) return <Modal titulo="Recebimento" onClose={onClose} footer={null}><div style={muted}>A carregar…</div></Modal>;
    const estornavel = podeEstornar && !l.eEstorno && !l.estornadaPor;
    const link: React.CSSProperties = { ...mono, fontWeight: 700, color: 'var(--blue)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' };
    return (
        <Modal titulo={`${l.eEstorno ? 'Estorno de recebimento' : 'Recebimento'} ${l.numeroDocumento}`} largura={760} onClose={onClose}
            footer={<>
                {estornavel && !aEstornar && (
                    <button type="button" className="abtn abtn-secondary" style={{ marginRight: 'auto' }} onClick={() => setAEstornar(true)}><RotateCcw size={12} /> Estornar recebimento</button>
                )}
                <button type="button" className="abtn abtn-secondary" onClick={onClose}>Fechar</button>
                <button type="button" className="abtn abtn-primary" onClick={() => imprimirRecibo(id)}><Printer size={12} /> Imprimir</button>
            </>}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 12 }}>
                <div><div style={muted}>Cliente</div><div style={{ fontWeight: 700 }}>{l.clienteNome}</div></div>
                <div><div style={muted}>Data-hora</div><div>{fmtDataHora(l.dataHora)}</div></div>
                <div><div style={muted}>{l.eEstorno ? 'Conta de origem da devolução' : 'Conta de destino'}</div><div>{l.contaCodigo} — {l.contaDescricao}</div></div>
                {l.eEstorno && l.liquidacaoOrigemId && (
                    <div><div style={muted}>Estorna</div>
                        <button type="button" style={link} onClick={() => onAbrir(l.liquidacaoOrigemId!)}>{l.liquidacaoOrigemNumero ?? `#${l.liquidacaoOrigemId}`}</button>
                        {l.motivoEstornoDescricao && <div style={muted}>{l.motivoEstornoDescricao}</div>}
                    </div>
                )}
                {l.estornadaPor && (
                    <div><div style={muted}>Estornado por</div>
                        <button type="button" style={link} onClick={() => onAbrir(l.estornadaPor!.id)}>{l.estornadaPor.numeroDocumento ?? `#${l.estornadaPor.id}`}</button>
                    </div>
                )}
            </div>
            <table className="data-table">
                <thead><tr><th>Documento</th><th>OT</th><th style={num}>Pendente anterior</th><th style={num}>{l.eEstorno ? 'Reposto' : 'Pago'}</th><th style={num}>Desconto</th><th style={num}>Fica pendente</th></tr></thead>
                <tbody>{(l.linhas ?? []).map(x => {
                    const sinal = l.eEstorno ? 1 : -1;
                    return (
                        <tr key={x.id}>
                            <td style={{ ...mono, fontWeight: 700 }}>{x.numeroDocumento ?? `#${x.movimentoCcId}`}</td>
                            <td style={mono}>{x.otNumero ?? '—'}</td>
                            <td style={num}>{fmtMoney(x.pendenteAnterior, l.moeda)}</td>
                            <td style={{ ...num, fontWeight: 700 }}>{fmtMoney(x.valorPago, l.moeda)}</td>
                            <td style={num}>{x.desconto ? fmtMoney(x.desconto, l.moeda) : '—'}</td>
                            <td style={num}>{fmtMoney(x.pendenteAnterior + sinal * (x.valorPago + x.desconto), l.moeda)}</td>
                        </tr>
                    );
                })}</tbody>
            </table>
            <div style={{ ...muted, margin: '12px 0 4px', fontWeight: 700 }}>Movimentos em conta gerados</div>
            <table className="data-table">
                <thead><tr><th>Documento</th><th>Modo de pagamento</th><th style={num}>Valor</th></tr></thead>
                <tbody>{(l.movimentosConta ?? []).map(mc => (
                    <tr key={mc.id}><td style={mono}>{mc.numeroDocumento}</td><td>{mc.modoPagamentoDescricao ?? '—'}</td><td style={num}>{fmtMoney(mc.valor, l.moeda)}</td></tr>
                ))}</tbody>
            </table>
            {l.observacoes && <div style={{ ...muted, marginTop: 12 }}>Observações: {l.observacoes}</div>}
            {aEstornar && <EstornarRecebimento l={l} onCancelar={() => setAEstornar(false)} onFeito={() => { setAEstornar(false); carregar(); onMudou(); }} />}
        </Modal>
    );
};

const RecebimentosTab: React.FC<{ versao: number; podeEstornar?: boolean; onMudou?: () => void }> = ({ versao, podeEstornar = false, onMudou }) => {
    const { fmtMoney } = useGlobal();
    const [lista, setLista] = useState<Liquidacao[] | null>(null);
    const [detalhe, setDetalhe] = useState<number | null>(null);
    const fechar = useCallback(() => setDetalhe(null), []);

    const carregar = useCallback(() => {
        tesourariaApi.liquidacoes().then(setLista).catch(e => showToast(extractErrorMessage(e), 'error'));
    }, []);
    useEffect(() => { carregar(); }, [carregar, versao]);

    return (
        <>
            <div className="table-container">
                <div className="table-scroll">
                    <table className="data-table">
                        <thead><tr><th>Documento</th><th>Data</th><th>Cliente</th><th>Conta</th><th style={num}>Recebido</th><th style={num}>Desconto</th><th /></tr></thead>
                        <tbody>
                            {!lista && <tr><td colSpan={7} style={muted}>A carregar…</td></tr>}
                            {lista?.length === 0 && (
                                <tr><td colSpan={7}><EmptyState icon={<HandCoins size={28} />} title="Sem recebimentos" description="Os recebimentos registam-se a partir do separador Pendentes." /></td></tr>
                            )}
                            {lista?.map(l => (
                                <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => setDetalhe(l.id)}>
                                    <td style={{ ...mono, fontWeight: 700, color: 'var(--blue)' }}>{l.numeroDocumento}</td>
                                    <td style={{ fontSize: '0.78rem' }}>{fmtDataHora(l.dataHora)}</td>
                                    <td style={{ fontWeight: 600 }}>{l.clienteNome}</td>
                                    <td style={{ fontSize: '0.78rem' }}>{l.contaCodigo}</td>
                                    <td style={{ ...num, fontWeight: 700 }}>{fmtMoney(l.eEstorno ? -l.total : l.total, l.moeda)}</td>
                                    <td style={num}>{l.desconto ? fmtMoney(l.desconto, l.moeda) : '—'}</td>
                                    <td>
                                        {l.eEstorno && <span style={badge('#F3E5F5', '#6A1B9A')}>Estorno</span>}
                                        {l.estornadaPor && <span style={badge('#FDECEA', '#B71C1C')}>Estornado</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="table-count">{lista?.length ?? 0} recebimento(s)</div>
            </div>
            {detalhe !== null && (
                <DetalheRecebimento key={detalhe} id={detalhe} podeEstornar={podeEstornar} onClose={fechar} onAbrir={setDetalhe}
                    onMudou={() => { carregar(); onMudou?.(); }} />
            )}
        </>
    );
};

export default RecebimentosTab;
