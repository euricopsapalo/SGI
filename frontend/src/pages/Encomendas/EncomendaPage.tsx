import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom';
import AppLayout from '../../components/Layout/AppLayout';
import { showToast as notify } from '../../utils/errorHandler';
import ActionBar from '../../components/Layout/ActionBar';
import { useGlobal, Encomenda, EncomendaLinha, FaturaFornecedor } from '../../contexts/GlobalContext';
import { useConfirm } from '../../components/useConfirm';
import EmptyState from '../../components/EmptyState';
import TableSkeleton from '../../components/TableSkeleton';
import {
    Search,
    Plus,
    X,
    Check,
    ShoppingCart,
    Package,
    Printer,
    Archive,
    Download,
    TrendingDown,
    ShoppingBag,
    RotateCcw,
    Eye,
    BarChart2,
    Clock,
    AlertTriangle,
    CheckCircle2,
    CalendarDays,
    ListFilter,
    FileText,
    CreditCard,
    Wallet,
} from 'lucide-react';
import ExportModal, { ExportCol } from '../../components/ExportModal';
import { imprimirPdf } from '../../utils/imprimirPdf';
import { buildRelatorioComprasHtml } from './relatorioComprasHtml';
import { encTotal, ESTADO_STYLE } from './encomendas.utils';
import { ReceberModal } from './ReceberModal';
import { buildNotaEncomendaHtml, printNotaEncomenda, printNotaEntrada, buildFaturaFornecedorHtml, buildVNCHtml, printDocFornecedor, buildSugestoesHtml, printSugestoes } from './encomendasImpressao';
import { EncomendaModal } from './EncomendaModal';
import { ConvertFaturaModal } from './ConvertFaturaModal';
import { VNCEstadoBadge } from './VNCEstadoBadge';
import { CompraDiretaModal } from './CompraDiretaModal';
import { ConverterItem, ConverterModal } from './ConverterModal';

const COLS_ENC: ExportCol[] = [
    { key: 'numero',         label: 'Nº Encomenda' },
    { key: 'fornecedorNome', label: 'Fornecedor' },
    { key: 'data',           label: 'Data' },
    { key: 'dataEntrega',    label: 'Data Entrega' },
    { key: 'responsavel',    label: 'Responsável' },
    { key: 'estado',         label: 'Estado' },
    { key: 'total',          label: 'Total' },
];

/* ══ Page ════════════════════════════════════════════════════ */
const EncomendaPage: React.FC = () => {
    const { encomendas, addEncomenda, updateEncomenda, criarRececao, anularRececao, fornecedores, artigos: todosArtigos, taxasIva, updateArtigo, currentUser, empresaConfig, fmtMoney, fmtDate, fmt, simboloMoeda, faturasFornecedor, addFaturaFornecedor, updateFaturaFornecedor, updateEstadoVNC, condicoesPagamento, modosPagamento, loadingData } = useGlobal();
    const confirm = useConfirm();

    const [pageTab,   setPageTab]   = useState<'encomendas' | 'sugestoes' | 'compras' | 'relatorios'>('encomendas');
    const [search,    setSearch]    = useState('');
    const [filterEst, setFEst]      = useState('');
    const [modal,     setModal]     = useState<'new' | string | null>(null);
    const [receber,   setReceber]   = useState<string | null>(null);
    const [rececDropdown, setRececDropdown] = useState<string | null>(null);
    const [rececDropdownPos, setRececDropdownPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
    const [previewHtml, setPreviewHtml] = useState('');

    // Close dropdown when clicking outside
    useEffect(() => {
        if (!rececDropdown) return;
        const handler = () => setRececDropdown(null);
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [rececDropdown]);
    const [showExport, setShowExport] = useState(false);

    // Sugestões de Compra state
    const [sugSearch,     setSugSearch]   = useState('');
    const [sugClasse,     setSugClasse]   = useState('');
    const [sugFamilia,    setSugFamilia]  = useState('');
    const [sugCritico,    setSugCritico]  = useState(false);
    const [showConverter,    setShowConverter]    = useState(false);
    const [convertFatId,    setConvertFatId]     = useState<string | null>(null);
    const [showCompraDireta, setShowCompraDireta] = useState(false);
    const [pagarModalId,    setPagarModalId]     = useState<string | null>(null);
    const [pagarData,       setPagarData]        = useState('');
    const [pagarModoId,     setPagarModoId]      = useState('');
    const [pagarRef,        setPagarRef]         = useState('');

    const artigosRuptura = useMemo(() =>
        todosArtigos.filter(a => a.emRuptura && !a.inativo),
        [todosArtigos]
    );

    const classesDisponiveis  = useMemo(() => Array.from(new Set(artigosRuptura.map(a => a.classe).filter(Boolean))).sort(), [artigosRuptura]);
    const familiasDisponiveis = useMemo(() => Array.from(new Set(artigosRuptura.map(a => a.familia).filter(Boolean))).sort(), [artigosRuptura]);

    const artigosRupturaFiltrados = useMemo(() => artigosRuptura.filter(a => {
        const q = sugSearch.toLowerCase();
        return (!q || a.codigo.toLowerCase().includes(q) || a.descricao.toLowerCase().includes(q))
            && (!sugClasse   || a.classe   === sugClasse)
            && (!sugFamilia  || a.familia  === sugFamilia)
            && (!sugCritico  || a.critico);
    }), [artigosRuptura, sugSearch, sugClasse, sugFamilia, sugCritico]);

    const showToast = (msg: string) => notify(msg, 'success');

    const getFornNome = (id: string) => fornecedores.find(f => f.id === id)?.nome ?? id;

    const filtered = encomendas.filter(e => {
        const q = search.toLowerCase();
        const matchQ = !q || e.numero.toLowerCase().includes(q) || e.descricao.toLowerCase().includes(q) || getFornNome(e.fornecedorId).toLowerCase().includes(q);
        const matchE = !filterEst || e.estado === filterEst;
        return matchQ && matchE;
    });

    const exportData = filtered.map(e => ({
        ...e,
        fornecedorNome: getFornNome(e.fornecedorId),
        data: fmtDate(e.data),
        dataEntrega: fmtDate(e.dataEntrega),
        total: Math.round(encTotal(e)),
    }));

    // Stats
    const abertas   = encomendas.filter(e => e.estado === 'Aberta').length;
    const parciais  = encomendas.filter(e => e.estado === 'Parcial').length;
    const recebidas = encomendas.filter(e => e.estado === 'Recebida').length;
    const valorAberto = encomendas.filter(e => e.estado !== 'Cancelada' && e.estado !== 'Recebida').reduce((s, e) => s + encTotal(e), 0);

    // ── Reports data ─────────────────────────────────────────
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    const weekAgo  = new Date(today); weekAgo.setDate(today.getDate() - 6);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    const encEmAberto = encomendas.filter(e => e.estado === 'Aberta' || e.estado === 'Aprovada' || e.estado === 'Parcial');
    const encEmAtraso = encomendas.filter(e =>
        (e.estado === 'Aberta' || e.estado === 'Aprovada' || e.estado === 'Parcial') &&
        e.dataEntrega && e.dataEntrega < todayStr
    );
    const encHoje   = encomendas.filter(e => e.data === todayStr);
    const encSemana = encomendas.filter(e => e.data >= weekAgoStr && e.data <= todayStr);

    // By-status for chart
    const statusCounts: Record<string, number> = {
        Aberta:    encomendas.filter(e => e.estado === 'Aberta').length,
        Aprovada:  encomendas.filter(e => e.estado === 'Aprovada').length,
        Parcial:   encomendas.filter(e => e.estado === 'Parcial').length,
        Recebida:  encomendas.filter(e => e.estado === 'Recebida').length,
        Cancelada: encomendas.filter(e => e.estado === 'Cancelada').length,
    };

    // Last 7 days daily volume
    const dailyVolume = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today); d.setDate(today.getDate() - (6 - i));
        const ds = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit' });
        return { label, date: ds, count: encomendas.filter(e => e.data === ds).length };
    });
    const maxDaily = Math.max(...dailyVolume.map(d => d.count), 1);

    // #217 — o relatório sai em PDF do servidor (imprimirPdf, #182), com "Pág. x/y" (#180).
    const imprimirRelatorio = () => {
        const diasAtraso = (e: Encomenda) => e.dataEntrega
            ? Math.floor((today.getTime() - new Date(e.dataEntrega).getTime()) / 86400000) : 0;
        void imprimirPdf(buildRelatorioComprasHtml({
            empresa: { nome: empresaConfig?.nome ?? '', nif: empresaConfig?.nif, morada: empresaConfig?.morada },
            geradoEm: `${fmtDate(new Date().toISOString())} ${new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`,
            kpis: { emAberto: encEmAberto.length, emAtraso: encEmAtraso.length, hoje: encHoje.length, semana: encSemana.length },
            porEstado: (['Aberta', 'Aprovada', 'Parcial', 'Recebida', 'Cancelada'] as const)
                .map(est => ({ label: ESTADO_STYLE[est].label, count: statusCounts[est] ?? 0 })),
            ultimos7Dias: dailyVolume.map(d => ({ label: d.label, count: d.count })),
            emAberto: encEmAberto.map(e => {
                const totalQtd = e.linhas.reduce((s, l) => s + l.qtdEncomendada, 0);
                const recQtd   = e.linhas.reduce((s, l) => s + l.qtdRecebida, 0);
                return {
                    numero: e.numero, fornecedor: getFornNome(e.fornecedorId), data: fmtDate(e.data),
                    entrega: fmtDate(e.dataEntrega), estado: ESTADO_STYLE[e.estado].label, valor: fmtMoney(encTotal(e)),
                    pctRecebido: totalQtd > 0 ? Math.round(recQtd / totalQtd * 100) : 0,
                    atrasada: !!e.dataEntrega && e.dataEntrega < todayStr,
                };
            }),
            emAtraso: encEmAtraso.slice()
                .sort((a, b) => (a.dataEntrega ?? '').localeCompare(b.dataEntrega ?? ''))
                .map(e => ({
                    numero: e.numero, fornecedor: getFornNome(e.fornecedorId), entrega: fmtDate(e.dataEntrega),
                    diasAtraso: diasAtraso(e), estado: ESTADO_STYLE[e.estado].label, valor: fmtMoney(encTotal(e)),
                })),
        }));
    };

    const editTarget  = typeof modal === 'string' && modal !== 'new' ? encomendas.find(e => e.id === modal) : undefined;
    const receberEnc  = receber ? encomendas.find(e => e.id === receber) : null;

    // #212 — só fecha e confirma depois de o servidor aceitar; o erro sobe para o modal.
    const handleSave = async (data: Omit<Encomenda, 'id' | 'numero'>) => {
        if (typeof modal === 'string' && modal !== 'new') {
            await updateEncomenda(modal, data);
            showToast('Encomenda actualizada.');
        } else {
            const numero = `N-${String(encomendas.length + 1).padStart(6, '0')}`;
            const e = await addEncomenda({ ...data, numero });
            showToast(`Encomenda ${e.numero} criada.`);
        }
        setModal(null);
    };

    const handleReceber = async (encId: string, recebidas: { artigoId: string; qtd: number }[], armazem: string, guiaRemessa: string) => {
        try {
            const updatedEnc = await criarRececao(encId, recebidas, guiaRemessa, currentUser?.nome ?? 'Operador', armazem);
            // #213 — o movimento de entrada é registado pelo servidor, na transação da receção.
            for (const r of recebidas) {
                await updateArtigo(r.artigoId, { codigoArmazem: armazem });
            }
            // Find the newly created rececao (most recent Ativa)
            const newRececao = [...updatedEnc.rececoes]
                .filter(r => r.estado === 'Ativa')
                .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime())[0];
            if (newRececao) printNotaEntrada(newRececao, updatedEnc, empresaConfig, simboloMoeda);
            showToast(`Recepção registada → ${armazem}. Stock actualizado.`);
        } catch { /* erro já apresentado pelo interceptor global (api.ts) */ }
    };

    const handleAnularRececao = async (rececaoId: string) => {
        if (!(await confirm({
            title: 'Anular receção',
            message: 'Anular esta receção irá reverter o stock e os acumulados. Confirmar?',
            confirmLabel: 'Anular',
            variant: 'danger',
        }))) return;
        try {
            await anularRececao(rececaoId);
            showToast('Receção anulada. Stock revertido.');
        } catch { /* erro já apresentado pelo interceptor global (api.ts) */ }
    };

    const handleConverterEmEncomenda = async (fornecedorId: string, dataEntrega: string, descricao: string, items: ConverterItem[]) => {
        const today = new Date().toISOString().split('T')[0];
        const numero = `N-${String(encomendas.length + 1).padStart(6, '0')}`;
        const linhas: EncomendaLinha[] = items.map(item => ({
            artigoId: item.artigoId, codigo: item.codigo, descricao: item.descricao,
            qtdEncomendada: item.qtd, qtdRecebida: 0,
            unidade: 'UN', custoUnit: item.preco, desconto: 0,
        }));
        try {
            await addEncomenda({ numero, fornecedorId, data: today, dataEntrega, condicoesPagamento: '30 Dias', responsavel: currentUser?.nome ?? '', moeda: 'AOA', descricao, estado: 'Aberta', linhas, rececoes: [] });
        } catch {
            return; // #212 — erro já mostrado pelo interceptor global (api.ts); não confirma sucesso
        }
        showToast(`Encomenda ${numero} criada com ${linhas.length} artigo(s).`);
        setPageTab('encomendas');
    };

    const convertFatEncomenda = encomendas.find(e => e.id === convertFatId) ?? null;

    const handleConvertToFatura = async (encId: string, data: Parameters<typeof addFaturaFornecedor>[0] extends { fornecedorId: string } ? any : any) => {
        const enc = encomendas.find(e => e.id === encId);
        if (!enc) return;
        try {
            await addFaturaFornecedor({
                ...data,
                fornecedorId: enc.fornecedorId,
                idEncomenda: encId,
                linhas: data.linhas.map((l: any) => ({
                    ...l,
                    produtoId: l.artigoId,
                    descricaoCustomizada: l.descricaoCustomizada || l.descricao || '',
                })),
            });
            updateEncomenda(encId, { estado: 'Faturada' });
            showToast(`Fatura criada. Encomenda ${enc.numero} marcada como Faturada.`);
        } catch { /* erro já apresentado pelo interceptor global (api.ts) */ }
    };

    const handleVNCTransition = async (id: string, novoEstado: string) => {
        const fatura = faturasFornecedor.find(f => f.id === id);
        if (!fatura) return;
        if (novoEstado === 'Validado' && fatura.tipoNotaCredito === 'Devolucao') {
            if (!(await confirm({
                title: 'Validar nota de crédito',
                message: 'Validar esta VNC irá reduzir o stock dos artigos. Confirma?',
                confirmLabel: 'Validar',
                variant: 'info',
            }))) return;
        }
        try {
            await updateEstadoVNC(id, novoEstado, currentUser?.nome);
            showToast(novoEstado === 'Validado'
                ? 'VNC validada. Stock e movimentos actualizados.'
                : `Estado actualizado para: ${novoEstado}`);
        } catch (e: any) {
            showToast(e?.response?.data?.message ?? 'Erro ao actualizar estado.');
        }
    };

    const openPagarModal = (id: string) => {
        setPagarModalId(id);
        setPagarData(new Date().toISOString().split('T')[0]);
        setPagarModoId('');
        setPagarRef('');
    };

    const handleConfirmarPagamento = async () => {
        if (!pagarModalId) return;
        try {
            await updateFaturaFornecedor(pagarModalId, {
                estadoPagamento: 'Paga',
                dataPagamento: pagarData || new Date().toISOString().split('T')[0],
                referenciaPagamento: pagarRef || null,
                modoPagamentoId: pagarModoId || undefined,
            });
            showToast('Pagamento registado com sucesso.');
        } catch { /* erro já apresentado pelo interceptor global (api.ts) */ }
        setPagarModalId(null);
    };

    const handleCompraDireta = async (f: Omit<FaturaFornecedor, 'id'> & { faturasAssociadasIds?: string[] }) => {
        try {
            await addFaturaFornecedor(f);
            const isVNC = f.tipoDocumento === 'VNC';
            showToast(isVNC
                ? 'VNC criada em estado Rascunho. Sem impacto em stock até validação.'
                : 'Compra direta registada. Stock actualizado.');
        } catch { /* erro já apresentado pelo interceptor global (api.ts) */ }
    };

    return (
        <AppLayout>
            <ActionBar title="Compra" breadcrumb="AQUATEX SGI · Compra">
                <div className="actionbar-spacer" />
                {pageTab === 'encomendas' && (
                    <button className="abtn abtn-secondary" type="button" onClick={() => setShowExport(true)}>
                        <Download size={13} /> Exportar
                    </button>
                )}
                {pageTab === 'sugestoes' && artigosRupturaFiltrados.length > 0 && (<>
                    <button className="abtn abtn-secondary" type="button" onClick={() => setPreviewHtml(buildSugestoesHtml(artigosRupturaFiltrados, empresaConfig, simboloMoeda))} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Eye size={13} /> Pré-visualizar
                    </button>
                    <button className="abtn abtn-secondary" type="button" onClick={() => printSugestoes(artigosRupturaFiltrados, empresaConfig, simboloMoeda)}>
                        <Printer size={13} /> Imprimir Lista
                    </button>
                    <button className="abtn abtn-primary" type="button" onClick={() => setShowConverter(true)}>
                        <ShoppingBag size={13} /> Converter em Encomenda
                    </button>
                </>)}
                {pageTab === 'encomendas' && (
                    <button className="abtn abtn-primary" type="button" onClick={() => setModal('new')}>
                        <Plus size={13} /> Nova Encomenda
                    </button>
                )}
                {pageTab === 'compras' && (
                    <button className="abtn abtn-primary" type="button" onClick={() => setShowCompraDireta(true)}>
                        <Plus size={13} /> Nova Compra Direta
                    </button>
                )}
                {pageTab === 'relatorios' && (
                    <button className="abtn abtn-secondary" type="button"
                        onClick={imprimirRelatorio}
                        style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Printer size={13} /> Imprimir
                    </button>
                )}
            </ActionBar>

            <div className="page-content">
                {/* Page-level tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
                    {([
                        { id: 'encomendas', label: 'Encomendas' },
                        { id: 'sugestoes',  label: `Sugestões de Encomenda${artigosRuptura.length > 0 ? ` (${artigosRuptura.length})` : ''}` },
                        { id: 'compras',    label: `Compras${faturasFornecedor.length > 0 ? ` (${faturasFornecedor.length})` : ''}` },
                        { id: 'relatorios', label: 'Relatórios' },
                    ] as const).map(t => (
                        <button key={t.id} type="button" onClick={() => setPageTab(t.id)} style={{
                            padding: '8px 16px', fontSize: '0.82rem', fontWeight: pageTab === t.id ? 700 : 400,
                            border: 'none', borderBottom: pageTab === t.id ? '2px solid var(--blue)' : '2px solid transparent',
                            background: 'none', cursor: 'pointer', marginBottom: -1,
                            color: pageTab === t.id ? 'var(--blue)' : 'var(--text-secondary)',
                        }}>
                            {t.id === 'sugestoes' && artigosRuptura.length > 0 && (
                                <TrendingDown size={12} style={{ marginRight: 4, color: '#dc2626', verticalAlign: 'middle' }} />
                            )}
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* ── Encomendas Tab ── */}
                {pageTab === 'encomendas' && (<>
                {/* Stats */}
                <div className="stats-row">
                    {[
                        { label: 'Em Aberto',         value: abertas,           cls: 'blue' },
                        { label: 'Parcialmente Rec.',  value: parciais,          cls: 'orange' },
                        { label: 'Recebidas',          value: recebidas,         cls: 'green' },
                        { label: 'Valor em Aberto',    value: fmtMoney(valorAberto), cls: 'blue' },
                    ].map(s => (
                        <div key={s.label} className="stat-card">
                            <span className="stat-label">{s.label}</span>
                            <span className={`stat-value ${s.cls}`}>{s.value}</span>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="filters-bar">
                    <div className="search-wrap">
                        <Search className="search-icon" />
                        <input className="search-input" placeholder="Pesquisar por número, fornecedor ou descrição..."
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select className="filter-select" value={filterEst} onChange={e => setFEst(e.target.value)}>
                        <option value="">Todos os estados</option>
                        <option value="Aberta">Aberta</option>
                        <option value="Aprovada">Aprovada</option>
                        <option value="Parcial">Parcial</option>
                        <option value="Recebida">Recebida</option>
                        <option value="Cancelada">Cancelada</option>
                    </select>
                </div>

                {/* Table */}
                <div className="table-container">
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 20 }} />
                                    <th>Nº Encomenda</th>
                                    <th>Fornecedor</th>
                                    <th>Data</th>
                                    <th>Data Entrega</th>
                                    <th>Responsável</th>
                                    <th style={{ textAlign: 'right' }}>Total</th>
                                    <th>Estado</th>
                                    <th style={{ width: 130 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {loadingData && <TableSkeleton cols={9} />}
                                {!loadingData && filtered.length === 0 && (
                                    <tr><td colSpan={9}><EmptyState icon={<ShoppingCart size={28} />} title="Nenhuma encomenda encontrada" description="Crie encomendas a fornecedores para repor stock e registar receções." /></td></tr>
                                )}
                                {!loadingData && filtered.map(e => {
                                    const vencida = e.dataEntrega && e.estado === 'Aberta' && new Date(e.dataEntrega) < new Date();
                                    return (
                                        <tr key={e.id} style={{ opacity: e.estado === 'Cancelada' ? 0.5 : 1 }}>
                                            <td style={{ paddingLeft: 10 }}>
                                                <span className={`dot ${e.estado === 'Recebida' ? 'dot-green' : e.estado === 'Parcial' ? 'dot-orange' : e.estado === 'Cancelada' ? 'dot-gray' : vencida ? 'dot-red' : 'dot-blue'}`} />
                                            </td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 600, color: 'var(--blue)' }}>
                                                {e.numero}
                                            </td>
                                            <td style={{ fontWeight: 600, fontSize: '0.83rem' }}>{getFornNome(e.fornecedorId)}</td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fmtDate(e.data)}</td>
                                            <td style={{ fontSize: '0.78rem', color: vencida ? 'var(--red,#ef4444)' : 'var(--text-muted)', fontWeight: vencida ? 600 : 400 }}>
                                                {fmtDate(e.dataEntrega)}
                                                {vencida && ' ⚠'}
                                            </td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{e.responsavel || '—'}</td>
                                            <td style={{ textAlign: 'right', fontSize: '0.78rem', fontWeight: 600 }}>
                                                {fmtMoney(Math.round(encTotal(e)), e.moeda)}
                                            </td>
                                            <td>
                                                <span className={ESTADO_STYLE[e.estado].cls}>{ESTADO_STYLE[e.estado].label}</span>
                                            </td>
                                            <td>
                                                <div className="row-actions" style={{ gap: 4 }}>
                                                    {e.estado === 'Aberta' && (
                                                        <button className="icon-btn" title="Editar" onClick={() => setModal(e.id)}>
                                                            <Package size={12} />
                                                        </button>
                                                    )}
                                                    {e.estado === 'Aberta' && (
                                                        <button className="abtn abtn-ghost" title="Aprovar encomenda"
                                                            style={{ fontSize: '0.72rem', padding: '2px 8px', height: 24, color: '#15803d' }}
                                                            onClick={() => updateEncomenda(e.id, { estado: 'Aprovada' })}>
                                                            <CheckCircle2 size={11} /> Aprovar
                                                        </button>
                                                    )}
                                                    {(e.estado === 'Aprovada' || e.estado === 'Parcial') && (
                                                        <button className="abtn abtn-ghost" title="Receber" style={{ fontSize: '0.72rem', padding: '2px 8px', height: 24 }}
                                                            onClick={() => setReceber(e.id)}>
                                                            <Archive size={11} /> Receber
                                                        </button>
                                                    )}
                                                    {e.estado !== 'Aberta' && (
                                                        <button className="icon-btn" title="Pré-visualizar nota de encomenda" onClick={() => setPreviewHtml(buildNotaEncomendaHtml(e, getFornNome(e.fornecedorId), empresaConfig, simboloMoeda, todosArtigos, taxasIva))}>
                                                            <Eye size={12} />
                                                        </button>
                                                    )}
                                                    {e.estado !== 'Aberta' && (
                                                        <button className="icon-btn" title="Imprimir nota de encomenda" onClick={() => printNotaEncomenda(e, getFornNome(e.fornecedorId), empresaConfig, simboloMoeda, todosArtigos, taxasIva)}>
                                                            <Printer size={12} />
                                                        </button>
                                                    )}
                                                    {e.rececoes?.filter(r => r.estado === 'Ativa').length > 0 && (() => {
                                                        const ativas = [...e.rececoes.filter(r => r.estado === 'Ativa')]
                                                            .sort((a, b) => new Date(b.dataHora).getTime() - new Date(a.dataHora).getTime());
                                                        if (ativas.length === 1) {
                                                            return (
                                                                <button className="icon-btn" title="Reimprimir nota de entrada"
                                                                    style={{ color: '#16a34a' }}
                                                                    onClick={() => printNotaEntrada(ativas[0], e, empresaConfig, simboloMoeda)}>
                                                                    <RotateCcw size={12} />
                                                                </button>
                                                            );
                                                        }
                                                        return (
                                                            <div style={{ position: 'relative' }}>
                                                                <button className="icon-btn" title={`Reimprimir notas de entrada (${ativas.length} entregas)`}
                                                                    style={{ color: '#16a34a' }}
                                                                    onClick={ev => {
                                                                        ev.stopPropagation();
                                                                        const rect = ev.currentTarget.getBoundingClientRect();
                                                                        setRececDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
                                                                        setRececDropdown(rececDropdown === e.id ? null : e.id);
                                                                    }}>
                                                                    <RotateCcw size={12} />
                                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, marginLeft: 2 }}>{ativas.length}</span>
                                                                </button>
                                                                {rececDropdown === e.id && ReactDOM.createPortal(
                                                                    <div style={{
                                                                        position: 'fixed', top: rececDropdownPos.top, right: rececDropdownPos.right, zIndex: 9999,
                                                                        background: 'var(--surface,#fff)', border: '1px solid var(--border)',
                                                                        borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.13)',
                                                                        minWidth: 260,
                                                                    }} onClick={ev => ev.stopPropagation()}>
                                                                        {/* Header */}
                                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 8px', borderBottom: '1px solid var(--border)' }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                                <RotateCcw size={12} style={{ color: '#16a34a' }} />
                                                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>Notas de Entrada</span>
                                                                            </div>
                                                                            <span style={{ fontSize: '0.7rem', fontWeight: 600, background: '#dcfce7', color: '#15803d', borderRadius: 10, padding: '1px 8px' }}>
                                                                                {ativas.length} entrega{ativas.length !== 1 ? 's' : ''}
                                                                            </span>
                                                                        </div>
                                                                        {/* Items */}
                                                                        <div style={{ padding: '6px 0' }}>
                                                                            {ativas.map((r, idx) => (
                                                                                <button key={r.id} style={{
                                                                                    display: 'flex', alignItems: 'center', gap: 10,
                                                                                    width: '100%', padding: '8px 14px', border: 'none',
                                                                                    background: 'none', cursor: 'pointer', textAlign: 'left',
                                                                                    borderLeft: idx === 0 ? '3px solid #16a34a' : '3px solid transparent',
                                                                                }}
                                                                                    onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--bg-hover,#f5f7fa)')}
                                                                                    onMouseLeave={ev => (ev.currentTarget.style.background = 'none')}
                                                                                    onClick={() => { printNotaEntrada(r, e, empresaConfig); setRececDropdown(null); }}
                                                                                    title="Clique para reimprimir">
                                                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                                                                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem', color: '#16a34a' }}>{r.guiaRemessa}</span>
                                                                                            {idx === 0 && (
                                                                                                <span style={{ fontSize: '0.62rem', fontWeight: 600, background: '#dcfce7', color: '#15803d', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>
                                                                                                    mais recente
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                                                            {new Date(r.dataHora).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                                        </div>
                                                                                    </div>
                                                                                    <Printer size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>,
                                                                    document.body
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                    {e.rececoes?.filter(r => r.estado === 'Ativa').length > 0 && e.estado !== 'Faturada' && e.estado !== 'Cancelada' && (
                                                        <button className="abtn abtn-ghost" title="Converter em Fatura Fornecedor"
                                                            style={{ fontSize: '0.72rem', padding: '2px 8px', height: 24, color: '#7c3aed' }}
                                                            onClick={() => setConvertFatId(e.id)}>
                                                            <FileText size={11} /> Faturar
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="table-count">{filtered.length} encomendas</div>
                </div>
                </>)}

                {/* ── Sugestões de Compra Tab ── */}
                {pageTab === 'sugestoes' && (<>
                    {/* Stats */}
                    <div className="stats-row">
                        {[
                            { label: 'Artigos em Ruptura',   value: artigosRuptura.length,                                               cls: 'red' },
                            { label: 'Críticos em Ruptura',  value: artigosRuptura.filter(a => a.critico).length,                        cls: 'orange' },
                            { label: 'Valor Estimado Compra',value: fmtMoney(artigosRupturaFiltrados.reduce((s, a) => {
                                    const disp = a.stockDisponivel ?? Math.max(0, a.existencia - a.stockReservado);
                                    const def = Math.max(0, a.stockSeguranca - (disp + a.stockEncomendado));
                                    return s + def * (a.precoCusto || a.custoMedio || a.precoUnitario);
                                }, 0)),                                                                                                   cls: 'blue' },
                            { label: 'Filtrados',             value: artigosRupturaFiltrados.length,                                     cls: 'blue' },
                        ].map(s => (
                            <div key={s.label} className="stat-card">
                                <span className="stat-label">{s.label}</span>
                                <span className={`stat-value ${s.cls}`}>{s.value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="filters-bar">
                        <div className="search-wrap">
                            <Search className="search-icon" />
                            <input className="search-input" placeholder="Pesquisar por código ou descrição..."
                                value={sugSearch} onChange={e => setSugSearch(e.target.value)} />
                        </div>
                        <select className="filter-select" value={sugClasse} onChange={e => setSugClasse(e.target.value)}>
                            <option value="">Todas as classes</option>
                            {classesDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select className="filter-select" value={sugFamilia} onChange={e => setSugFamilia(e.target.value)}>
                            <option value="">Todas as famílias</option>
                            {familiasDisponiveis.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <input type="checkbox" checked={sugCritico} onChange={e => setSugCritico(e.target.checked)} />
                            Apenas críticos
                        </label>
                    </div>

                    {/* Table */}
                    <div className="table-container">
                        <div className="table-scroll">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Código</th>
                                        <th>Descrição</th>
                                        <th>Classe</th>
                                        <th style={{ textAlign: 'right' }}>Disponível</th>
                                        <th style={{ textAlign: 'right' }}>Encomendado</th>
                                        <th style={{ textAlign: 'right' }}>Stock Seg.</th>
                                        <th style={{ textAlign: 'right' }}>Défice</th>
                                        <th style={{ textAlign: 'right' }}>Preço Compra</th>
                                        <th style={{ textAlign: 'right' }}>Total Est.</th>
                                        <th>Crítico</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {artigosRupturaFiltrados.length === 0 && (
                                        <tr><td colSpan={10}>
                                            <div className="empty-state">
                                                <TrendingDown size={28} />
                                                <br />{artigosRuptura.length === 0
                                                    ? 'Nenhum artigo em ruptura de stock.'
                                                    : 'Nenhum artigo corresponde aos filtros.'}
                                            </div>
                                        </td></tr>
                                    )}
                                    {artigosRupturaFiltrados.map(a => {
                                        const disp   = a.stockDisponivel ?? Math.max(0, a.existencia - a.stockReservado);
                                        const deficit = Math.max(0, a.stockSeguranca - (disp + a.stockEncomendado));
                                        const preco  = a.precoCusto || a.custoMedio || a.precoUnitario;
                                        return (
                                            <tr key={a.id}>
                                                <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', fontWeight: 600, color: 'var(--blue)' }}>{a.codigo}</td>
                                                <td style={{ fontWeight: 600, fontSize: '0.83rem' }}>{a.descricao}</td>
                                                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{a.classe}</td>
                                                <td style={{ textAlign: 'right', fontSize: '0.8rem', color: disp === 0 ? 'var(--red,#ef4444)' : 'var(--text-secondary)', fontWeight: 600 }}>{fmt(disp)}</td>
                                                <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--blue)' }}>{fmt(a.stockEncomendado)}</td>
                                                <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{fmt(a.stockSeguranca)}</td>
                                                <td style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: '#dc2626' }}>{fmt(deficit)}</td>
                                                <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>{fmtMoney(preco, a.moeda)}</td>
                                                <td style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: 'var(--orange,#f97316)' }}>{fmtMoney(deficit * preco, a.moeda)}</td>
                                                <td>{a.critico && <span style={{ fontSize: '0.72rem', background: '#fee2e2', color: '#dc2626', borderRadius: 10, padding: '2px 8px', fontWeight: 600 }}>Crítico</span>}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="table-count">{artigosRupturaFiltrados.length} artigo(s) em ruptura</div>
                    </div>
                </>)}

                {/* ── Compras Tab ── */}
                {pageTab === 'compras' && (<>
                    <div className="stats-row">
                        {(() => {
                            const naoVNC    = faturasFornecedor.filter(f => f.tipoDocumento !== 'VNC');
                            const pendentes = naoVNC.filter(f => f.estadoPagamento === 'Pendente');
                            const vencidas  = pendentes.filter(f => f.dataVencimento && f.dataVencimento < todayStr);
                            const valorPago = naoVNC.filter(f => f.estadoPagamento === 'Paga').reduce((s, f) => s + Number(f.totalFinal), 0);
                            return [
                                { label: 'Total Faturas',  value: faturasFornecedor.length,                                          cls: 'blue' },
                                { label: 'Pendentes',       value: pendentes.length,                                                  cls: 'orange' },
                                { label: 'Vencidas',        value: vencidas.length,                                                   cls: vencidas.length > 0 ? 'red' : 'green' },
                                { label: 'Pagas',           value: naoVNC.filter(f => f.estadoPagamento === 'Paga').length,           cls: 'green' },
                                { label: 'Valor Pago',      value: fmtMoney(valorPago),                                               cls: 'green' },
                                { label: 'Valor Pendente',  value: fmtMoney(pendentes.reduce((s, f) => s + Number(f.totalFinal), 0)), cls: pendentes.length > 0 ? 'orange' : 'blue' },
                            ];
                        })().map(s => (
                            <div key={s.label} className="stat-card">
                                <span className="stat-label">{s.label}</span>
                                <span className={`stat-value ${s.cls}`}>{s.value}</span>
                            </div>
                        ))}
                    </div>
                    <div className="table-container">
                        <div className="table-scroll">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Tipo</th>
                                        <th>Nº Fatura</th>
                                        <th>Fornecedor</th>
                                        <th>Encomenda</th>
                                        <th>Data Emissão</th>
                                        <th>Vencimento</th>
                                        <th style={{ textAlign: 'right' }}>Total Líquido</th>
                                        <th style={{ textAlign: 'right' }}>IVA</th>
                                        <th style={{ textAlign: 'right' }}>Total Final</th>
                                        <th>Estado Pgto</th>
                                        <th>Estado Doc.</th>
                                        <th style={{ width: 90 }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {faturasFornecedor.length === 0 && (
                                        <tr><td colSpan={11}>
                                            <div className="empty-state">
                                                <Wallet size={28} />
                                                <br />Nenhuma fatura de fornecedor registada.
                                                <br />
                                                <button type="button" className="abtn abtn-primary" style={{ marginTop: 12 }} onClick={() => setShowCompraDireta(true)}>
                                                    <Plus size={12} /> Nova Compra Direta
                                                </button>
                                            </div>
                                        </td></tr>
                                    )}
                                    {faturasFornecedor.map(f => {
                                        const enc = encomendas.find(e => e.id === f.idEncomenda);
                                        const vencida = f.tipoDocumento !== 'VNC' && f.dataVencimento && f.dataVencimento < todayStr && f.estadoPagamento === 'Pendente';
                                        return (
                                            <tr key={f.id} style={{ background: vencida ? '#fff5f5' : undefined }}>
                                                <td>
                                                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem',
                                                        background: '#f3e8ff', color: '#7c3aed', borderRadius: 4, padding: '2px 6px' }}>
                                                        {f.tipoDocumento}
                                                    </span>
                                                </td>
                                                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 600, color: 'var(--blue)' }}>
                                                    {f.numFaturaExterno}
                                                </td>
                                                <td style={{ fontWeight: 600, fontSize: '0.83rem' }}>{getFornNome(f.fornecedorId)}</td>
                                                <td style={{ fontSize: '0.78rem', color: 'var(--blue)' }}>
                                                    {enc ? enc.numero : f.idEncomenda ? `#${f.idEncomenda}` : <span style={{ color: 'var(--text-muted)' }}>Compra direta</span>}
                                                </td>
                                                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fmtDate(f.dataEmissao)}</td>
                                                <td style={{ fontSize: '0.78rem', color: vencida ? '#dc2626' : 'var(--text-muted)', fontWeight: vencida ? 700 : 400 }}>
                                                    {f.tipoDocumento === 'VNC' ? '—' : (f.dataVencimento ? fmtDate(f.dataVencimento) : '—')}
                                                    {vencida && ' ⚠'}
                                                </td>
                                                <td style={{ textAlign: 'right', fontSize: '0.8rem' }}>{fmtMoney(f.totalLiquido, f.moeda)}</td>
                                                <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--blue)' }}>{fmtMoney(f.totalIva, f.moeda)}</td>
                                                <td style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 700 }}>{fmtMoney(f.totalFinal, f.moeda)}</td>
                                                <td>
                                                    {f.tipoDocumento === 'VNC' ? (
                                                        <span style={{ fontSize: '0.72rem', fontWeight: 600, borderRadius: 10, padding: '2px 8px', background: '#f3f4f6', color: '#6b7280' }}>
                                                            N/A
                                                        </span>
                                                    ) : (
                                                        <span style={{
                                                            fontSize: '0.72rem', fontWeight: 600, borderRadius: 10, padding: '2px 8px',
                                                            background: f.estadoPagamento === 'Paga' ? '#dcfce7' : f.estadoPagamento === 'Anulada' ? '#f3f4f6' : vencida ? '#fee2e2' : '#fefce8',
                                                            color: f.estadoPagamento === 'Paga' ? '#15803d' : f.estadoPagamento === 'Anulada' ? '#6b7280' : vencida ? '#dc2626' : '#b45309',
                                                        }}>
                                                            {f.estadoPagamento}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    {f.tipoDocumento === 'VNC' ? (
                                                        <VNCEstadoBadge
                                                            fatura={{ ...f, estadoDocumento: (f.estadoDocumento === 'NA' || !f.estadoDocumento) ? 'Rascunho' : f.estadoDocumento }}
                                                            onTransition={(est) => handleVNCTransition(f.id, est)}
                                                        />
                                                    ) : (
                                                        <span style={{ fontSize: '0.72rem', fontWeight: 600, borderRadius: 10, padding: '2px 8px', background: '#f3f4f6', color: '#6b7280' }}>
                                                            N/A
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                                                        <button className="icon-btn" title="Pré-visualizar"
                                                            onClick={() => {
                                                                const forn = fornecedores.find(x => x.id === f.fornecedorId);
                                                                const html = f.tipoDocumento === 'VNC'
                                                                    ? buildVNCHtml(f, forn, empresaConfig, simboloMoeda, todosArtigos, condicoesPagamento, modosPagamento, currentUser?.nome)
                                                                    : buildFaturaFornecedorHtml(f, forn, empresaConfig, simboloMoeda, todosArtigos, condicoesPagamento, modosPagamento, currentUser?.nome);
                                                                setPreviewHtml(html);
                                                            }}>
                                                            <Eye size={14} />
                                                        </button>
                                                        <button className="icon-btn" title="Imprimir"
                                                            onClick={() => {
                                                                const forn = fornecedores.find(x => x.id === f.fornecedorId);
                                                                const html = f.tipoDocumento === 'VNC'
                                                                    ? buildVNCHtml(f, forn, empresaConfig, simboloMoeda, todosArtigos, condicoesPagamento, modosPagamento, currentUser?.nome)
                                                                    : buildFaturaFornecedorHtml(f, forn, empresaConfig, simboloMoeda, todosArtigos, condicoesPagamento, modosPagamento, currentUser?.nome);
                                                                printDocFornecedor(html);
                                                            }}>
                                                            <Printer size={14} />
                                                        </button>
                                                        {f.tipoDocumento !== 'VNC' && f.estadoPagamento === 'Pendente' && (
                                                            <button
                                                                className="abtn abtn-success"
                                                                style={{ fontSize: '0.7rem', padding: '2px 8px', height: 26 }}
                                                                title="Marcar como Paga"
                                                                onClick={() => openPagarModal(f.id)}>
                                                                <Check size={11} /> Paga
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="table-count">{faturasFornecedor.length} fatura(s) de fornecedor</div>
                    </div>
                </>)}

                {/* ── Relatórios Tab ── */}
                {pageTab === 'relatorios' && (<>

                    {/* KPI row */}
                    <div className="stats-row">
                        {[
                            { label: 'Em Aberto',     value: encEmAberto.length,  cls: 'blue',   icon: <ShoppingCart size={16} /> },
                            { label: 'Em Atraso',     value: encEmAtraso.length,  cls: encEmAtraso.length > 0 ? 'red' : 'green', icon: <Clock size={16} /> },
                            { label: 'Hoje',          value: encHoje.length,      cls: 'blue',   icon: <CalendarDays size={16} /> },
                            { label: 'Esta Semana',   value: encSemana.length,    cls: 'blue',   icon: <BarChart2 size={16} /> },
                        ].map(s => (
                            <div key={s.label} className="stat-card">
                                <span className="stat-label">{s.label}</span>
                                <span className={`stat-value ${s.cls}`}>{s.value}</span>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

                        {/* ── Estado das Encomendas ── */}
                        <div className="settings-section" style={{ margin: 0 }}>
                            <div className="settings-section-hdr">
                                <div className="settings-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <ListFilter size={14} /> Estado das Encomendas
                                </div>
                                <div className="settings-section-desc">Visão geral por status</div>
                            </div>
                            <div className="settings-section-body">
                                {([
                                    { estado: 'Aberta',    label: 'Abertas',    color: '#3b82f6', bg: '#eff6ff' },
                                    { estado: 'Parcial',   label: 'Parciais',   color: '#f97316', bg: '#fff7ed' },
                                    { estado: 'Recebida',  label: 'Recebidas',  color: '#16a34a', bg: '#f0fdf4' },
                                    { estado: 'Cancelada', label: 'Canceladas', color: '#9ca3af', bg: '#f9fafb' },
                                ] as const).map(s => {
                                    const count = statusCounts[s.estado] ?? 0;
                                    const pct = encomendas.length > 0 ? Math.round(count / encomendas.length * 100) : 0;
                                    return (
                                        <div key={s.estado} style={{ marginBottom: 12 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: s.color }}>{s.label}</span>
                                                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                                                    {count} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({pct}%)</span>
                                                </span>
                                            </div>
                                            <div style={{ height: 8, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${pct}%`, background: s.color, borderRadius: 4, transition: 'width 0.3s' }} />
                                            </div>
                                        </div>
                                    );
                                })}
                                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Total</span>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{encomendas.length}</span>
                                </div>
                            </div>
                        </div>

                        {/* ── Volume Diário (7 dias) ── */}
                        <div className="settings-section" style={{ margin: 0 }}>
                            <div className="settings-section-hdr">
                                <div className="settings-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <BarChart2 size={14} /> Volume — Últimos 7 Dias
                                </div>
                                <div className="settings-section-desc">{encSemana.length} encomenda(s) esta semana</div>
                            </div>
                            <div className="settings-section-body">
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
                                    {dailyVolume.map(d => (
                                        <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: d.count > 0 ? 'var(--blue)' : 'var(--text-muted)' }}>
                                                {d.count > 0 ? d.count : ''}
                                            </span>
                                            <div style={{
                                                width: '100%', background: d.count > 0 ? 'var(--blue)' : 'var(--bg-secondary)',
                                                borderRadius: '4px 4px 0 0',
                                                height: d.count > 0 ? `${Math.round((d.count / maxDaily) * 88)}px` : '4px',
                                                minHeight: 4, transition: 'height 0.3s',
                                                opacity: d.date === todayStr ? 1 : 0.7,
                                            }} />
                                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.2 }}>
                                                {d.label.split(',')[0]}<br />{d.label.split(',')[1]?.trim()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Encomendas em Aberto ── */}
                    <div className="settings-section" style={{ margin: '0 0 16px' }}>
                        <div className="settings-section-hdr">
                            <div className="settings-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <ShoppingCart size={14} style={{ color: '#3b82f6' }} /> Encomendas em Aberto
                            </div>
                            <div className="settings-section-desc">Encomendas pendentes de recepção completa</div>
                        </div>
                        <div className="settings-section-body" style={{ padding: 0 }}>
                            {encEmAberto.length === 0 ? (
                                <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.83rem' }}>
                                    <CheckCircle2 size={28} style={{ margin: '0 auto 8px', display: 'block', color: '#16a34a' }} />
                                    Sem encomendas em aberto
                                </div>
                            ) : (
                                <div className="table-wrap">
                                    <table className="data-table">
                                        <thead><tr>
                                            <th>Número</th><th>Fornecedor</th><th>Data</th>
                                            <th>Entrega Prevista</th><th>Estado</th>
                                            <th style={{ textAlign: 'right' }}>Valor</th>
                                            <th style={{ textAlign: 'right' }}>% Recebido</th>
                                        </tr></thead>
                                        <tbody>
                                            {encEmAberto.map(e => {
                                                const totalQtd  = e.linhas.reduce((s, l) => s + l.qtdEncomendada, 0);
                                                const recQtd    = e.linhas.reduce((s, l) => s + l.qtdRecebida, 0);
                                                const pctRec    = totalQtd > 0 ? Math.round(recQtd / totalQtd * 100) : 0;
                                                const atrasada  = e.dataEntrega && e.dataEntrega < todayStr;
                                                const es = ESTADO_STYLE[e.estado];
                                                return (
                                                    <tr key={e.id} style={atrasada ? { background: '#fff5f5' } : {}}>
                                                        <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: 'var(--blue)' }}>{e.numero}</td>
                                                        <td style={{ fontSize: '0.83rem', fontWeight: 600 }}>{getFornNome(e.fornecedorId)}</td>
                                                        <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{fmtDate(e.data)}</td>
                                                        <td style={{ fontSize: '0.78rem', color: atrasada ? '#dc2626' : 'var(--text-secondary)', fontWeight: atrasada ? 700 : 400 }}>
                                                            {atrasada && <AlertTriangle size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                                                            {fmtDate(e.dataEntrega)}
                                                        </td>
                                                        <td><span className={es.cls}>{es.label}</span></td>
                                                        <td style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 600 }}>{fmtMoney(encTotal(e))}</td>
                                                        <td style={{ textAlign: 'right', fontSize: '0.78rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                                                                <div style={{ width: 48, height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                                                                    <div style={{ height: '100%', width: `${pctRec}%`, background: '#16a34a', borderRadius: 3 }} />
                                                                </div>
                                                                <span style={{ minWidth: 28 }}>{pctRec}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Encomendas em Atraso ── */}
                    <div className="settings-section" style={{ margin: 0 }}>
                        <div className="settings-section-hdr">
                            <div className="settings-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <AlertTriangle size={14} style={{ color: '#dc2626' }} /> Encomendas em Atraso
                            </div>
                            <div className="settings-section-desc">Pedidos que ultrapassaram o prazo previsto de entrega</div>
                        </div>
                        <div className="settings-section-body" style={{ padding: 0 }}>
                            {encEmAtraso.length === 0 ? (
                                <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.83rem' }}>
                                    <CheckCircle2 size={28} style={{ margin: '0 auto 8px', display: 'block', color: '#16a34a' }} />
                                    Nenhuma encomenda em atraso
                                </div>
                            ) : (
                                <div className="table-wrap">
                                    <table className="data-table">
                                        <thead><tr>
                                            <th>Número</th><th>Fornecedor</th><th>Entrega Prevista</th>
                                            <th style={{ textAlign: 'right' }}>Dias Atraso</th>
                                            <th>Estado</th>
                                            <th style={{ textAlign: 'right' }}>Valor</th>
                                        </tr></thead>
                                        <tbody>
                                            {encEmAtraso
                                                .slice()
                                                .sort((a, b) => (a.dataEntrega ?? '').localeCompare(b.dataEntrega ?? ''))
                                                .map(e => {
                                                    const dias = e.dataEntrega
                                                        ? Math.floor((today.getTime() - new Date(e.dataEntrega).getTime()) / 86400000)
                                                        : 0;
                                                    const es = ESTADO_STYLE[e.estado];
                                                    return (
                                                        <tr key={e.id} style={{ background: '#fff5f5' }}>
                                                            <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: '#dc2626' }}>{e.numero}</td>
                                                            <td style={{ fontSize: '0.83rem', fontWeight: 600 }}>{getFornNome(e.fornecedorId)}</td>
                                                            <td style={{ fontSize: '0.78rem', color: '#dc2626', fontWeight: 600 }}>{fmtDate(e.dataEntrega)}</td>
                                                            <td style={{ textAlign: 'right' }}>
                                                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#dc2626', background: '#fee2e2', borderRadius: 10, padding: '2px 8px' }}>
                                                                    +{dias}d
                                                                </span>
                                                            </td>
                                                            <td><span className={es.cls}>{es.label}</span></td>
                                                            <td style={{ textAlign: 'right', fontSize: '0.8rem', fontWeight: 600 }}>{fmtMoney(encTotal(e))}</td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                </>)}
            </div>

            {/* Modals */}
            {modal !== null && (
                <EncomendaModal
                    encomenda={editTarget}
                    onClose={() => setModal(null)}
                    onSave={handleSave}
                    onAnularRececao={handleAnularRececao}
                />
            )}

            {receberEnc && (
                <ReceberModal
                    encomenda={receberEnc}
                    onClose={() => setReceber(null)}
                    onConfirm={(rec, arm, guia) => handleReceber(receberEnc.id, rec, arm, guia)}
                />
            )}

            {/* PrintModal replaced by printNotaEncomenda() */}

            {showConverter && (
                <ConverterModal
                    artigos={artigosRupturaFiltrados}
                    onClose={() => setShowConverter(false)}
                    onConfirm={handleConverterEmEncomenda}
                />
            )}

            {convertFatEncomenda && (
                <ConvertFaturaModal
                    encomenda={convertFatEncomenda}
                    onClose={() => setConvertFatId(null)}
                    onConfirm={data => handleConvertToFatura(convertFatEncomenda.id, data)}
                />
            )}

            {showCompraDireta && (
                <CompraDiretaModal
                    onClose={() => setShowCompraDireta(false)}
                    onSave={handleCompraDireta}
                />
            )}

            {pagarModalId && ReactDOM.createPortal(
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#ffffff', borderRadius: 10, padding: 24, width: 400, boxShadow: '0 8px 40px rgba(0,0,0,0.32)', border: '1px solid #e5e7eb' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <CreditCard size={16} style={{ color: '#16a34a' }} /> Registar Pagamento
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                Data de Pagamento
                                <input type="date" className="form-input" value={pagarData} onChange={e => setPagarData(e.target.value)} style={{ marginTop: 4 }} />
                            </label>
                            <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                Modo de Pagamento
                                <select className="form-input" value={pagarModoId} onChange={e => setPagarModoId(e.target.value)} style={{ marginTop: 4 }}>
                                    <option value="">— Seleccionar —</option>
                                    {modosPagamento.map(m => <option key={m.id} value={m.id}>{m.descricao}</option>)}
                                </select>
                            </label>
                            <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                                Referência da Transacção
                                <input type="text" className="form-input" placeholder="Nº transferência, cheque, etc." value={pagarRef} onChange={e => setPagarRef(e.target.value)} style={{ marginTop: 4 }} />
                            </label>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
                            <button type="button" className="abtn abtn-secondary" onClick={() => setPagarModalId(null)}>Cancelar</button>
                            <button type="button" className="abtn abtn-success" onClick={handleConfirmarPagamento}>
                                <Check size={13} /> Confirmar Pagamento
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}


            {showExport && (
                <ExportModal
                    title="Encomendas"
                    columns={COLS_ENC}
                    data={exportData}
                    filename="encomendas"
                    onClose={() => setShowExport(false)}
                />
            )}

            {previewHtml && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, fontWeight: 700, fontSize: '0.85rem' }}>Pré-visualização</span>
                        <button type="button" className="abtn abtn-secondary" onClick={() => setPreviewHtml('')}>
                            <X size={13} /> Fechar
                        </button>
                    </div>
                    <iframe srcDoc={previewHtml} title="Pré-visualização" style={{ flex: 1, border: 'none', background: '#fff' }} />
                </div>
            )}
        </AppLayout>
    );
};

export default EncomendaPage;
