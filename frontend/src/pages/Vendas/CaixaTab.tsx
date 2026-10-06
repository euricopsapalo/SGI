import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDownCircle, Landmark, Lock, LockOpen, History } from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import SubmitButton from '../../components/SubmitButton';
import FieldError, { fieldAria } from '../../components/FieldError';
import { useGlobal } from '../../contexts/GlobalContext';
import { extractErrorMessage, extractFieldErrors, showToast } from '../../utils/errorHandler';
import { apuramentoCaixa, caixaApi, type EstadoCaixa, type SessaoCaixa } from '../../services/tesouraria';
import { fmtDataHora, Modal, mono, muted, num } from './ui';

/**
 * #167 — Gestão de caixa (v10 §6.4, v11 §5.5): abertura com valor sugerido,
 * saídas e fecho com apuramento — a diferença gera o acerto de sobra/quebra.
 * Qualquer recebimento em numerário exige a caixa aberta.
 */

type Operacao = { tipo: 'abrir' | 'saida' | 'fechar'; caixa: EstadoCaixa };

const ORIGEM: Record<string, string> = { LIQUIDACAO: 'Recebimento', SAIDA_CAIXA: 'Saída', ACERTO_CAIXA: 'Acerto' };

const EstadoBadge: React.FC<{ aberta: boolean }> = ({ aberta }) => (
    <span style={{
        fontSize: '0.72rem', padding: '2px 8px', borderRadius: 10, fontWeight: 700, whiteSpace: 'nowrap',
        background: aberta ? '#E8F5E9' : '#ECEFF1', color: aberta ? '#2E7D32' : '#546E7A',
    }}>{aberta ? 'Aberta' : 'Fechada'}</span>
);

/* ══ Abrir / Saída / Fechar ═══════════════════════════════════ */
const OperacaoModal: React.FC<{ op: Operacao; onClose: () => void; onFeito: () => void }> = ({ op, onClose, onFeito }) => {
    const { fmtMoney } = useGlobal();
    const { caixa, tipo } = op;
    const moeda = caixa.conta.moeda;
    const s = caixa.sessao;
    const [valor, setValor] = useState<string>(tipo === 'abrir' ? String(caixa.valorSugerido) : tipo === 'fechar' ? String(s?.saldoTeorico ?? 0) : '');
    const [texto, setTexto] = useState('');
    const [erros, setErros] = useState<Record<string, string>>({});
    const [aGravar, setAGravar] = useState(false);

    const v = Number(valor);
    const apur = tipo === 'fechar' && s && valor !== '' ? apuramentoCaixa(s.saldoTeorico, v) : null;
    const titulo = { abrir: 'Abrir caixa', saida: 'Saída de caixa', fechar: 'Fechar caixa' }[tipo];

    const confirmar = async () => {
        const e: Record<string, string> = {};
        if (valor === '' || Number.isNaN(v) || v < 0) e.valor = 'Indique um valor válido';
        if (tipo === 'saida' && !(v > 0)) e.valor = 'O valor da saída tem de ser superior a zero';
        if (tipo === 'saida' && texto.trim().length < 3) e.motivo = 'Indique o motivo da saída';
        if (Object.keys(e).length) { setErros(e); return; }
        setAGravar(true); setErros({});
        try {
            const id = caixa.conta.id;
            const r: SessaoCaixa = tipo === 'abrir'
                ? await caixaApi.abrir(id, { valorDeclarado: v, observacoes: texto.trim() || undefined })
                : tipo === 'saida'
                    ? await caixaApi.saida(id, { valor: v, motivo: texto.trim() })
                    : await caixaApi.fechar(id, { valorContado: v, observacoes: texto.trim() || undefined });
            showToast(tipo === 'abrir' ? `${r.aberturaDocumento} — caixa ${caixa.conta.codigo} aberta`
                : tipo === 'saida' ? `Saída de ${fmtMoney(v, moeda)} registada`
                : `${r.fechoDocumento} — caixa ${caixa.conta.codigo} fechada${r.acertoDocumento ? ` com acerto ${r.acertoDocumento}` : ''}`, 'success');
            onFeito();
            onClose();
        } catch (err) {
            const fe = extractFieldErrors(err);
            // O backend chama o campo pelo nome do DTO; aqui há um só campo de valor.
            setErros({ ...fe, valor: fe.valor ?? fe.valorDeclarado ?? fe.valorContado });
            showToast(extractErrorMessage(err), 'error');
        } finally { setAGravar(false); }
    };

    const linha = (label: string, valor: number, forte = false) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, fontWeight: forte ? 800 : 500, fontSize: forte ? '0.9rem' : '0.8rem' }}>
            <span>{label}</span><span style={num}>{fmtMoney(valor, moeda)}</span>
        </div>
    );

    return (
        <Modal titulo={`${titulo} · ${caixa.conta.codigo}`} largura={480} onClose={onClose}
            footer={<>
                <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                <SubmitButton type="button" submitting={aGravar} onClick={confirmar}>{titulo}</SubmitButton>
            </>}>
            {tipo !== 'abrir' && s && (
                <div style={{ display: 'grid', gap: 4, marginBottom: 14, padding: 10, background: 'var(--panel-header-bg)', borderRadius: 6 }}>
                    {linha('Abertura', s.valorDeclarado)}
                    {linha('Entradas', s.entradas)}
                    {linha('Saídas', -s.saidas)}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 4 }}>{linha('Saldo teórico', s.saldoTeorico, true)}</div>
                </div>
            )}
            {tipo === 'abrir' && (
                <div style={{ ...muted, marginBottom: 10 }}>
                    Valor sugerido (contado no último fecho): <strong>{fmtMoney(caixa.valorSugerido, moeda)}</strong>. Declare o valor que está fisicamente na caixa.
                </div>
            )}
            <div className="form-group">
                <label className="form-label" htmlFor="cx-valor">
                    {tipo === 'abrir' ? 'Valor declarado' : tipo === 'saida' ? 'Valor da saída' : 'Valor contado'}
                </label>
                <input id="cx-valor" className="form-control" type="number" min={0} step="0.01" style={num} value={valor} autoFocus
                    onChange={e => setValor(e.target.value)} {...fieldAria('cx-valor-e', erros.valor)} />
                <FieldError id="cx-valor-e" message={erros.valor} />
            </div>
            {apur && (
                <div role="status" style={{
                    marginBottom: 12, padding: 8, borderRadius: 6, fontSize: '0.8rem', fontWeight: 600,
                    background: apur.acerto === 'QUEBRA' ? '#FEF2F2' : apur.acerto === 'SOBRA' ? '#EFF6FF' : '#E8F5E9',
                    color: apur.acerto === 'QUEBRA' ? '#B91C1C' : apur.acerto === 'SOBRA' ? '#1565C0' : '#2E7D32',
                }}>
                    {apur.acerto === null
                        ? 'Sem diferença — o contado bate com o saldo teórico.'
                        : `${apur.acerto === 'SOBRA' ? 'Sobra' : 'Quebra'} de ${fmtMoney(Math.abs(apur.diferenca), moeda)} — gera um documento de acerto de ${apur.acerto === 'SOBRA' ? 'sobra' : 'quebra'}.`}
                </div>
            )}
            <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" htmlFor="cx-texto">{tipo === 'saida' ? 'Motivo' : 'Observações'}</label>
                {tipo === 'saida'
                    ? <input id="cx-texto" className="form-control" maxLength={300} value={texto} placeholder="Ex.: depósito no banco, compra de material…"
                        onChange={e => setTexto(e.target.value)} {...fieldAria('cx-texto-e', erros.motivo)} />
                    : <textarea id="cx-texto" className="form-control" rows={2} value={texto} onChange={e => setTexto(e.target.value)} />}
                <FieldError id="cx-texto-e" message={erros.motivo ?? erros.dataHora ?? erros.documentoConfigId ?? erros.contaBancariaId} />
            </div>
        </Modal>
    );
};

/* ══ Detalhe de uma sessão ════════════════════════════════════ */
const MovimentosSessao: React.FC<{ sessao: SessaoCaixa; moeda: string }> = ({ sessao, moeda }) => {
    const { fmtMoney } = useGlobal();
    const movs = sessao.movimentos ?? [];
    return (
        <table className="data-table">
            <thead><tr><th>Data-hora</th><th>Documento</th><th>Tipo</th><th>Descrição</th><th style={num}>Valor</th></tr></thead>
            <tbody>
                {movs.length === 0 && <tr><td colSpan={5} style={muted}>Sem movimentos nesta sessão.</td></tr>}
                {movs.map(m => (
                    <tr key={m.id}>
                        <td style={{ fontSize: '0.78rem' }}>{fmtDataHora(m.dataHora)}</td>
                        <td style={mono}>{m.numeroDocumento}{m.origemDocumento && <div style={muted}>{m.origemDocumento}</div>}</td>
                        <td style={{ fontSize: '0.78rem' }}>{ORIGEM[m.origemTipo] ?? m.origemTipo}</td>
                        <td style={{ fontSize: '0.78rem' }}>{m.descricao ?? '—'}{m.modoPagamentoDescricao && <div style={muted}>{m.modoPagamentoDescricao}</div>}</td>
                        <td style={{ ...num, fontWeight: 700, color: m.valor < 0 ? 'var(--red, #dc2626)' : undefined }}>{fmtMoney(m.valor, moeda)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

const SessaoDetalhe: React.FC<{ id: number; moeda: string; onClose: () => void }> = ({ id, moeda, onClose }) => {
    const { fmtMoney } = useGlobal();
    const [s, setS] = useState<SessaoCaixa | null>(null);
    useEffect(() => {
        caixaApi.sessao(id).then(setS).catch(e => { showToast(extractErrorMessage(e), 'error'); onClose(); });
    }, [id, onClose]);
    if (!s) return <Modal titulo="Sessão de caixa" onClose={onClose} footer={null}><div style={muted}>A carregar…</div></Modal>;
    const campo = (label: string, v: React.ReactNode) => <div><div style={muted}>{label}</div><div style={{ fontWeight: 600 }}>{v}</div></div>;
    return (
        <Modal titulo={`Sessão ${s.aberturaDocumento ?? `#${s.id}`} · ${s.contaCodigo ?? ''}`} largura={820} onClose={onClose}
            footer={<button type="button" className="abtn abtn-secondary" onClick={onClose}>Fechar</button>}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 12 }}>
                {campo('Aberta em', fmtDataHora(s.abertaEm))}
                {campo('Sugerido / declarado', `${fmtMoney(s.valorSugerido, moeda)} / ${fmtMoney(s.valorDeclarado, moeda)}`)}
                {campo('Entradas / saídas', `${fmtMoney(s.entradas, moeda)} / ${fmtMoney(s.saidas, moeda)}`)}
                {campo('Saldo teórico', fmtMoney(s.saldoTeorico, moeda))}
                {s.estado === 'FECHADA' && campo('Fecho', `${s.fechoDocumento ?? '—'} · ${fmtDataHora(s.fechadaEm)}`)}
                {s.estado === 'FECHADA' && campo('Contado', fmtMoney(s.valorContado ?? 0, moeda))}
                {s.estado === 'FECHADA' && campo('Acerto', s.acertoDocumento ? `${s.acertoDocumento} (${fmtMoney(s.acertoValor ?? 0, moeda)})` : 'Sem diferença')}
            </div>
            <MovimentosSessao sessao={s} moeda={moeda} />
            {(s.observacoesAbertura || s.observacoesFecho) && (
                <div style={{ ...muted, marginTop: 12 }}>
                    {s.observacoesAbertura && <div>Abertura: {s.observacoesAbertura}</div>}
                    {s.observacoesFecho && <div>Fecho: {s.observacoesFecho}</div>}
                </div>
            )}
        </Modal>
    );
};

/* ══ Separador ════════════════════════════════════════════════ */
const CaixaTab: React.FC<{ podeOperar: boolean; versao: number; onMudou: () => void }> = ({ podeOperar, versao, onMudou }) => {
    const { fmtMoney } = useGlobal();
    const [caixas, setCaixas] = useState<EstadoCaixa[] | null>(null);
    const [selecionada, setSelecionada] = useState<number | null>(null);
    const [atual, setAtual] = useState<EstadoCaixa | null>(null);
    const [historico, setHistorico] = useState<SessaoCaixa[]>([]);
    const [op, setOp] = useState<Operacao | null>(null);
    const [detalhe, setDetalhe] = useState<number | null>(null);
    const fecharOp = useCallback(() => setOp(null), []);
    const fecharDetalhe = useCallback(() => setDetalhe(null), []);

    const carregar = useCallback(async () => {
        try {
            const lista = await caixaApi.listar();
            setCaixas(lista);
            setSelecionada(sel => sel ?? lista.find(c => c.conta.ativo)?.conta.id ?? lista[0]?.conta.id ?? null);
        } catch (e) { showToast(extractErrorMessage(e), 'error'); setCaixas([]); }
    }, []);
    useEffect(() => { carregar(); }, [carregar, versao]);

    useEffect(() => {
        if (selecionada === null) return;
        Promise.all([caixaApi.caixa(selecionada), caixaApi.sessoes(selecionada)])
            .then(([c, h]) => { setAtual(c); setHistorico(h); })
            .catch(e => showToast(extractErrorMessage(e), 'error'));
    }, [selecionada, caixas]);

    const feito = () => { carregar(); onMudou(); };

    if (caixas === null) return <div style={muted}>A carregar…</div>;
    if (caixas.length === 0) {
        return <EmptyState icon={<Landmark size={28} />} title="Nenhuma caixa" description="Crie uma conta do tipo Caixa em Configurações → Documentos de Venda." />;
    }

    const moeda = atual?.conta.moeda ?? 'AOA';
    const s = atual?.sessao ?? null;

    return (
        <>
            <div className="stats-row">
                {caixas.map(c => (
                    <button key={c.conta.id} type="button" className="stat-card" onClick={() => setSelecionada(c.conta.id)}
                        aria-pressed={selecionada === c.conta.id}
                        style={{ textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', outline: selecionada === c.conta.id ? '2px solid var(--blue)' : undefined }}>
                        <span className="stat-label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {c.conta.codigo} — {c.conta.descricao} <EstadoBadge aberta={c.conta.aberta} />
                        </span>
                        <span className={`stat-value ${c.sessao ? 'blue' : 'muted'}`}>
                            {c.sessao ? fmtMoney(c.sessao.saldoTeorico, c.conta.moeda) : fmtMoney(c.valorSugerido, c.conta.moeda)}
                        </span>
                        <span style={muted}>{c.sessao ? 'saldo teórico da sessão' : 'contado no último fecho'}</span>
                    </button>
                ))}
            </div>

            {atual && (
                <div className="table-container" style={{ padding: 12, marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                        <strong>{atual.conta.codigo} — {atual.conta.descricao}</strong>
                        <EstadoBadge aberta={atual.conta.aberta} />
                        {s && <span style={muted}>{s.aberturaDocumento} · aberta em {fmtDataHora(s.abertaEm)}</span>}
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                            {podeOperar && !s && atual.conta.ativo && (
                                <button type="button" className="abtn abtn-primary" onClick={() => setOp({ tipo: 'abrir', caixa: atual })}><LockOpen size={12} /> Abrir caixa</button>
                            )}
                            {podeOperar && s && <>
                                <button type="button" className="abtn abtn-secondary" onClick={() => setOp({ tipo: 'saida', caixa: atual })}><ArrowDownCircle size={12} /> Saída de caixa</button>
                                <button type="button" className="abtn abtn-primary" onClick={() => setOp({ tipo: 'fechar', caixa: atual })}><Lock size={12} /> Fechar caixa</button>
                            </>}
                        </div>
                    </div>
                    {s ? <>
                        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 10, fontSize: '0.8rem' }}>
                            <span>Abertura: <strong style={num}>{fmtMoney(s.valorDeclarado, moeda)}</strong>
                                {s.valorDeclarado !== s.valorSugerido && <span style={muted}> (sugerido {fmtMoney(s.valorSugerido, moeda)})</span>}</span>
                            <span>Entradas: <strong style={num}>{fmtMoney(s.entradas, moeda)}</strong></span>
                            <span>Saídas: <strong style={num}>{fmtMoney(s.saidas, moeda)}</strong></span>
                            <span>Saldo teórico: <strong style={num}>{fmtMoney(s.saldoTeorico, moeda)}</strong></span>
                        </div>
                        <div className="table-scroll"><MovimentosSessao sessao={s} moeda={moeda} /></div>
                    </> : (
                        <div style={muted}>
                            <Lock size={11} /> Caixa fechada — os recebimentos em numerário para esta caixa ficam bloqueados até à abertura.
                        </div>
                    )}
                </div>
            )}

            <div style={{ ...muted, fontWeight: 700, margin: '4px 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}><History size={12} /> Sessões anteriores</div>
            <div className="table-container">
                <div className="table-scroll">
                    <table className="data-table">
                        <thead><tr>
                            <th>Abertura</th><th>Fecho</th><th style={num}>Declarado</th><th style={num}>Teórico</th>
                            <th style={num}>Contado</th><th style={num}>Diferença</th><th>Acerto</th>
                        </tr></thead>
                        <tbody>
                            {historico.length === 0 && <tr><td colSpan={7} style={muted}>Sem sessões.</td></tr>}
                            {historico.map(h => (
                                <tr key={h.id} style={{ cursor: 'pointer' }} onClick={() => setDetalhe(h.id)}>
                                    <td style={{ fontSize: '0.78rem' }}><span style={{ ...mono, fontWeight: 700, color: 'var(--blue)' }}>{h.aberturaDocumento}</span><div style={muted}>{fmtDataHora(h.abertaEm)}</div></td>
                                    <td style={{ fontSize: '0.78rem' }}>{h.estado === 'ABERTA' ? <EstadoBadge aberta /> : <><span style={mono}>{h.fechoDocumento}</span><div style={muted}>{fmtDataHora(h.fechadaEm)}</div></>}</td>
                                    <td style={num}>{fmtMoney(h.valorDeclarado, moeda)}</td>
                                    <td style={num}>{fmtMoney(h.saldoTeorico, moeda)}</td>
                                    <td style={num}>{h.valorContado !== null ? fmtMoney(h.valorContado, moeda) : '—'}</td>
                                    <td style={{ ...num, fontWeight: 700, color: (h.diferenca ?? 0) < 0 ? 'var(--red, #dc2626)' : undefined }}>
                                        {h.diferenca !== null ? fmtMoney(h.diferenca, moeda) : '—'}
                                    </td>
                                    <td style={mono}>{h.acertoDocumento ?? '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="table-count">{historico.length} sessão(ões)</div>
            </div>

            {op && <OperacaoModal op={op} onClose={fecharOp} onFeito={feito} />}
            {detalhe !== null && <SessaoDetalhe id={detalhe} moeda={moeda} onClose={fecharDetalhe} />}
        </>
    );
};

export default CaixaTab;
