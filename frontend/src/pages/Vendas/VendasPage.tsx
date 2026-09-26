import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, BookOpen, FileText, Filter, HandCoins, Lock, Printer, Receipt, Search, Send, Trash2, Wallet, Wrench } from 'lucide-react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import EmptyState from '../../components/EmptyState';
import SubmitButton from '../../components/SubmitButton';
import FieldError, { fieldAria } from '../../components/FieldError';
import { useConfirm } from '../../components/useConfirm';
import { useGlobal } from '../../contexts/GlobalContext';
import { extractErrorMessage, extractFieldErrors, showToast } from '../../utils/errorHandler';
import {
    vendasApi, calcularTotais, paraDataHoraLocal, PERFIS_FATURACAO,
    type DocumentoVenda, type EstadoFaturacao, type OtDisponivel,
} from '../../services/vendas';
import { vendasConfigApi, type DocumentoConfig } from '../../services/vendasConfig';
import { adiado, CANCELADO, Modal, mono, muted, num } from './ui';
import { buildFaturaHtml, imprimirDocumento } from './impressao';
import PendentesTab from './PendentesTab';
import RecebimentosTab from './RecebimentosTab';
import ExtratoTab from './ExtratoTab';

/**
 * #165 — Vendas de Intervenções, fase 2 (v11 §4, §5.1).
 * Fatura-se exclusivamente OTs finalizadas: a lista de OTs disponíveis, o
 * rascunho (só consumíveis — a mão de obra é custo interno) e a emissão da FT,
 * que gera o pendente na conta corrente do cliente. Emitido = imutável.
 */

type Tab = 'ots' | 'semValor' | 'documentos' | 'pendentes' | 'recebimentos' | 'extrato';
const TABS_VALIDOS: Tab[] = ['ots', 'semValor', 'documentos', 'pendentes', 'recebimentos', 'extrato'];


const ESTADO_BADGE: Record<EstadoFaturacao | 'Rascunho', { bg: string; color: string }> = {
    'Rascunho':          { bg: '#ECEFF1', color: '#546E7A' },
    'Não faturada':      { bg: '#ECEFF1', color: '#546E7A' },
    'Pendente':          { bg: '#FFF3E0', color: '#E65100' },
    'Parcialmente paga': { bg: '#EFF6FF', color: '#1565C0' },
    'Paga':              { bg: '#E8F5E9', color: '#2E7D32' },
};

const EstadoBadge: React.FC<{ estado: EstadoFaturacao | 'Rascunho' }> = ({ estado }) => {
    const b = ESTADO_BADGE[estado];
    return <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 10, fontWeight: 700, background: b.bg, color: b.color, whiteSpace: 'nowrap' }}>{estado}</span>;
};

/** Documentos que podem nascer de uma OT: faturas (FT) a receber, activas, sem liquidação automática (FR é a fase 5). */
const eFaturaDeOt = (d: DocumentoConfig) =>
    d.ativo && d.tipoCodigo === 'FINANCEIRO' && d.natureza === 'A_RECEBER'
    && ['FT', 'FR'].includes(d.tipoFiscal ?? '') && !d.liquidacaoAutomatica;

const Totais: React.FC<{ t: { subtotal: number; desconto: number; valorIva: number; total: number }; moeda: string; extra?: React.ReactNode }> = ({ t, moeda, extra }) => {
    const { fmtMoney } = useGlobal();
    const linha = (label: string, v: number, forte = false) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, fontWeight: forte ? 800 : 500, fontSize: forte ? '0.95rem' : '0.8rem' }}>
            <span>{label}</span><span style={num}>{fmtMoney(v, moeda)}</span>
        </div>
    );
    return (
        <div style={{ marginLeft: 'auto', width: 280, display: 'grid', gap: 4, marginTop: 12 }}>
            {linha('Subtotal', t.subtotal)}
            {t.desconto > 0 && linha('Desconto global', -t.desconto)}
            {linha('IVA', t.valorIva)}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 4 }}>{linha('Total', t.total, true)}</div>
            {extra}
        </div>
    );
};

/* ══ Editor de rascunho + emissão ══════════════════════════════ */
interface LinhaEdit { otArtigoId: number; incluida: boolean; descricao: string; quantidade: number; maximo: number; precoUnitario: number; desconto: number; taxaIva: number }

const EditorRascunho: React.FC<{ id: number; configs: DocumentoConfig[]; podeFaturar: boolean; onClose: () => void; onMudou: () => void }> = ({ id, configs, podeFaturar, onClose, onMudou }) => {
    const { modosPagamento, fmtMoney } = useGlobal();
    const confirm = useConfirm();
    const [doc, setDoc] = useState<DocumentoVenda | null>(null);
    const [linhas, setLinhas] = useState<LinhaEdit[]>([]);
    const [observacoes, setObservacoes] = useState('');
    const [modoPagamentoId, setModoPagamentoId] = useState<string>('');
    const [requisicao, setRequisicao] = useState('');
    const [descontoGlobal, setDescontoGlobal] = useState(0);
    const [erros, setErros] = useState<Record<string, string>>({});
    const [aGravar, setAGravar] = useState(false);
    const [emitir, setEmitir] = useState(false);
    const [serieId, setSerieId] = useState<string>('');
    const [dataHora, setDataHora] = useState(paraDataHoraLocal(new Date()));

    const carregar = useCallback(async () => {
        try {
            const d = await vendasApi.documento(id);
            setDoc(d);
            const atuais = new Map((d.linhas ?? []).map(l => [l.otArtigoId, l]));
            setLinhas((d.consumiveis ?? []).map(c => {
                const l = atuais.get(c.otArtigoId);
                return {
                    otArtigoId: c.otArtigoId, incluida: !!l, descricao: l?.descricao ?? c.descricao,
                    quantidade: l?.quantidade ?? c.qtdConsumida, maximo: c.qtdConsumida,
                    precoUnitario: l?.precoUnitario ?? c.precoUnitario, desconto: l?.desconto ?? 0, taxaIva: l?.taxaIva ?? c.taxaIva,
                };
            }));
            setObservacoes(d.observacoes ?? '');
            setModoPagamentoId(d.modoPagamentoId ? String(d.modoPagamentoId) : '');
            setRequisicao(d.requisicao ?? '');
            setDescontoGlobal(d.descontoGlobal);
        } catch (e) {
            showToast(extractErrorMessage(e), 'error');
            onClose();
        }
    }, [id, onClose]);
    useEffect(() => { carregar(); }, [carregar]);

    const config = configs.find(c => c.id === doc?.documentoConfigId);
    const series = (config?.series ?? []).filter(s => s.ativo);
    useEffect(() => {
        if (!serieId && series.length) setSerieId(String((series.find(s => s.porDefeito) ?? series[0]).id));
    }, [series, serieId]);

    const incluidas = linhas.filter(l => l.incluida);
    const totais = useMemo(() => calcularTotais(incluidas, descontoGlobal), [incluidas, descontoGlobal]);
    const set = (otArtigoId: number, patch: Partial<LinhaEdit>) =>
        setLinhas(ls => ls.map(l => (l.otArtigoId === otArtigoId ? { ...l, ...patch } : l)));

    /** Erros do servidor vêm por índice das linhas enviadas (`linhas.N.campo`). */
    const errosPorLinha = (fe: Record<string, string>) => {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(fe)) {
            const m = /^linhas\.(\d+)\.(\w+)$/.exec(k);
            if (m && incluidas[Number(m[1])]) out[`${incluidas[Number(m[1])].otArtigoId}.${m[2]}`] = v;
            else out[k] = v;
        }
        return out;
    };

    const gravar = async (): Promise<boolean> => {
        if (!incluidas.length) { setErros({ linhas: 'O documento tem de ter pelo menos uma linha' }); return false; }
        setAGravar(true); setErros({});
        try {
            const d = await vendasApi.atualizarRascunho(id, {
                observacoes: observacoes || null,
                modoPagamentoId: modoPagamentoId ? Number(modoPagamentoId) : null,
                requisicao: requisicao.trim() || null,
                descontoGlobal: Number(descontoGlobal) || 0,
                linhas: incluidas.map(l => ({ otArtigoId: l.otArtigoId, descricao: l.descricao, quantidade: Number(l.quantidade), desconto: Number(l.desconto) || 0 })),
            });
            setDoc(d);
            onMudou();
            return true;
        } catch (e) {
            setErros(errosPorLinha(extractFieldErrors(e)));
            showToast(extractErrorMessage(e), 'error');
            return false;
        } finally { setAGravar(false); }
    };

    const confirmarEmissao = async (comImpressao = false) => {
        // #178 — a janela de impressão abre já (ligada ao clique) e só é preenchida depois da emissão.
        const emissao = adiado();
        if (comImpressao) {
            imprimirDocumento(async () => { await emissao.promise; return buildFaturaHtml(await vendasApi.imprimir(id)); })
                .catch(e => { if (e !== CANCELADO) showToast(extractErrorMessage(e), 'error'); });
        }
        if (!(await gravar())) { emissao.rejeitar(CANCELADO); return; }
        setAGravar(true);
        try {
            const d = await vendasApi.emitir(id, { serieId: serieId ? Number(serieId) : undefined, dataHora: new Date(dataHora).toISOString() });
            emissao.resolver();
            showToast(`${d.numeroDocumento} emitida — pendente de ${fmtMoney(d.valorPendente ?? d.total, d.moeda)} na conta corrente`, 'success');
            onMudou();
            onClose();
        } catch (e) {
            emissao.rejeitar(CANCELADO);
            setErros(errosPorLinha(extractFieldErrors(e)));
            showToast(extractErrorMessage(e), 'error');
        } finally { setAGravar(false); }
    };

    const eliminar = async () => {
        if (!await confirm({ title: 'Eliminar rascunho?', message: 'O rascunho é descartado; a OT continua disponível para faturar.', confirmLabel: 'Eliminar', variant: 'danger' })) return;
        try { await vendasApi.eliminarRascunho(id); showToast('Rascunho eliminado', 'success'); onMudou(); onClose(); }
        catch (e) { showToast(extractErrorMessage(e), 'error'); }
    };

    if (!doc) return <Modal titulo="Rascunho" onClose={onClose} footer={null}><div style={muted}>A carregar…</div></Modal>;
    const ro = !podeFaturar;

    return (
        <Modal
            titulo={`Rascunho ${doc.documentoCodigo} · ${doc.otNumero ?? `OT ${doc.otId}`}`}
            onClose={onClose}
            footer={<>
                {podeFaturar && <button type="button" className="abtn abtn-secondary" style={{ marginRight: 'auto', color: 'var(--red, #dc2626)' }} onClick={eliminar}><Trash2 size={12} /> Eliminar rascunho</button>}
                <button type="button" className="abtn abtn-secondary" onClick={onClose}>Fechar</button>
                {podeFaturar && !emitir && <>
                    <SubmitButton type="button" className="abtn abtn-secondary" submitting={aGravar} onClick={async () => { if (await gravar()) showToast('Rascunho guardado', 'success'); }}>Guardar</SubmitButton>
                    <button type="button" className="abtn abtn-primary" onClick={() => setEmitir(true)} disabled={!incluidas.length}><Send size={12} /> Emitir…</button>
                </>}
                {podeFaturar && emitir && <>
                    <SubmitButton type="button" className="abtn abtn-secondary" submitting={aGravar} loadingLabel="A emitir…" onClick={() => confirmarEmissao(false)} icon={<Send size={12} />}>Confirmar emissão</SubmitButton>
                    <SubmitButton type="button" submitting={aGravar} loadingLabel="A emitir…" onClick={() => confirmarEmissao(true)} icon={<Printer size={12} />}>Emitir e imprimir</SubmitButton>
                </>}
            </>}
        >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
                <div><div style={muted}>Cliente</div><div style={{ fontWeight: 700 }}>{doc.clienteNome}</div>{doc.clienteNif && <div style={muted}>NIF {doc.clienteNif}</div>}</div>
                <div><div style={muted}>Referência</div><div>{doc.referencia ?? '—'}</div></div>
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" htmlFor="vd-req">Requisição do cliente</label>
                    <input id="vd-req" className="form-control" maxLength={50} value={requisicao} disabled={ro}
                        placeholder="N.º de requisição/encomenda" onChange={e => setRequisicao(e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" htmlFor="vd-modo">Modo de pagamento</label>
                    <select id="vd-modo" className="form-control" value={modoPagamentoId} disabled={ro} onChange={e => setModoPagamentoId(e.target.value)}>
                        <option value="">—</option>
                        {modosPagamento.map(m => <option key={m.id} value={m.id}>{m.descricao}</option>)}
                    </select>
                </div>
            </div>

            <div style={{ ...muted, marginBottom: 6 }}>
                Só consumíveis da OT, à quantidade consumida e ao preço registado no consumo. A mão de obra é custo interno e não é faturada.
            </div>
            <div className="table-scroll">
                <table className="data-table">
                    <thead><tr>
                        <th style={{ width: 28 }} aria-label="Incluir" />
                        <th>Descrição</th>
                        <th style={{ ...num, width: 110 }}>Qtd.</th>
                        <th style={num}>Preço</th>
                        <th style={{ ...num, width: 90 }}>Desc. %</th>
                        <th style={num}>IVA</th>
                        <th style={num}>Total líquido</th>
                    </tr></thead>
                    <tbody>
                        {linhas.map((l, i) => {
                            const eQtd = erros[`${l.otArtigoId}.quantidade`];
                            const eArt = erros[`${l.otArtigoId}.otArtigoId`];
                            const liquido = l.incluida ? totais.linhas[incluidas.indexOf(l)] : 0;
                            return (
                                <tr key={l.otArtigoId} style={{ opacity: l.incluida ? 1 : 0.5 }}>
                                    <td><input type="checkbox" checked={l.incluida} disabled={ro} aria-label={`Incluir ${l.descricao}`} onChange={e => set(l.otArtigoId, { incluida: e.target.checked })} /></td>
                                    <td>
                                        <input className="form-control" value={l.descricao} disabled={ro || !l.incluida} maxLength={300} aria-label={`Descrição da linha ${i + 1}`}
                                            onChange={e => set(l.otArtigoId, { descricao: e.target.value })} />
                                        <FieldError id={`vd-art-${l.otArtigoId}`} message={eArt} />
                                    </td>
                                    <td>
                                        <input className="form-control" type="number" min={0.001} step="any" max={l.maximo} style={num} value={l.quantidade}
                                            disabled={ro || !l.incluida} aria-label={`Quantidade da linha ${i + 1}`} {...fieldAria(`vd-qtd-${l.otArtigoId}`, eQtd)}
                                            onChange={e => set(l.otArtigoId, { quantidade: Number(e.target.value) })} />
                                        <div style={muted}>consumido: {l.maximo}</div>
                                        <FieldError id={`vd-qtd-${l.otArtigoId}`} message={eQtd} />
                                    </td>
                                    <td style={num}>{fmtMoney(l.precoUnitario, doc.moeda)}</td>
                                    <td><input className="form-control" type="number" min={0} max={100} step="any" style={num} value={l.desconto}
                                        disabled={ro || !l.incluida} aria-label={`Desconto da linha ${i + 1}`}
                                        onChange={e => set(l.otArtigoId, { desconto: Number(e.target.value) })} /></td>
                                    <td style={num}>{l.taxaIva}%</td>
                                    <td style={{ ...num, fontWeight: 600 }}>{l.incluida ? fmtMoney(liquido, doc.moeda) : '—'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <FieldError id="vd-linhas" message={erros.linhas} />

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ flex: '1 1 320px', display: 'grid', gap: 10, marginTop: 12 }}>
                    <div className="form-group" style={{ margin: 0, maxWidth: 160 }}>
                        <label className="form-label" htmlFor="vd-dg">Desconto global %</label>
                        <input id="vd-dg" className="form-control" type="number" min={0} max={100} step="any" value={descontoGlobal} disabled={ro}
                            onChange={e => setDescontoGlobal(Number(e.target.value))} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" htmlFor="vd-obs">Observações</label>
                        <textarea id="vd-obs" className="form-control" rows={2} value={observacoes} disabled={ro} onChange={e => setObservacoes(e.target.value)} />
                    </div>
                </div>
                <Totais t={totais} moeda={doc.moeda} />
            </div>

            {emitir && (
                <div style={{ marginTop: 14, padding: 12, border: '1px solid #BFDBFE', background: '#EFF6FF', borderRadius: 6 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Emitir {config?.descricao ?? doc.documentoCodigo}</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ margin: 0, minWidth: 180 }}>
                            <label className="form-label" htmlFor="vd-serie">Série</label>
                            <select id="vd-serie" className="form-control" value={serieId} onChange={e => setSerieId(e.target.value)} {...fieldAria('vd-serie-err', erros.serieId)}>
                                {series.map(s => <option key={s.id} value={s.id}>{s.codigo} ({s.ano}){s.ultimoNumero ? ` · último n.º ${s.ultimoNumero}` : ''}</option>)}
                            </select>
                            <FieldError id="vd-serie-err" message={erros.serieId} />
                        </div>
                        <div className="form-group" style={{ margin: 0, minWidth: 220 }}>
                            <label className="form-label" htmlFor="vd-dh">Data-hora do documento</label>
                            <input id="vd-dh" className="form-control" type="datetime-local" value={dataHora} onChange={e => setDataHora(e.target.value)} {...fieldAria('vd-dh-err', erros.dataHora)} />
                            <FieldError id="vd-dh-err" message={erros.dataHora} />
                        </div>
                    </div>
                    <div style={{ ...muted, marginTop: 8 }}>
                        <Lock size={10} /> Depois de emitido o documento não pode ser alterado nem eliminado — só estornado. Gera um pendente de {fmtMoney(totais.total, doc.moeda)} na conta corrente do cliente.
                    </div>
                </div>
            )}
        </Modal>
    );
};

/** #178 — imprime a fatura emitida (a 1.ª impressão é o Original, as seguintes Segunda via). */
const imprimirFatura = (id: number) =>
    imprimirDocumento(async () => buildFaturaHtml(await vendasApi.imprimir(id)))
        .catch(e => showToast(extractErrorMessage(e), 'error'));

/* ══ Documento emitido (só leitura) ═══════════════════════════ */
const DocumentoDetalhe: React.FC<{ id: number; onClose: () => void }> = ({ id, onClose }) => {
    const { fmtMoney, fmtDate } = useGlobal();
    const [doc, setDoc] = useState<DocumentoVenda | null>(null);
    useEffect(() => {
        vendasApi.documento(id).then(setDoc).catch(e => { showToast(extractErrorMessage(e), 'error'); onClose(); });
    }, [id, onClose]);
    if (!doc) return <Modal titulo="Documento" onClose={onClose} footer={null}><div style={muted}>A carregar…</div></Modal>;
    return (
        <Modal titulo={`${doc.documentoDescricao} ${doc.numeroDocumento ?? ''}`} onClose={onClose}
            footer={<>
                <button type="button" className="abtn abtn-secondary" onClick={onClose}>Fechar</button>
                <button type="button" className="abtn abtn-primary" onClick={() => imprimirFatura(id)}><Printer size={12} /> Imprimir</button>
            </>}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
                <div><div style={muted}>Cliente</div><div style={{ fontWeight: 700 }}>{doc.clienteNome}</div>{doc.clienteNif && <div style={muted}>NIF {doc.clienteNif}</div>}</div>
                <div><div style={muted}>Referência</div><div>{doc.referencia ?? '—'}</div></div>
                <div><div style={muted}>Data-hora</div><div>{doc.dataHora ? new Date(doc.dataHora).toLocaleString('pt-PT') : '—'}</div></div>
                <div><div style={muted}>Vencimento</div><div>{fmtDate(doc.dataVencimento ?? undefined)}</div></div>
                <div><div style={muted}>Modo de pagamento</div><div>{doc.modoPagamentoDescricao ?? '—'}</div></div>
                <div><div style={muted}>Estado</div>{doc.estadoFaturacao && <EstadoBadge estado={doc.estadoFaturacao} />}</div>
            </div>
            <table className="data-table">
                <thead><tr><th>Descrição</th><th style={num}>Qtd.</th><th style={num}>Preço</th><th style={num}>Desc. %</th><th style={num}>IVA</th><th style={num}>Total líquido</th></tr></thead>
                <tbody>{(doc.linhas ?? []).map(l => (
                    <tr key={l.id}>
                        <td>{l.descricao}</td><td style={num}>{l.quantidade}</td><td style={num}>{fmtMoney(l.precoUnitario, doc.moeda)}</td>
                        <td style={num}>{l.desconto || '—'}</td><td style={num}>{l.taxaIva}%</td><td style={{ ...num, fontWeight: 600 }}>{fmtMoney(l.totalLiquido, doc.moeda)}</td>
                    </tr>
                ))}</tbody>
            </table>
            <Totais t={doc} moeda={doc.moeda} extra={doc.valorPendente !== null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#E65100', fontWeight: 700 }}>
                    <span>Pendente</span><span style={num}>{fmtMoney(doc.valorPendente, doc.moeda)}</span>
                </div>
            )} />
            {doc.observacoes && <div style={{ ...muted, marginTop: 12 }}>Observações: {doc.observacoes}</div>}
        </Modal>
    );
};

/* ══ Página ════════════════════════════════════════════════════ */
const VendasPage: React.FC = () => {
    const { currentUser, fmtMoney, fmtDate, empresaConfig } = useGlobal();
    const podeFaturar = PERFIS_FATURACAO.includes(currentUser?.role ?? '');

    // O separador fica no URL (?tab=…), tal como os filtros dos pendentes (#174).
    const [sp, setSp] = useSearchParams();
    const tab: Tab = TABS_VALIDOS.includes(sp.get('tab') as Tab) ? (sp.get('tab') as Tab) : 'ots';
    const setTab = (t: Tab) => setSp(prev => { const n = new URLSearchParams(prev); n.set('tab', t); return n; });
    /** Incrementada quando um recebimento muda a conta corrente, para os outros separadores recarregarem. */
    const [versao, setVersao] = useState(0);
    const [ots, setOts] = useState<OtDisponivel[] | null>(null);
    const [semValor, setSemValor] = useState<OtDisponivel[] | null>(null);
    const [docs, setDocs] = useState<DocumentoVenda[] | null>(null);
    const [configs, setConfigs] = useState<DocumentoConfig[]>([]);
    const [documentoConfigId, setDocumentoConfigId] = useState<string>('');
    const [erro, setErro] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('');
    const [aCriar, setACriar] = useState<number | null>(null);
    const [editor, setEditor] = useState<number | null>(null);
    const [detalhe, setDetalhe] = useState<number | null>(null);
    const fecharEditor = useCallback(() => setEditor(null), []);
    const fecharDetalhe = useCallback(() => setDetalhe(null), []);

    const carregar = useCallback(async () => {
        try {
            const [o, s, d, c] = await Promise.all([
                vendasApi.otsDisponiveis(), vendasApi.otsDisponiveis(true), vendasApi.documentos(), vendasConfigApi.documentos(),
            ]);
            setOts(o); setSemValor(s); setDocs(d); setConfigs(c); setErro(null);
        } catch (e) { setErro(extractErrorMessage(e)); }
    }, []);
    useEffect(() => { carregar(); }, [carregar]);

    const faturas = useMemo(() => configs.filter(eFaturaDeOt), [configs]);
    useEffect(() => {
        if (!documentoConfigId && faturas.length) setDocumentoConfigId(String((faturas.find(f => f.tipoFiscal === 'FT') ?? faturas[0]).id));
    }, [faturas, documentoConfigId]);

    const faturar = async (ot: OtDisponivel) => {
        if (ot.rascunhoId) { setEditor(ot.rascunhoId); return; }
        if (!documentoConfigId) { showToast('Não há nenhum documento de fatura configurado (Configurações → Documentos de Venda)', 'error'); return; }
        setACriar(ot.id);
        try {
            const r = await vendasApi.criarRascunho(ot.id, Number(documentoConfigId));
            await carregar();
            setEditor(r.id);
        } catch (e) { showToast(extractErrorMessage(e), 'error'); }
        finally { setACriar(null); }
    };

    const q = search.trim().toLowerCase();
    const filtraOt = (o: OtDisponivel) => !q || [o.numero, o.clienteNome, o.nrSerie, o.descricao].some(v => (v ?? '').toLowerCase().includes(q));
    const estadoDoc = (d: DocumentoVenda): EstadoFaturacao | 'Rascunho' => (d.estado === 'RASCUNHO' ? 'Rascunho' : d.estadoFaturacao ?? 'Pendente');
    const docsFiltrados = (docs ?? []).filter(d =>
        (!q || [d.numeroDocumento, d.clienteNome, d.otNumero].some(v => (v ?? '').toLowerCase().includes(q)))
        && (!filtroEstado || estadoDoc(d) === filtroEstado));

    const moeda = empresaConfig.moeda;
    const emitidos = (docs ?? []).filter(d => d.estado === 'EMITIDO');
    const stats = [
        { label: 'OTs a faturar', value: ots?.length ?? '—', cls: (ots?.length ?? 0) > 0 ? 'orange' : 'muted' },
        { label: 'Valor a faturar (s/ IVA)', value: fmtMoney((ots ?? []).reduce((s, o) => s + Number(o.valorSemIva), 0), moeda), cls: 'blue' },
        { label: 'Rascunhos', value: (docs ?? []).filter(d => d.estado === 'RASCUNHO').length, cls: 'muted' },
        { label: 'Pendente em conta corrente', value: fmtMoney(emitidos.reduce((s, d) => s + Number(d.valorPendente ?? 0), 0), moeda), cls: 'orange' },
    ];

    const TABS: { id: Tab; label: string; icon: typeof FileText; n?: number }[] = [
        { id: 'ots', label: 'OTs a faturar', icon: Wrench, n: ots?.length },
        { id: 'semValor', label: 'Sem valor a faturar', icon: AlertCircle, n: semValor?.length },
        { id: 'documentos', label: 'Documentos', icon: Receipt, n: docs?.length },
        { id: 'pendentes', label: 'Pendentes', icon: Wallet },
        { id: 'recebimentos', label: 'Recebimentos', icon: HandCoins },
        { id: 'extrato', label: 'Extrato', icon: BookOpen },
    ];
    const tabVendas = tab === 'ots' || tab === 'semValor' || tab === 'documentos';

    const tabelaOts = (lista: OtDisponivel[] | null, comAcao: boolean) => (
        <div className="table-container">
            <div className="table-scroll">
                <table className="data-table">
                    <thead><tr>
                        <th>OT</th><th>Cliente</th><th>N/S Equip.</th><th>Natureza</th><th>Finalizada</th>
                        {comAcao && <><th style={num}>Consumíveis</th><th style={num}>Valor s/ IVA</th><th style={{ width: 150 }} /></>}
                    </tr></thead>
                    <tbody>
                        {lista === null && <tr><td colSpan={8} style={muted}>A carregar…</td></tr>}
                        {lista?.filter(filtraOt).length === 0 && (
                            <tr><td colSpan={8}>{comAcao
                                ? <EmptyState icon={<Wrench size={28} />} title="Nenhuma OT por faturar" description="As OTs finalizadas com consumíveis aparecem aqui até serem faturadas." />
                                : <EmptyState icon={<Wrench size={28} />} title="Nenhuma OT sem valor" description="OTs finalizadas sem consumíveis (ex.: inspecções) — não têm nada a faturar, porque a mão de obra não é faturada." />}
                            </td></tr>
                        )}
                        {lista?.filter(filtraOt).map(o => (
                            <tr key={o.id}>
                                <td style={{ ...mono, fontWeight: 700 }}>{o.numero ?? `#${o.id}`}</td>
                                <td style={{ fontWeight: 600 }}>{o.clienteNome ?? '—'}</td>
                                <td style={{ ...mono, color: 'var(--text-muted)' }}>{o.nrSerie ?? '—'}</td>
                                <td style={{ fontSize: '0.78rem' }}>{o.naturezaIntervencao ?? '—'}</td>
                                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fmtDate(o.dataFim ?? undefined)}</td>
                                {comAcao && <>
                                    <td style={num}>{o.linhas}</td>
                                    <td style={{ ...num, fontWeight: 700 }}>{fmtMoney(Number(o.valorSemIva), moeda)}</td>
                                    <td>{podeFaturar && (
                                        <SubmitButton type="button" className={`abtn ${o.rascunhoId ? 'abtn-secondary' : 'abtn-primary'}`} submitting={aCriar === o.id} loadingLabel="A preparar…" onClick={() => faturar(o)}>
                                            <Receipt size={12} /> {o.rascunhoId ? 'Continuar rascunho' : 'Faturar'}
                                        </SubmitButton>
                                    )}</td>
                                </>}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <AppLayout>
            <ActionBar title="Vendas" breadcrumb="AQUATEX SGI · Comercial · Vendas">
                <div className="actionbar-spacer" />
                {tab === 'ots' && faturas.length > 1 && (
                    <select className="filter-select" aria-label="Documento a emitir" value={documentoConfigId} onChange={e => setDocumentoConfigId(e.target.value)}>
                        {faturas.map(f => <option key={f.id} value={f.id}>{f.codigo} — {f.descricao}</option>)}
                    </select>
                )}
            </ActionBar>

            <div className="page-content">
                {erro && <div role="alert" style={{ color: 'var(--red, #dc2626)', marginBottom: 12 }}><AlertCircle size={13} /> Não foi possível carregar: {erro}</div>}
                {!podeFaturar && <div style={{ ...muted, marginBottom: 10 }}><Lock size={11} /> Consulta apenas — só administradores, coordenadores e vendedores podem faturar.</div>}

                <div className="stats-row">
                    {stats.map(s => (
                        <div key={s.label} className="stat-card">
                            <span className="stat-label">{s.label}</span>
                            <span className={`stat-value ${s.cls}`}>{s.value}</span>
                        </div>
                    ))}
                </div>

                <div role="tablist" aria-label="Vendas" style={{ display: 'flex', gap: 2, marginBottom: 12, background: 'var(--panel-header-bg)', border: '1px solid var(--panel-border)', borderRadius: 5, padding: 4, width: 'fit-content', maxWidth: '100%', overflowX: 'auto' }}>
                    {TABS.map(t => (
                        <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 4, border: 'none',
                            background: tab === t.id ? '#fff' : 'none', boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                            fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: tab === t.id ? 700 : 600,
                            color: tab === t.id ? 'var(--blue)' : 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap',
                        }}>
                            <t.icon size={13} /> {t.label}{t.n !== undefined && <span style={muted}>({t.n})</span>}
                        </button>
                    ))}
                </div>

                {tabVendas && <div className="filters-bar">
                    <div className="search-wrap">
                        <Search className="search-icon" />
                        <input className="search-input" placeholder={tab === 'documentos' ? 'Pesquisar documento, cliente, OT…' : 'Pesquisar OT, cliente, N/S…'}
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    {tab === 'documentos' && (
                        <select className="filter-select" aria-label="Estado" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
                            <option value="">Todos os estados</option>
                            {(['Rascunho', 'Pendente', 'Parcialmente paga', 'Paga'] as const).map(e => <option key={e} value={e}>{e}</option>)}
                        </select>
                    )}
                    {(search || filtroEstado) && (
                        <button className="abtn abtn-secondary" type="button" onClick={() => { setSearch(''); setFiltroEstado(''); }}><Filter size={12} /> Limpar</button>
                    )}
                </div>}

                {tab === 'pendentes' && (
                    <PendentesTab podeReceber={podeFaturar} onAbrirDocumento={setDetalhe}
                        onMudou={() => { setVersao(v => v + 1); carregar(); }} />
                )}
                {tab === 'recebimentos' && <RecebimentosTab versao={versao} />}
                {tab === 'extrato' && <ExtratoTab versao={versao} />}

                {tab === 'ots' && tabelaOts(ots, true)}
                {tab === 'semValor' && tabelaOts(semValor, false)}
                {tab === 'documentos' && (
                    <div className="table-container">
                        <div className="table-scroll">
                            <table className="data-table">
                                <thead><tr>
                                    <th>Documento</th><th>OT</th><th>Cliente</th><th>Data</th>
                                    <th style={num}>Total</th><th style={num}>Pendente</th><th>Estado</th>
                                </tr></thead>
                                <tbody>
                                    {docs === null && <tr><td colSpan={7} style={muted}>A carregar…</td></tr>}
                                    {docs && docsFiltrados.length === 0 && (
                                        <tr><td colSpan={7}><EmptyState icon={<Receipt size={28} />} title="Nenhum documento" description="Os rascunhos e as faturas emitidas a partir das OTs aparecem aqui." /></td></tr>
                                    )}
                                    {docsFiltrados.map(d => (
                                        <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => (d.estado === 'RASCUNHO' ? setEditor(d.id) : setDetalhe(d.id))}>
                                            <td style={{ ...mono, fontWeight: 700, color: 'var(--blue)' }}>{d.numeroDocumento ?? `${d.documentoCodigo} · rascunho #${d.id}`}</td>
                                            <td style={mono}>{d.otNumero ?? `#${d.otId}`}</td>
                                            <td style={{ fontWeight: 600 }}>{d.clienteNome}</td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{d.dataHora ? new Date(d.dataHora).toLocaleDateString('pt-PT') : '—'}</td>
                                            <td style={{ ...num, fontWeight: 700 }}>{fmtMoney(d.total, d.moeda)}</td>
                                            <td style={num}>{d.valorPendente !== null ? fmtMoney(d.valorPendente, d.moeda) : '—'}</td>
                                            <td><EstadoBadge estado={estadoDoc(d)} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="table-count">{docsFiltrados.length} documento(s)</div>
                    </div>
                )}
            </div>

            {editor !== null && <EditorRascunho id={editor} configs={configs} podeFaturar={podeFaturar} onClose={fecharEditor} onMudou={carregar} />}
            {detalhe !== null && <DocumentoDetalhe id={detalhe} onClose={fecharDetalhe} />}
        </AppLayout>
    );
};

export default VendasPage;
