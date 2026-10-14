import React, { useEffect, useMemo, useState } from 'react';
import { Lock, RotateCcw } from 'lucide-react';
import SubmitButton from '../../components/SubmitButton';
import FieldError, { fieldAria } from '../../components/FieldError';
import { useGlobal } from '../../contexts/GlobalContext';
import { extractErrorMessage, extractFieldErrors, showToast } from '../../utils/errorHandler';
import { vendasApi, calcularTotais, paraDataHoraLocal, type DocumentoVenda } from '../../services/vendas';
import { vendasConfigApi, type DocumentoConfig, type MotivoEstorno } from '../../services/vendasConfig';
import { Modal, muted, num } from './ui';

/**
 * #169 — Ratificação / Estorno (v11 §5.3): o documento original fica só de leitura
 * e o utilizador indica, linha a linha, a quantidade a estornar e o motivo. Emite o
 * documento de estorno configurado (NC para FT/FR, ND para NC), que abate o
 * pendente do original; não mexe em stock. Estorno total liberta a OT.
 */

const restante = (l: { quantidade: number; qtdEstornada: number }) => Math.round((l.quantidade - l.qtdEstornada) * 1000) / 1000;

interface LinhaEstorno { qtd: string; motivoId: string }

const EstornoModal: React.FC<{ id: number; configs: DocumentoConfig[]; onClose: () => void; onMudou: () => void }> = ({ id, configs, onClose, onMudou }) => {
    const { fmtMoney } = useGlobal();
    const [doc, setDoc] = useState<DocumentoVenda | null>(null);
    const [motivos, setMotivos] = useState<MotivoEstorno[]>([]);
    const [linhas, setLinhas] = useState<Record<number, LinhaEstorno>>({});
    const [serieId, setSerieId] = useState('');
    const [dataHora, setDataHora] = useState(paraDataHoraLocal(new Date()));
    const [observacoes, setObservacoes] = useState('');
    const [erros, setErros] = useState<Record<string, string>>({});
    const [aEmitir, setAEmitir] = useState(false);

    useEffect(() => {
        Promise.all([vendasApi.documento(id), vendasConfigApi.motivos()])
            .then(([d, ms]) => { setDoc(d); setMotivos(ms.filter(x => x.ativo)); })
            .catch(e => { showToast(extractErrorMessage(e), 'error'); onClose(); });
    }, [id, onClose]);

    const configOrigem = configs.find(c => c.id === doc?.documentoConfigId);
    const configEstorno = configs.find(c => c.id === configOrigem?.estornoDocId);
    const series = (configEstorno?.series ?? []).filter(s => s.ativo);
    useEffect(() => {
        if (serieId || !series.length) return;
        const preferida = series.find(s => s.id === configOrigem?.estornoSerieId) ?? series.find(s => s.porDefeito) ?? series[0];
        setSerieId(String(preferida.id));
    }, [series, serieId, configOrigem]);

    const origem = doc?.linhas ?? [];
    const set = (linhaId: number, patch: Partial<LinhaEstorno>) =>
        setLinhas(ls => ({ ...ls, [linhaId]: { ...(ls[linhaId] ?? { qtd: '', motivoId: '' }), ...patch } }));
    const motivoPorDefeito = motivos[0] ? String(motivos[0].id) : '';
    const estornarTudo = () => setLinhas(Object.fromEntries(origem.filter(l => restante(l) > 0)
        .map(l => [l.id, { qtd: String(restante(l)), motivoId: linhas[l.id]?.motivoId || motivoPorDefeito }])));

    /** Linhas a enviar: as que têm quantidade > 0, pela ordem do documento. */
    const pedidas = origem.filter(l => Number(linhas[l.id]?.qtd) > 0);
    const totais = useMemo(() => calcularTotais(pedidas.map(l => ({
        quantidade: Number(linhas[l.id].qtd), precoUnitario: l.precoUnitario, desconto: l.desconto, taxaIva: l.taxaIva,
    })), doc?.descontoGlobal ?? 0), [pedidas, linhas, doc]);

    const pendente = doc?.valorPendente ?? 0;
    const abate = Math.min(pendente, totais.total);
    const saldoFavor = Math.max(0, Math.round((totais.total - abate) * 100) / 100);
    // Estorno total de uma fatura liberta a OT (o estorno de uma NC não).
    const total = !doc?.documentoOrigemId && origem.length > 0 && origem.every(l => restante(l) - (Number(linhas[l.id]?.qtd) || 0) <= 0);

    const emitir = async () => {
        if (!pedidas.length) { setErros({ linhas: 'Indique a quantidade a estornar em pelo menos uma linha' }); return; }
        setAEmitir(true); setErros({});
        try {
            const r = await vendasApi.estornar(id, {
                serieId: serieId ? Number(serieId) : undefined,
                dataHora: new Date(dataHora).toISOString(),
                observacoes: observacoes.trim() || undefined,
                linhas: pedidas.map(l => ({ linhaId: l.id, quantidade: Number(linhas[l.id].qtd), motivoEstornoId: Number(linhas[l.id].motivoId) })),
            });
            showToast(`${r.numeroDocumento} emitida — ${fmtMoney(r.total, r.moeda)} estornados de ${doc?.numeroDocumento}`
                + (total && doc?.otNumero ? ` · a OT ${doc.otNumero} volta a estar disponível para faturar` : ''), 'success');
            onMudou();
            onClose();
        } catch (e) {
            // Erros por índice das linhas enviadas (`linhas.N.campo`) → por linha do documento.
            const out: Record<string, string> = {};
            for (const [k, v] of Object.entries(extractFieldErrors(e))) {
                const m = /^linhas\.(\d+)\.(\w+)$/.exec(k);
                if (m && pedidas[Number(m[1])]) out[`${pedidas[Number(m[1])].id}.${m[2]}`] = v; else out[k] = v;
            }
            setErros(out);
            showToast(extractErrorMessage(e), 'error');
        } finally { setAEmitir(false); }
    };

    if (!doc) return <Modal titulo="Ratificação / Estorno" onClose={onClose} footer={null}><div style={muted}>A carregar…</div></Modal>;
    const semEstorno = !configOrigem?.estorno || !configEstorno;

    return (
        <Modal titulo={`Ratificação / Estorno · ${doc.numeroDocumento ?? ''}`} largura={980} onClose={onClose}
            footer={<>
                <button type="button" className="abtn abtn-secondary" style={{ marginRight: 'auto' }} onClick={estornarTudo} disabled={semEstorno}>Estornar tudo</button>
                <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                <SubmitButton type="button" submitting={aEmitir} loadingLabel="A emitir…" disabled={semEstorno || !pedidas.length}
                    onClick={emitir} icon={<RotateCcw size={12} />}>Emitir {configEstorno?.codigo ?? 'estorno'}</SubmitButton>
            </>}>
            {semEstorno && (
                <div role="alert" style={{ color: 'var(--red, #dc2626)', marginBottom: 10 }}>
                    O documento {doc.documentoCodigo} não tem Ratificação/Estorno configurado (Configurações → Documentos de Venda).
                </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
                <div><div style={muted}>Cliente</div><div style={{ fontWeight: 700 }}>{doc.clienteNome}</div></div>
                <div><div style={muted}>OT</div><div>{doc.otNumero ?? '—'}</div></div>
                <div><div style={muted}>Total do documento</div><div style={{ fontWeight: 700 }}>{fmtMoney(doc.total, doc.moeda)}</div></div>
                <div><div style={muted}>Pendente actual</div><div>{doc.valorPendente !== null ? fmtMoney(doc.valorPendente, doc.moeda) : '—'}</div></div>
                <div><div style={muted}>Documento de estorno</div><div>{configEstorno ? `${configEstorno.codigo} — ${configEstorno.descricao}` : '—'}</div></div>
            </div>

            <div className="table-scroll">
                <table className="data-table">
                    <thead><tr>
                        <th>Descrição</th>
                        <th style={num}>Faturado</th>
                        <th style={num}>Já estornado</th>
                        <th style={num}>Preço</th>
                        <th style={num}>Desc. %</th>
                        <th style={num}>IVA</th>
                        <th style={{ ...num, width: 110 }}>Estorno</th>
                        <th style={{ width: 220 }}>Motivo</th>
                    </tr></thead>
                    <tbody>
                        {origem.map((l, i) => {
                            const falta = restante(l);
                            const v = linhas[l.id];
                            const eQtd = erros[`${l.id}.quantidade`];
                            const eMot = erros[`${l.id}.motivoEstornoId`];
                            const ativa = Number(v?.qtd) > 0;
                            return (
                                <tr key={l.id} style={{ opacity: falta > 0 ? 1 : 0.5 }}>
                                    <td style={{ minWidth: 160 }}>{l.descricao}</td>
                                    <td style={num}>{l.quantidade}</td>
                                    <td style={num}>{l.qtdEstornada || '—'}</td>
                                    <td style={num}>{fmtMoney(l.precoUnitario, doc.moeda)}</td>
                                    <td style={num}>{l.desconto || '—'}</td>
                                    <td style={num}>{l.taxaIva}%</td>
                                    <td>
                                        <input className="form-control" type="number" min={0} max={falta} step="any" style={num}
                                            value={v?.qtd ?? ''} disabled={falta <= 0 || semEstorno} placeholder={falta > 0 ? `até ${falta}` : 'estornada'}
                                            aria-label={`Quantidade a estornar da linha ${i + 1}`} {...fieldAria(`es-qtd-${l.id}`, eQtd)}
                                            onChange={e => set(l.id, { qtd: e.target.value, ...(!v?.motivoId ? { motivoId: motivoPorDefeito } : {}) })} />
                                        <FieldError id={`es-qtd-${l.id}`} message={eQtd} />
                                    </td>
                                    <td>
                                        <select className="form-control" value={v?.motivoId ?? ''} disabled={!ativa}
                                            aria-label={`Motivo do estorno da linha ${i + 1}`} {...fieldAria(`es-mot-${l.id}`, eMot)}
                                            onChange={e => set(l.id, { motivoId: e.target.value })}>
                                            <option value="">—</option>
                                            {motivos.map(m => <option key={m.id} value={m.id}>{m.descricao}</option>)}
                                        </select>
                                        <FieldError id={`es-mot-${l.id}`} message={eMot} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <FieldError id="es-linhas" message={erros.linhas} />

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 12 }}>
                <div style={{ flex: '1 1 320px', display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ margin: 0, minWidth: 180 }}>
                            <label className="form-label" htmlFor="es-serie">Série</label>
                            <select id="es-serie" className="form-control" value={serieId} onChange={e => setSerieId(e.target.value)} {...fieldAria('es-serie-err', erros.serieId)}>
                                {series.map(s => <option key={s.id} value={s.id}>{s.codigo} ({s.ano}){s.ultimoNumero ? ` · último n.º ${s.ultimoNumero}` : ''}</option>)}
                            </select>
                            <FieldError id="es-serie-err" message={erros.serieId} />
                        </div>
                        <div className="form-group" style={{ margin: 0, minWidth: 220 }}>
                            <label className="form-label" htmlFor="es-dh">Data-hora do estorno</label>
                            <input id="es-dh" className="form-control" type="datetime-local" value={dataHora} onChange={e => setDataHora(e.target.value)} {...fieldAria('es-dh-err', erros.dataHora)} />
                            <FieldError id="es-dh-err" message={erros.dataHora} />
                        </div>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" htmlFor="es-obs">Observações</label>
                        <textarea id="es-obs" className="form-control" rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} />
                    </div>
                    <FieldError id="es-doc-err" message={erros.documentoConfigId} />
                </div>
                <div style={{ marginLeft: 'auto', width: 300, display: 'grid', gap: 4, fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span style={num}>{fmtMoney(totais.subtotal, doc.moeda)}</span></div>
                    {totais.desconto > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Desconto global</span><span style={num}>{fmtMoney(-totais.desconto, doc.moeda)}</span></div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>IVA</span><span style={num}>{fmtMoney(totais.valorIva, doc.moeda)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 4, fontWeight: 800, fontSize: '0.95rem' }}>
                        <span>Total do estorno</span><span style={num}>{fmtMoney(totais.total, doc.moeda)}</span>
                    </div>
                </div>
            </div>

            {pedidas.length > 0 && (
                <div style={{ ...muted, marginTop: 12, padding: 10, border: '1px solid #BFDBFE', background: '#EFF6FF', borderRadius: 6 }}>
                    <Lock size={10} /> O documento {configEstorno?.codigo ?? 'de estorno'} é emitido de imediato — não tem rascunho e não pode ser alterado. Não mexe em stock.{' '}
                    {abate > 0 && <>Abate {fmtMoney(abate, doc.moeda)} ao pendente de {doc.numeroDocumento}. </>}
                    {saldoFavor > 0 && <>Ficam {fmtMoney(saldoFavor, doc.moeda)} a favor do cliente na conta corrente (a devolução do dinheiro faz-se estornando o recebimento). </>}
                    {total && doc.otNumero && <>Estorno total: a OT {doc.otNumero} volta a estar disponível para faturar.</>}
                </div>
            )}
        </Modal>
    );
};

export default EstornoModal;
