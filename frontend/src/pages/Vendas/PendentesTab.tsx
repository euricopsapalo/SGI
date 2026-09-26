import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Filter, HandCoins, Lock, Printer, Wallet } from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import SearchableSelect from '../../components/SearchableSelect';
import SubmitButton from '../../components/SubmitButton';
import FieldError, { fieldAria } from '../../components/FieldError';
import { useGlobal } from '../../contexts/GlobalContext';
import { extractErrorMessage, extractFieldErrors, showToast } from '../../utils/errorHandler';
import {
    tesourariaApi, filtrosDeUrl, filtrosParaUrl, podeSelecionar,
    type Pendente, type PendentesFiltros, type PendentesResposta,
} from '../../services/tesouraria';
import { paraDataHoraLocal } from '../../services/vendas';
import { vendasConfigApi, type ContaBancaria, type DocumentoConfig } from '../../services/vendasConfig';
import { adiado, CANCELADO, Modal, mono, muted, num } from './ui';
import { buildReciboHtml, imprimirDocumento } from './impressao';

/**
 * #174 — Pendentes da conta corrente de clientes, filtráveis por n.º de documento,
 * n.º de OT, entidade e data; os filtros ficam no URL (lista partilhável/imprimível).
 * #166 — a partir da selecção, regista-se o recebimento (`RE` → `MC`).
 */

const POR_PAGINA = 50;

/** Documentos de recebimento utilizáveis: Liquidações a receber, a operar sobre CC, com ligação a tesouraria. */
const eRecebimento = (d: DocumentoConfig) =>
    d.ativo && d.tipoCodigo === 'LIQUIDACOES' && d.natureza === 'RECEBIMENTO'
    && d.operaSobreCc && !!d.ccTipoId && !!d.ccEstadoId && d.ligacaoTesouraria && !!d.ligacaoTesourariaDocId;

/* ══ Resumo de liquidações (v10 §6.3) ══════════════════════════ */
interface LinhaPagar { p: Pendente; valorPago: number; desconto: number }

const ResumoLiquidacao: React.FC<{ selecionados: Pendente[]; onClose: () => void; onGravado: () => void }> = ({ selecionados, onClose, onGravado }) => {
    const { fmtMoney } = useGlobal();
    const [configs, setConfigs] = useState<DocumentoConfig[]>([]);
    const [contas, setContas] = useState<ContaBancaria[]>([]);
    const [docId, setDocId] = useState('');
    const [serieId, setSerieId] = useState('');
    const [contaId, setContaId] = useState('');
    const [dataHora, setDataHora] = useState(paraDataHoraLocal(new Date()));
    const [observacoes, setObservacoes] = useState('');
    const [referencia, setReferencia] = useState('');
    const [linhas, setLinhas] = useState<LinhaPagar[]>(selecionados.map(p => ({ p, valorPago: p.valorPendente, desconto: 0 })));
    const [erros, setErros] = useState<Record<string, string>>({});
    const [aGravar, setAGravar] = useState(false);

    useEffect(() => {
        Promise.all([vendasConfigApi.documentos(), vendasConfigApi.contas()])
            .then(([d, c]) => { setConfigs(d); setContas(c); })
            .catch(e => showToast(extractErrorMessage(e), 'error'));
    }, []);

    // Só os documentos de recebimento que operam sobre a conta/estado dos pendentes escolhidos.
    const recebimentos = configs.filter(d => eRecebimento(d)
        && selecionados.every(p => p.ccTipoId === d.ccTipoId && p.ccEstadoId === d.ccEstadoId));
    const doc = recebimentos.find(d => String(d.id) === docId);
    const mc = configs.find(d => d.id === doc?.ligacaoTesourariaDocId);
    const series = (doc?.series ?? []).filter(s => s.ativo);
    const contasMc = contas.filter(c => c.ativo && (mc?.contasBancariaIds ?? []).includes(c.id));

    useEffect(() => { if (!docId && recebimentos.length) setDocId(String(recebimentos[0].id)); }, [recebimentos, docId]);
    useEffect(() => {
        if (doc) setSerieId(String((series.find(s => s.porDefeito) ?? series[0])?.id ?? ''));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [docId, configs]);
    useEffect(() => {
        if (!contaId && contasMc.length) setContaId(String((contasMc.find(c => c.tipo !== 'CAIXA' || c.aberta) ?? contasMc[0]).id));
    }, [contasMc, contaId]);

    const conta = contasMc.find(c => String(c.id) === contaId);
    const caixaFechada = conta?.tipo === 'CAIXA' && !conta.aberta;
    const total = linhas.reduce((s, l) => s + (Number(l.valorPago) || 0), 0);
    const desconto = linhas.reduce((s, l) => s + (Number(l.desconto) || 0), 0);
    const set = (i: number, patch: Partial<LinhaPagar>) => setLinhas(ls => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

    const gravar = async (comImpressao = false) => {
        // #178 — a janela de impressão abre já (ligada ao clique) e só é preenchida depois de gravar.
        const gravado = adiado();
        let reciboId = 0;
        if (comImpressao) {
            imprimirDocumento(async () => { await gravado.promise; return buildReciboHtml(await tesourariaApi.imprimir(reciboId)); })
                .catch(e => { if (e !== CANCELADO) showToast(extractErrorMessage(e), 'error'); });
        }
        setAGravar(true); setErros({});
        try {
            const r = await tesourariaApi.liquidar({
                documentoConfigId: Number(docId),
                clienteId: selecionados[0].clienteId,
                contaBancariaId: Number(contaId),
                serieId: serieId ? Number(serieId) : undefined,
                dataHora: new Date(dataHora).toISOString(),
                observacoes: observacoes || undefined,
                referenciaPagamento: referencia.trim() || undefined,
                linhas: linhas.map(l => ({ movimentoCcId: l.p.movimentoCcId, valorPago: Number(l.valorPago) || 0, desconto: Number(l.desconto) || 0 })),
            });
            reciboId = r.id;
            gravado.resolver();
            showToast(`${r.numeroDocumento} registado — ${fmtMoney(r.total, r.moeda)} em ${r.contaCodigo}`, 'success');
            onGravado();
        } catch (e) {
            gravado.rejeitar(CANCELADO);
            setErros(extractFieldErrors(e));
            showToast(extractErrorMessage(e), 'error');
        } finally { setAGravar(false); }
    };

    return (
        <Modal titulo={`Recebimento — ${selecionados[0].clienteNome}`} onClose={onClose} footer={<>
            <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
            <SubmitButton type="button" className="abtn abtn-secondary" submitting={aGravar} loadingLabel="A gravar…" icon={<HandCoins size={12} />}
                disabled={!docId || !contaId || caixaFechada || total <= 0} onClick={() => gravar(false)}>Gravar recebimento</SubmitButton>
            <SubmitButton type="button" submitting={aGravar} loadingLabel="A gravar…" icon={<Printer size={12} />}
                disabled={!docId || !contaId || caixaFechada || total <= 0} onClick={() => gravar(true)}>Gravar e imprimir</SubmitButton>
        </>}>
            {configs.length > 0 && !recebimentos.length && (
                <div role="alert" style={{ color: 'var(--red, #dc2626)', marginBottom: 10 }}>
                    Não há nenhum documento de recebimento configurado para esta conta corrente (Configurações → Documentos de Venda).
                </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" htmlFor="rl-doc">Documento</label>
                    <select id="rl-doc" className="form-control" value={docId} onChange={e => { setDocId(e.target.value); setContaId(''); }} {...fieldAria('rl-doc-e', erros.documentoConfigId)}>
                        {recebimentos.map(d => <option key={d.id} value={d.id}>{d.codigo} — {d.descricao}</option>)}
                    </select>
                    <FieldError id="rl-doc-e" message={erros.documentoConfigId} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" htmlFor="rl-serie">Série</label>
                    <select id="rl-serie" className="form-control" value={serieId} onChange={e => setSerieId(e.target.value)} {...fieldAria('rl-serie-e', erros.serieId)}>
                        {series.map(s => <option key={s.id} value={s.id}>{s.codigo} ({s.ano})</option>)}
                    </select>
                    <FieldError id="rl-serie-e" message={erros.serieId} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" htmlFor="rl-dh">Data-hora</label>
                    <input id="rl-dh" className="form-control" type="datetime-local" value={dataHora} onChange={e => setDataHora(e.target.value)} {...fieldAria('rl-dh-e', erros.dataHora)} />
                    <FieldError id="rl-dh-e" message={erros.dataHora} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" htmlFor="rl-conta">Conta de destino</label>
                    <select id="rl-conta" className="form-control" value={contaId} onChange={e => setContaId(e.target.value)} {...fieldAria('rl-conta-e', erros.contaBancariaId)}>
                        {contasMc.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.descricao}{c.tipo === 'CAIXA' && !c.aberta ? ' (fechada)' : ''}</option>)}
                    </select>
                    <FieldError id="rl-conta-e" message={erros.contaBancariaId ?? (caixaFechada ? `A caixa ${conta?.codigo} está fechada. Abra a caixa antes de registar recebimentos em numerário.` : undefined)} />
                </div>
            </div>

            <table className="data-table">
                <thead><tr>
                    <th>Documento</th><th>OT</th><th>Vencimento</th><th style={num}>Pendente</th>
                    <th style={{ ...num, width: 140 }}>A pagar</th><th style={{ ...num, width: 120 }}>Desconto</th><th>Modo pag.</th>
                </tr></thead>
                <tbody>{linhas.map((l, i) => {
                    const e = erros[`linhas.${i}.valorPago`] ?? erros[`linhas.${i}.movimentoCcId`];
                    return (
                        <tr key={l.p.movimentoCcId}>
                            <td style={{ ...mono, fontWeight: 700 }}>{l.p.numeroDocumento ?? `#${l.p.movimentoCcId}`}</td>
                            <td style={mono}>{l.p.otNumero ?? '—'}</td>
                            <td style={{ fontSize: '0.78rem' }}>{l.p.dataVencimento}</td>
                            <td style={num}>{fmtMoney(l.p.valorPendente, 'AOA')}</td>
                            <td>
                                <input className="form-control" type="number" min={0} step="0.01" style={num} value={l.valorPago}
                                    aria-label={`A pagar de ${l.p.numeroDocumento}`} {...fieldAria(`rl-l${i}`, e)}
                                    onChange={ev => set(i, { valorPago: Number(ev.target.value) })} />
                                <FieldError id={`rl-l${i}`} message={e} />
                            </td>
                            <td><input className="form-control" type="number" min={0} step="0.01" style={num} value={l.desconto}
                                aria-label={`Desconto de ${l.p.numeroDocumento}`} onChange={ev => set(i, { desconto: Number(ev.target.value) })} /></td>
                            <td style={{ fontSize: '0.78rem' }}>{l.p.modoPagamentoDescricao ?? '—'}</td>
                        </tr>
                    );
                })}</tbody>
            </table>
            <FieldError id="rl-linhas" message={erros.linhas} />

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 12 }}>
                <div className="form-group" style={{ margin: 0, flex: '0 1 200px' }}>
                    <label className="form-label" htmlFor="rl-ref">Referência do pagamento</label>
                    <input id="rl-ref" className="form-control" maxLength={50} placeholder="N.º cheque / transferência"
                        value={referencia} onChange={e => setReferencia(e.target.value)} {...fieldAria('rl-ref-e', erros.referenciaPagamento)} />
                    <FieldError id="rl-ref-e" message={erros.referenciaPagamento} />
                </div>
                <div className="form-group" style={{ margin: 0, flex: '1 1 300px' }}>
                    <label className="form-label" htmlFor="rl-obs">Observações</label>
                    <textarea id="rl-obs" className="form-control" rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} />
                </div>
                <div style={{ marginLeft: 'auto', width: 260, display: 'grid', gap: 4 }}>
                    {desconto > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}><span>Desconto</span><span style={num}>{fmtMoney(desconto, 'AOA')}</span></div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}><span>A receber</span><span style={num}>{fmtMoney(total, 'AOA')}</span></div>
                    <div style={muted}>O desconto abate o pendente mas não entra na conta. Pagamento parcial reduz o pendente e mantém o documento em aberto.</div>
                </div>
            </div>
        </Modal>
    );
};

/* ══ Separador ═════════════════════════════════════════════════ */
const PendentesTab: React.FC<{ podeReceber: boolean; onAbrirDocumento: (id: number) => void; onMudou: () => void }> = ({ podeReceber, onAbrirDocumento, onMudou }) => {
    const { clientes, fmtMoney } = useGlobal();
    const [sp, setSp] = useSearchParams();
    const filtros = useMemo(() => filtrosDeUrl(sp), [sp]);
    const [texto, setTexto] = useState({ documento: filtros.documento ?? '', ot: filtros.ot ?? '' });
    const [dados, setDados] = useState<PendentesResposta | null>(null);
    const [selecionados, setSelecionados] = useState<Pendente[]>([]);
    const [resumo, setResumo] = useState(false);

    const aplicar = useCallback((patch: PendentesFiltros) => {
        // Qualquer mudança de filtro volta à 1.ª página.
        setSp(prev => filtrosParaUrl({ ...filtrosDeUrl(prev), pagina: undefined, ...patch }, prev), { replace: true });
    }, [setSp]);

    // Texto (n.º documento / OT) aplicado com um pequeno atraso, para não pedir a cada tecla.
    useEffect(() => {
        const t = setTimeout(() => {
            if (texto.documento !== (filtros.documento ?? '') || texto.ot !== (filtros.ot ?? '')) {
                aplicar({ documento: texto.documento || undefined, ot: texto.ot || undefined });
            }
        }, 350);
        return () => clearTimeout(t);
    }, [texto, filtros.documento, filtros.ot, aplicar]);

    const carregar = useCallback(async () => {
        try { setDados(await tesourariaApi.pendentes({ ...filtros, porPagina: POR_PAGINA })); }
        catch (e) { showToast(extractErrorMessage(e), 'error'); }
    }, [filtros]);
    useEffect(() => { carregar(); }, [carregar]);

    const opcoesCliente = useMemo(() => clientes.map(c => ({ value: c.id, label: c.nome, sub: c.nif ? `NIF ${c.nif}` : undefined })), [clientes]);
    const pagina = filtros.pagina ?? 1;
    const totalPaginas = dados ? Math.max(1, Math.ceil(dados.totais.documentos / POR_PAGINA)) : 1;
    const temFiltros = ['documento', 'ot', 'clienteId', 'de', 'ate', 'vencidosAte'].some(k => sp.has(k));
    const selecionado = (p: Pendente) => selecionados.some(s => s.movimentoCcId === p.movimentoCcId);

    const alternar = (p: Pendente) => {
        if (selecionado(p)) { setSelecionados(s => s.filter(x => x.movimentoCcId !== p.movimentoCcId)); return; }
        const motivo = podeSelecionar(selecionados, p);
        if (motivo) { showToast(motivo, 'warning'); return; }
        setSelecionados(s => [...s, p]);
    };

    return (
        <>
            <div className="filters-bar" style={{ flexWrap: 'wrap', gap: 8 }}>
                <input className="search-input" style={{ width: 150 }} placeholder="N.º documento" aria-label="N.º de documento"
                    value={texto.documento} onChange={e => setTexto(t => ({ ...t, documento: e.target.value }))} />
                <input className="search-input" style={{ width: 130 }} placeholder="N.º OT" aria-label="N.º de OT"
                    value={texto.ot} onChange={e => setTexto(t => ({ ...t, ot: e.target.value }))} />
                <div style={{ minWidth: 220 }}>
                    <SearchableSelect options={[{ value: '', label: 'Todos os clientes' }, ...opcoesCliente]} value={filtros.clienteId ? String(filtros.clienteId) : ''}
                        placeholder="Cliente (nome ou NIF)" onChange={v => aplicar({ clienteId: v ? Number(v) : undefined })} />
                </div>
                <select className="filter-select" aria-label="Tipo de data" value={filtros.dataTipo ?? 'documento'} onChange={e => aplicar({ dataTipo: e.target.value as 'documento' | 'vencimento' })}>
                    <option value="documento">Data do documento</option>
                    <option value="vencimento">Data de vencimento</option>
                </select>
                <input className="filter-select" type="date" aria-label="De" value={filtros.de ?? ''} onChange={e => aplicar({ de: e.target.value || undefined })} />
                <input className="filter-select" type="date" aria-label="Até" value={filtros.ate ?? ''} onChange={e => aplicar({ ate: e.target.value || undefined })} />
                <label style={{ ...muted, display: 'flex', alignItems: 'center', gap: 4 }}>Só vencidos até
                    <input className="filter-select" type="date" value={filtros.vencidosAte ?? ''} onChange={e => aplicar({ vencidosAte: e.target.value || undefined })} />
                </label>
                <select className="filter-select" aria-label="Ordenar por" value={`${filtros.ordem ?? 'dataDocumento'}:${filtros.direcao ?? 'asc'}`}
                    onChange={e => { const [ordem, direcao] = e.target.value.split(':'); aplicar({ ordem: ordem as PendentesFiltros['ordem'], direcao: direcao as 'asc' | 'desc' }); }}>
                    <option value="dataDocumento:asc">Mais antigos primeiro</option>
                    <option value="dataDocumento:desc">Mais recentes primeiro</option>
                    <option value="dataVencimento:asc">Vencimento</option>
                    <option value="valorPendente:desc">Maior pendente</option>
                    <option value="cliente:asc">Cliente</option>
                </select>
                {temFiltros && (
                    <button className="abtn abtn-secondary" type="button" onClick={() => {
                        setTexto({ documento: '', ot: '' });
                        aplicar({ documento: undefined, ot: undefined, clienteId: undefined, de: undefined, ate: undefined, vencidosAte: undefined });
                    }}><Filter size={12} /> Limpar</button>
                )}
            </div>

            {dados && (
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: '0.8rem', margin: '4px 0 10px' }}>
                    <span><strong>{dados.totais.documentos}</strong> documento(s)</span>
                    <span>Original: <strong>{fmtMoney(dados.totais.valorOriginal, 'AOA')}</strong></span>
                    <span>Pendente: <strong style={{ color: '#E65100' }}>{fmtMoney(dados.totais.valorPendente, 'AOA')}</strong></span>
                    <span>Vencido: <strong style={{ color: 'var(--red, #dc2626)' }}>{fmtMoney(dados.totais.vencido, 'AOA')}</strong></span>
                    {podeReceber && selecionados.length > 0 && (
                        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={muted}>{selecionados.length} selecionado(s) · {selecionados[0].clienteNome}</span>
                            <button type="button" className="abtn abtn-secondary" onClick={() => setSelecionados([])}>Limpar selecção</button>
                            <button type="button" className="abtn abtn-primary" onClick={() => setResumo(true)}><HandCoins size={12} /> Receber</button>
                        </span>
                    )}
                </div>
            )}
            {!podeReceber && <div style={{ ...muted, marginBottom: 8 }}><Lock size={11} /> Consulta apenas — só administradores, coordenadores e vendedores registam recebimentos.</div>}

            <div className="table-container">
                <div className="table-scroll">
                    <table className="data-table">
                        <thead><tr>
                            {podeReceber && <th style={{ width: 28 }} aria-label="Selecionar" />}
                            <th>Documento</th><th>OT</th><th>Cliente</th><th>Data</th><th>Vencimento</th>
                            <th style={num}>Original</th><th style={num}>Pendente</th><th>Modo pag.</th>
                        </tr></thead>
                        <tbody>
                            {!dados && <tr><td colSpan={9} style={muted}>A carregar…</td></tr>}
                            {dados?.items.length === 0 && (
                                <tr><td colSpan={9}><EmptyState icon={<Wallet size={28} />} title="Sem pendentes" description={temFiltros ? 'Nenhum pendente corresponde aos filtros.' : 'As faturas emitidas a crédito aparecem aqui até serem liquidadas.'} /></td></tr>
                            )}
                            {dados?.items.map(p => (
                                <tr key={p.movimentoCcId} style={{ background: selecionado(p) ? 'var(--blue-light, #EFF6FF)' : undefined }}>
                                    {podeReceber && <td><input type="checkbox" checked={selecionado(p)} aria-label={`Selecionar ${p.numeroDocumento}`} onChange={() => alternar(p)} /></td>}
                                    <td>{p.documentoVendaId
                                        ? <button type="button" className="td-link" style={{ ...mono, fontWeight: 700, color: 'var(--blue)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }} onClick={() => onAbrirDocumento(p.documentoVendaId!)}>{p.numeroDocumento}</button>
                                        : <span style={mono}>#{p.movimentoCcId}</span>}</td>
                                    <td style={mono}>{p.otNumero ?? '—'}</td>
                                    <td><div style={{ fontWeight: 600 }}>{p.clienteNome}</div>{p.clienteNif && <div style={muted}>NIF {p.clienteNif}</div>}</td>
                                    <td style={{ fontSize: '0.78rem' }}>{p.dataDocumento}</td>
                                    <td style={{ fontSize: '0.78rem', color: p.diasAtraso > 0 ? 'var(--red, #dc2626)' : undefined, fontWeight: p.diasAtraso > 0 ? 700 : 400 }}>
                                        {p.dataVencimento}{p.diasAtraso > 0 && <div style={{ fontSize: '0.68rem' }}>{p.diasAtraso} dia(s) em atraso</div>}
                                    </td>
                                    <td style={num}>{fmtMoney(p.valorOriginal, 'AOA')}</td>
                                    <td style={{ ...num, fontWeight: 700 }}>{fmtMoney(p.valorPendente, 'AOA')}</td>
                                    <td style={{ fontSize: '0.78rem' }}>{p.modoPagamentoDescricao ?? '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="table-count" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    Página {pagina} de {totalPaginas}
                    <button type="button" className="icon-btn" aria-label="Página anterior" disabled={pagina <= 1}
                        onClick={() => setSp(prev => filtrosParaUrl({ ...filtrosDeUrl(prev), pagina: pagina - 1 }, prev))}><ChevronLeft size={13} /></button>
                    <button type="button" className="icon-btn" aria-label="Página seguinte" disabled={pagina >= totalPaginas}
                        onClick={() => setSp(prev => filtrosParaUrl({ ...filtrosDeUrl(prev), pagina: pagina + 1 }, prev))}><ChevronRight size={13} /></button>
                </div>
            </div>

            {resumo && (
                <ResumoLiquidacao selecionados={selecionados} onClose={() => setResumo(false)}
                    onGravado={() => { setResumo(false); setSelecionados([]); carregar(); onMudou(); }} />
            )}
        </>
    );
};

export default PendentesTab;
