import React, { useState, useRef } from 'react';
import { useModalA11y } from '../../components/useModalA11y';
import AppLayout from '../../components/Layout/AppLayout';
import { showToast as notify, extractFieldErrors } from '../../utils/errorHandler';
import SubmitButton from '../../components/SubmitButton';
import ActionBar from '../../components/Layout/ActionBar';
import SearchableSelect from '../../components/SearchableSelect';
import { useGlobal, Artigo, Armazem, TipoArtigo, TIPO_ARTIGO_LABEL } from '../../contexts/GlobalContext';
import {
    Search, Plus, Edit2, X, AlertCircle, Check, Package, Download,
    BarChart2, ArrowDownCircle, ArrowUpCircle, RefreshCw,
    Truck, Archive, Star, FileText, Image as ImageIcon, Trash2,
    ChevronRight, ChevronDown, Warehouse, Eye, Printer,
} from 'lucide-react';
import ExportModal, { ExportCol } from '../../components/ExportModal';
import EmptyState from '../../components/EmptyState';
import TableSkeleton from '../../components/TableSkeleton';
import { imprimirPdf } from '../../utils/imprimirPdf';

/* ══ Helpers (fmt e fmtMoney vêm do GlobalContext) ══════════ */

const COLS_STOCK: ExportCol[] = [
    { key: 'codigo',         label: 'Código' },
    { key: 'descricao',      label: 'Descrição' },
    { key: 'tipoLabel',      label: 'Tipo' },
    { key: 'retencaoLabel',  label: 'Retenção na fonte' },
    { key: 'classe',         label: 'Classe' },
    { key: 'familia',        label: 'Família' },
    { key: 'existencia',     label: 'Existência' },
    { key: 'stockSeguranca', label: 'Stock Seg.' },
    { key: 'precoUnitario',  label: 'Preço Unit.' },
    { key: 'codigoArmazem',  label: 'Armazém' },
    { key: 'critico',        label: 'Crítico' },
];

/* ══ Artigo Modal (4 tabs) ══════════════════════════════════ */
interface ArtigoModalProps {
    artigo?: Artigo;
    onClose: () => void;
    onSave: (a: Omit<Artigo, 'id'>) => Promise<void>;
}
const TABS_A = [
    { id: 'ident', label: 'Identificação' },
    { id: 'preco', label: 'Preço' },
    { id: 'arm',   label: 'Armazém' },
    { id: 'obs',   label: 'Observação' },
] as const;
type ATab = typeof TABS_A[number]['id'];

const ArtigoModal: React.FC<ArtigoModalProps> = ({ artigo, onClose, onSave }) => {
    const modalRef = useModalA11y(onClose); // #223 — Esc fecha e foco no modal (#45)
    const { armazens, stockArmazem, upsertStockArmazem, removeStockArmazem, fmt, fmtMoney, taxasIva, fornecedores, classesArtigo, familiasArtigo } = useGlobal();
    const [tab, setTab] = useState<ATab>('ident');

    // Warehouse breakdown state (only for existing articles)
    const saEntries = stockArmazem.filter(sa => sa.artigoId === artigo?.id);
    const [saNewArmazem, setSaNewArmazem] = useState('');
    const [saNewQtd,     setSaNewQtd]     = useState('0');
    const [saNewMin,     setSaNewMin]     = useState('0');

    const handleAddSa = async () => {
        if (!artigo?.id || !saNewArmazem) return;
        await upsertStockArmazem(artigo.id, saNewArmazem, Number(saNewQtd), Number(saNewMin));
        setSaNewArmazem('');
        setSaNewQtd('0');
        setSaNewMin('0');
    };

    // Identificação
    const [codigo,    setCodigo]    = useState(artigo?.codigo    ?? '');
    const [descricao, setDescricao] = useState(artigo?.descricao ?? '');
    const [classe,    setClasse]    = useState(artigo?.classe    ?? '');
    const [familia,   setFamilia]   = useState(artigo?.familia   ?? '');
    const [imagem,    setImagem]    = useState(artigo?.imagem    ?? '');

    // Preço
    const [precoUnitario, setPreco] = useState(String(artigo?.precoUnitario ?? ''));
    const [moeda, setMoeda]         = useState(artigo?.moeda ?? 'AOA');

    // Armazém — stock_inicial e existencia só editáveis na criação; depois são read-only
    const isNew = !artigo;
    const [stockInicial,   setStockIn] = useState(String(artigo?.stockInicial   ?? '0'));
    const [existencia,     setExist]   = useState(String(artigo?.existencia     ?? '0'));

    // Na criação, os dois campos são sempre iguais
    const handleStockInicialChange = (v: string) => { setStockIn(v); setExist(v); };
    const [nivelMaximo,    setNMax]    = useState(String(artigo?.nivelMaximo    ?? ''));
    const [stockSeguranca, setSeg]     = useState(String(artigo?.stockSeguranca ?? ''));
    const [custoMedio,     setCusto]   = useState(String(artigo?.custoMedio     ?? ''));
    const [precoCusto,     setPrecoCusto] = useState(String(artigo?.precoCusto  ?? ''));
    const [codigoArmazem,  setArmazem] = useState(artigo?.codigoArmazem ?? 'ARM-01');
    const [inativo,        setInativo] = useState(artigo?.inativo  ?? false);
    const [critico,        setCritico] = useState(artigo?.critico  ?? false);
    // #195 — tipo e retenção na fonte (só Serviços podem estar sujeitos a retenção).
    const [tipo,            setTipo]            = useState<TipoArtigo>(artigo?.tipo ?? 'PRODUTO');
    const [sujeitoRetencao, setSujeitoRetencao] = useState(artigo?.sujeitoRetencao ?? false);
    const mudarTipo = (t: TipoArtigo) => { setTipo(t); if (t !== 'SERVICO') setSujeitoRetencao(false); };

    // Fornecedor / Unidade
    const [unidadeMedida,  setUnidade]     = useState(artigo?.unidadeMedida ?? 'UN');
    const [refFornecedor,  setRefForn]     = useState(artigo?.refFornecedor ?? '');

    // Observação
    const [observacao, setObs] = useState(artigo?.observacao ?? '');
    const [codigoIva,  setCodigoIva] = useState(artigo?.codigoIva ?? '');

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => setImagem(ev.target?.result as string ?? '');
        reader.readAsDataURL(file);
    };

    const validate = () => {
        const e: Record<string, string> = {};
        if (!codigo.trim())    e.codigo    = 'Obrigatório';
        if (!descricao.trim()) e.descricao = 'Obrigatório';
        if (isNaN(Number(precoUnitario)) || precoUnitario === '') e.preco = 'Valor inválido';
        if (!refFornecedor)    e.fornecedor = 'Obrigatório';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    // #212 — espera pelo servidor; em erro o modal fica aberto e mostra os erros de campo.
    const handleSave = async (ev: React.FormEvent) => {
        ev.preventDefault();
        if (!validate() || submitting) return;
        setSubmitting(true);
        try {
            await onSave({
            codigo, descricao, classe, familia, imagem,
            tipo, sujeitoRetencao: tipo === 'SERVICO' && sujeitoRetencao,
            precoUnitario: Number(precoUnitario), moeda,
            // stock_inicial e existencia só são enviados na criação; na edição preservam o valor da BD
            existencia: isNew ? Number(existencia) : (artigo?.existencia ?? 0),
            stockInicial: isNew ? Number(stockInicial) : (artigo?.stockInicial ?? 0),
            nivelMaximo: Number(nivelMaximo),
            stockSeguranca: Number(stockSeguranca), custoMedio: Number(custoMedio),
            precoCusto: Number(precoCusto), stockEncomendado: artigo?.stockEncomendado ?? 0,
            codigoArmazem, inativo, critico, observacao,
            stockReservado: artigo?.stockReservado ?? 0,
            codigoIva: codigoIva || undefined,
            unidadeMedida,
            refFornecedor: refFornecedor || undefined,
            dataUltimaEntrada: artigo?.dataUltimaEntrada,
            dataUltimaSaida: artigo?.dataUltimaSaida,
            });
        } catch (err) {
            const fe = extractFieldErrors(err);
            if (fe.precoUnitario) fe.preco = fe.precoUnitario;
            if (fe.refFornecedor) fe.fornecedor = fe.refFornecedor;
            if (Object.keys(fe).length) setErrors(prev => ({ ...prev, ...fe }));
        } finally {
            setSubmitting(false);
        }
    };

    const tabErr = (t: ATab) => {
        if (t === 'ident') return !!(errors.codigo || errors.descricao);
        if (t === 'preco') return !!(errors.preco || errors.fornecedor);
        return false;
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" ref={modalRef} role="dialog" aria-modal="true" tabIndex={-1} style={{ maxWidth: 620 }}>
                <div className="modal-header">
                    <h3 className="modal-title">{artigo ? 'Editar Artigo' : 'Novo Artigo'}</h3>
                    <button className="modal-close" aria-label="Fechar" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 20px' }}>
                    {TABS_A.map(t => (
                        <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{
                            padding: '8px 14px', fontSize: '0.8rem', fontWeight: tab === t.id ? 600 : 400,
                            border: 'none', borderBottom: tab === t.id ? '2px solid var(--blue)' : '2px solid transparent',
                            background: 'none', cursor: 'pointer', marginBottom: -1,
                            color: tabErr(t.id) ? 'var(--red,#ef4444)' : tab === t.id ? 'var(--blue)' : 'var(--text-secondary)',
                        }}>
                            {t.label}{tabErr(t.id) ? ' ⚠' : ''}
                        </button>
                    ))}
                </div>
                <form onSubmit={handleSave} noValidate>
                    <div className="modal-body">
                        {/* ── Identificação ── */}
                        {tab === 'ident' && (
                            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                                {/* Image column */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                    <div style={{
                                        width: 100, height: 100, border: '1px solid var(--border)',
                                        borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: 'var(--bg-subtle,#f8fafc)', overflow: 'hidden', cursor: 'pointer',
                                    }} onClick={() => fileRef.current?.click()} title="Clique para carregar imagem">
                                        {imagem
                                            ? <img src={imagem} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : <ImageIcon size={30} style={{ color: 'var(--text-muted)' }} />
                                        }
                                    </div>
                                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFile} />
                                    {imagem
                                        ? <button type="button" className="abtn abtn-ghost" style={{ color: 'var(--red,#ef4444)', fontSize: '0.72rem', padding: '2px 8px' }}
                                            onClick={() => { setImagem(''); if (fileRef.current) fileRef.current.value = ''; }}>
                                            <Trash2 size={11} /> Remover
                                        </button>
                                        : <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3 }}>Clique na imagem</span>
                                    }
                                </div>
                                {/* Fields column */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div className="form-row">
                                        <div className="form-group" style={{ flex: '0 0 110px' }}>
                                            <label className="form-label req">Código</label>
                                            <input className={`form-input${errors.codigo ? ' err' : ''}`} value={codigo}
                                                onChange={e => setCodigo(e.target.value)} placeholder="ART-001" />
                                            {errors.codigo && <span className="form-error"><AlertCircle size={11} /> {errors.codigo}</span>}
                                        </div>
                                        <div className="form-group" style={{ flex: 1 }}>
                                            <label className="form-label req">Descrição</label>
                                            <input className={`form-input${errors.descricao ? ' err' : ''}`} value={descricao}
                                                onChange={e => setDescricao(e.target.value)} placeholder="Descrição do artigo" />
                                            {errors.descricao && <span className="form-error"><AlertCircle size={11} /> {errors.descricao}</span>}
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Classe</label>
                                            <select className="form-select" value={classe} onChange={e => setClasse(e.target.value)}>
                                                <option value="">— Seleccionar —</option>
                                                {classesArtigo.map(c => <option key={c.id} value={c.descricao}>{c.descricao}</option>)}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Família</label>
                                            <select className="form-select" value={familia} onChange={e => setFamilia(e.target.value)}>
                                                <option value="">— Seleccionar —</option>
                                                {familiasArtigo.map(f => <option key={f.id} value={f.descricao}>{f.descricao}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Unidade de Medida</label>
                                            <select className="form-select" value={unidadeMedida} onChange={e => setUnidade(e.target.value)}>
                                                <option value="UN">UN — Unidade</option>
                                                <option value="KG">KG — Quilograma</option>
                                                <option value="L">L — Litro</option>
                                                <option value="M">M — Metro</option>
                                                <option value="M2">M² — Metro quadrado</option>
                                                <option value="CX">CX — Caixa</option>
                                                <option value="PC">PC — Peça</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Código IVA</label>
                                            <select className="form-select" value={codigoIva} onChange={e => setCodigoIva(e.target.value)}>
                                                <option value="">— Sem IVA —</option>
                                                {taxasIva.map(t => (
                                                    <option key={t.id} value={t.codigo}>
                                                        {t.codigo} — {t.descricao} ({t.taxa}%)
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    {/* #195 — tipo de artigo e retenção na fonte */}
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label" htmlFor="art-tipo">Tipo</label>
                                            <select id="art-tipo" className="form-select" value={tipo} onChange={e => mudarTipo(e.target.value as TipoArtigo)}>
                                                <option value="PRODUTO">Produto</option>
                                                <option value="SERVICO">Serviço</option>
                                            </select>
                                        </div>
                                        <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', cursor: tipo === 'SERVICO' ? 'pointer' : 'not-allowed', color: tipo === 'SERVICO' ? undefined : 'var(--text-muted)', marginTop: 22 }}
                                                title={tipo === 'SERVICO' ? undefined : 'Só os artigos do tipo Serviço podem estar sujeitos a retenção'}>
                                                <input type="checkbox" checked={sujeitoRetencao} disabled={tipo !== 'SERVICO'}
                                                    onChange={e => setSujeitoRetencao(e.target.checked)} style={{ width: 14, height: 14, flexShrink: 0 }} />
                                                Sujeito a retenção na fonte
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Preço ── */}
                        {tab === 'preco' && (<>
                            <div style={{ background: 'var(--bg-subtle,#f8fafc)', borderRadius: 8, padding: '14px 14px 6px', marginBottom: 12 }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Preços de venda</div>
                                <div className="form-row" style={{ margin: 0 }}>
                                    <div className="form-group">
                                        <label className="form-label req">Preço Unitário</label>
                                        <input type="number" min={0} step="0.01"
                                            className={`form-input${errors.preco ? ' err' : ''}`}
                                            value={precoUnitario} onChange={e => setPreco(e.target.value)} />
                                        {errors.preco && <span className="form-error"><AlertCircle size={11} /> {errors.preco}</span>}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Moeda</label>
                                        <select className="form-select" value={moeda} onChange={e => setMoeda(e.target.value)}>
                                            <option value="AOA">AOA — Kwanza</option>
                                            <option value="USD">USD — Dólar</option>
                                            <option value="EUR">EUR — Euro</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Custo Médio</label>
                                        <input type="number" min={0} step="0.01" className="form-input"
                                            value={custoMedio} onChange={e => setCusto(e.target.value)} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0 10px', borderTop: '1px solid var(--border)', marginTop: 4 }}>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Valor total em stock</span>
                                    <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--blue)' }}>
                                        {fmtMoney(Number(precoUnitario || 0) * Number(existencia || 0), moeda)}
                                    </span>
                                </div>
                            </div>
                            <div style={{ background: 'var(--bg-subtle,#f8fafc)', borderRadius: 8, padding: '14px 14px 6px' }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Compra / Fornecimento</div>
                                <div className="form-row" style={{ margin: 0 }}>
                                    <div className="form-group">
                                        <label className="form-label">Preço de Compra</label>
                                        <input type="number" min={0} step="0.01" className="form-input"
                                            value={precoCusto} onChange={e => setPrecoCusto(e.target.value)}
                                            placeholder="Preço do fornecedor" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label req">Fornecedor</label>
                                        <SearchableSelect
                                            options={[
                                                { value: '', label: '— Seleccionar —' },
                                                ...fornecedores.filter(f => f.ativo).map(f => ({
                                                    value: f.id,
                                                    label: f.nome,
                                                    sub: f.nif || undefined,
                                                })),
                                            ]}
                                            value={refFornecedor}
                                            onChange={v => { setRefForn(v); if (v) setErrors(p => ({ ...p, fornecedor: '' })); }}
                                            placeholder="Seleccionar fornecedor..."
                                        />
                                        {errors.fornecedor && <span className="form-error"><AlertCircle size={11} /> {errors.fornecedor}</span>}
                                    </div>
                                </div>
                            </div>
                        </>)}

                        {/* ── Armazém ── */}
                        {tab === 'arm' && (<>
                            {/* Stock levels */}
                            <div style={{ background: 'var(--bg-subtle,#f8fafc)', borderRadius: 8, padding: '14px 14px 6px', marginBottom: 12 }}>
                                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Níveis de stock</div>
                                <div className="form-row" style={{ margin: 0 }}>
                                    <div className="form-group">
                                        <label className="form-label" title={isNew ? undefined : 'Definido na criação do artigo'}>
                                            Stock Inicial{!isNew && <span style={{ marginLeft: 4, fontSize: '0.68rem', color: 'var(--text-muted)' }}>— só leitura</span>}
                                        </label>
                                        {isNew
                                            ? <input type="number" min={0} step="0.001" className="form-input"
                                                value={stockInicial} onChange={e => handleStockInicialChange(e.target.value)} />
                                            : <input className="form-input" readOnly value={fmt(Number(stockInicial))}
                                                style={{ background: 'var(--bg-subtle,#f0f4f8)', color: 'var(--text-secondary)', cursor: 'not-allowed' }} />
                                        }
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" title={isNew ? 'Igual ao Stock Inicial na criação' : 'Atualizado pelos movimentos de stock'}>
                                            Existência Actual{!isNew && <span style={{ marginLeft: 4, fontSize: '0.68rem', color: 'var(--text-muted)' }}>— só leitura</span>}
                                        </label>
                                        {isNew
                                            ? <input type="number" min={0} step="0.001" className="form-input" readOnly
                                                value={stockInicial}
                                                style={{ background: 'var(--bg-subtle,#f0f4f8)', color: 'var(--text-secondary)', cursor: 'not-allowed' }}
                                                title="Igual ao Stock Inicial" />
                                            : <input className="form-input" readOnly value={fmt(Number(existencia))}
                                                style={{ background: 'var(--bg-subtle,#f0f4f8)', color: 'var(--text-secondary)', cursor: 'not-allowed' }} />
                                        }
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Stock Segurança</label>
                                        <input type="number" min={0} className="form-input"
                                            value={stockSeguranca} onChange={e => setSeg(e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Nível Máximo</label>
                                        <input type="number" min={0} className="form-input"
                                            value={nivelMaximo} onChange={e => setNMax(e.target.value)} />
                                    </div>
                                </div>
                                {Number(nivelMaximo) > 0 && (
                                    <div style={{ padding: '4px 0 12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                                            <span>0</span>
                                            <span style={{ color: Number(existencia) <= Number(stockSeguranca) ? 'var(--red,#ef4444)' : 'var(--text-secondary)', fontWeight: 600 }}>
                                                {fmt(Number(existencia))}
                                            </span>
                                            <span>{fmt(Number(nivelMaximo))}</span>
                                        </div>
                                        <div style={{ height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%', borderRadius: 4,
                                                width: `${Math.min(100, (Number(existencia) / Number(nivelMaximo)) * 100)}%`,
                                                background: Number(existencia) <= Number(stockSeguranca) ? 'var(--red,#ef4444)' : 'var(--green)',
                                                transition: 'width 0.3s',
                                            }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                            {/* Armazém + flags */}
                            <div className="form-row">
                                <div className="form-group" style={{ flex: 2 }}>
                                    <label className="form-label">Armazém Principal</label>
                                    <select className="form-select" value={codigoArmazem}
                                        onChange={e => setArmazem(e.target.value)}>
                                        {armazens.filter(a => a.ativo).map(a => <option key={a.id} value={a.codigo}>{a.codigo} — {a.nome}</option>)}
                                    </select>
                                </div>
                                <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 8, paddingBottom: 2 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={critico} onChange={e => setCritico(e.target.checked)} style={{ width: 14, height: 14, flexShrink: 0 }} />
                                        Artigo crítico
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={inativo} onChange={e => setInativo(e.target.checked)} style={{ width: 14, height: 14, flexShrink: 0 }} />
                                        Inactivo
                                    </label>
                                </div>
                            </div>
                            {/* Last movement dates (readonly info) */}
                            {artigo && (artigo.dataUltimaEntrada || artigo.dataUltimaSaida) && (
                                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                                    {artigo.dataUltimaEntrada && (
                                        <div style={{ flex: 1, background: 'var(--bg-subtle,#f8fafc)', borderRadius: 6, padding: '8px 12px' }}>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Última Entrada</div>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{new Date(artigo.dataUltimaEntrada).toLocaleString('pt-PT')}</div>
                                        </div>
                                    )}
                                    {artigo.dataUltimaSaida && (
                                        <div style={{ flex: 1, background: 'var(--bg-subtle,#f8fafc)', borderRadius: 6, padding: '8px 12px' }}>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Última Saída</div>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{new Date(artigo.dataUltimaSaida).toLocaleString('pt-PT')}</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Multi-warehouse breakdown (existing articles only) ── */}
                            {artigo && (
                                <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
                                        <Warehouse size={13} /> Distribuição por Armazém
                                    </div>
                                    {saEntries.length > 0 && (
                                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: '0.8rem' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600, color: 'var(--text-muted)' }}>Armazém</th>
                                                    <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 600, color: 'var(--text-muted)' }}>Qtd.</th>
                                                    <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 600, color: 'var(--text-muted)' }}>Stk. Mín.</th>
                                                    <th style={{ width: 30 }} />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {saEntries.map(sa => (
                                                    <tr key={sa.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                        <td style={{ padding: '5px 8px' }}>
                                                            <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: 6 }}>{sa.armazem.codigo}</span>
                                                            {sa.armazem.nome}
                                                        </td>
                                                        <td style={{ textAlign: 'right', padding: '5px 8px', fontWeight: 600 }}>{fmt(sa.quantidade)}</td>
                                                        <td style={{ textAlign: 'right', padding: '5px 8px', color: 'var(--text-muted)' }}>{fmt(sa.stockMinimo)}</td>
                                                        <td style={{ textAlign: 'center', padding: '5px 4px' }}>
                                                            <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red,#ef4444)', padding: 2 }}
                                                                onClick={() => removeStockArmazem(sa.id)}>
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                    {saEntries.length === 0 && (
                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                                            Sem distribuição registada. Adicione entradas abaixo.
                                        </p>
                                    )}
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                                        <div style={{ flex: 2 }}>
                                            <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Armazém</label>
                                            <select className="form-select" style={{ fontSize: '0.8rem' }}
                                                value={saNewArmazem} onChange={e => setSaNewArmazem(e.target.value)}>
                                                <option value="">Seleccionar...</option>
                                                {armazens.filter(a => a.ativo).map(a => (
                                                    <option key={a.id} value={a.id}>{a.codigo} — {a.nome}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Qtd.</label>
                                            <input type="number" min={0} className="form-input" style={{ fontSize: '0.8rem' }}
                                                value={saNewQtd} onChange={e => setSaNewQtd(e.target.value)} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Stk. Mín.</label>
                                            <input type="number" min={0} className="form-input" style={{ fontSize: '0.8rem' }}
                                                value={saNewMin} onChange={e => setSaNewMin(e.target.value)} />
                                        </div>
                                        <button type="button" className="abtn abtn-secondary" style={{ fontSize: '0.8rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                                            onClick={handleAddSa} disabled={!saNewArmazem}>
                                            <Plus size={12} /> Adicionar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>)}

                        {/* ── Observação ── */}
                        {tab === 'obs' && (
                            <div className="form-group">
                                <label className="form-label">Observações</label>
                                <textarea className="form-input" rows={10} style={{ resize: 'vertical', lineHeight: 1.6 }}
                                    value={observacao} onChange={e => setObs(e.target.value)}
                                    placeholder="Notas internas sobre este artigo..." />
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                        <SubmitButton submitting={submitting} icon={<Check size={12} />}>Guardar</SubmitButton>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ══ Artigo View Modal (read-only) ══════════════════════════ */
interface ArtigoViewModalProps {
    artigo: Artigo;
    onClose: () => void;
    onEdit: () => void;
}
const TABS_V = TABS_A;
type VTab = ATab;

const ArtigoViewModal: React.FC<ArtigoViewModalProps> = ({ artigo, onClose, onEdit }) => {
    const modalRef = useModalA11y(onClose); // #223 — Esc fecha e foco no modal (#45)
    const { armazens, stockArmazem, fmt, fmtMoney, taxasIva, fornecedores } = useGlobal();
    const [tab, setTab] = useState<VTab>('ident');
    const saEntries = stockArmazem.filter(sa => sa.artigoId === artigo.id);
    const resolveForn = (id?: string) => id ? (fornecedores.find(f => f.id === id)?.nome ?? id) : undefined;
    const resolveArm = (val: string) =>
        armazens.find(a => a.id === val || a.codigo === val)?.nome ?? val;
    const resolveIva = (cod?: string) => {
        if (!cod) return '—';
        const t = taxasIva.find(t => t.codigo === cod);
        return t ? `${t.codigo} — ${t.descricao} (${t.taxa}%)` : cod;
    };

    const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
        <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)' }}>{value || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>}</div>
        </div>
    );

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" ref={modalRef} role="dialog" aria-modal="true" tabIndex={-1} style={{ maxWidth: 620 }}>
                <div className="modal-header">
                    <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Eye size={15} style={{ color: 'var(--blue)' }} />
                        {artigo.codigo} — {artigo.descricao}
                    </h3>
                    <button className="modal-close" aria-label="Fechar" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 20px' }}>
                    {TABS_V.map(t => (
                        <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{
                            padding: '8px 14px', fontSize: '0.8rem', fontWeight: tab === t.id ? 600 : 400,
                            border: 'none', borderBottom: tab === t.id ? '2px solid var(--blue)' : '2px solid transparent',
                            background: 'none', cursor: 'pointer', marginBottom: -1,
                            color: tab === t.id ? 'var(--blue)' : 'var(--text-secondary)',
                        }}>
                            {t.label}
                        </button>
                    ))}
                </div>
                <div className="modal-body">
                    {/* ── Identificação ── */}
                    {tab === 'ident' && (
                        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0 16px' }}>
                                    <Field label="Código" value={<span style={{ fontFamily: 'monospace' }}>{artigo.codigo}</span>} />
                                    <Field label="Descrição" value={artigo.descricao} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                                    <Field label="Classe" value={artigo.classe} />
                                    <Field label="Família" value={artigo.familia} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                                    <Field label="Unidade de Medida" value={artigo.unidadeMedida} />
                                    <Field label="Código IVA" value={resolveIva(artigo.codigoIva)} />
                                </div>
                                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                                    {artigo.critico && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', padding: '2px 8px', borderRadius: 4, background: '#fef3c7', color: '#b45309', fontWeight: 600 }}>
                                            <Star size={11} /> Crítico
                                        </span>
                                    )}
                                    {artigo.inativo && (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', padding: '2px 8px', borderRadius: 4, background: 'var(--bg-secondary,#f1f5f9)', color: 'var(--text-muted)', fontWeight: 600 }}>
                                            <Archive size={11} /> Inactivo
                                        </span>
                                    )}
                                </div>
                            </div>
                            {artigo.imagem && (
                                <div style={{ width: 110, height: 110, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                                    <img src={artigo.imagem} alt="artigo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                            )}
                        </div>
                    )}
                    {/* ── Preço ── */}
                    {tab === 'preco' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                            <Field label="Preço Unitário" value={fmtMoney(artigo.precoUnitario, artigo.moeda)} />
                            <Field label="Moeda" value={artigo.moeda} />
                            <Field label="Custo Médio" value={artigo.custoMedio ? fmtMoney(artigo.custoMedio, artigo.moeda) : undefined} />
                            <Field label="Preço de Compra" value={(artigo as any).precoCusto ? fmtMoney((artigo as any).precoCusto, artigo.moeda) : undefined} />
                            <Field label="Fornecedor" value={resolveForn(artigo.refFornecedor)} />
                            <div style={{ gridColumn: '1 / -1', background: 'var(--bg-subtle,#f8fafc)', borderRadius: 8, padding: '12px 14px', marginTop: 4 }}>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Valor total em stock</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--blue)', marginTop: 4 }}>
                                    {fmtMoney(artigo.precoUnitario * artigo.existencia, artigo.moeda)}
                                </div>
                            </div>
                        </div>
                    )}
                    {/* ── Armazém ── */}
                    {tab === 'arm' && (<>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0 16px' }}>
                            <Field label="Stock Inicial" value={fmt(artigo.stockInicial)} />
                            <Field label="Existência" value={fmt(artigo.existencia)} />
                            <Field label="Nível Máximo" value={artigo.nivelMaximo ? fmt(artigo.nivelMaximo) : undefined} />
                            <Field label="Stock Segurança" value={artigo.stockSeguranca ? fmt(artigo.stockSeguranca) : undefined} />
                        </div>
                        {(artigo.dataUltimaEntrada || artigo.dataUltimaSaida) && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                                <Field label="Última Entrada" value={artigo.dataUltimaEntrada ? new Date(artigo.dataUltimaEntrada).toLocaleString('pt-PT') : undefined} />
                                <Field label="Última Saída" value={artigo.dataUltimaSaida ? new Date(artigo.dataUltimaSaida).toLocaleString('pt-PT') : undefined} />
                            </div>
                        )}
                        <Field label="Armazém Principal" value={resolveArm(artigo.codigoArmazem)} />
                        {artigo.nivelMaximo > 0 && (
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                                    <span>0</span><span>{fmt(artigo.existencia)}</span><span>{fmt(artigo.nivelMaximo)}</span>
                                </div>
                                <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                                    <div style={{
                                        height: '100%', borderRadius: 4,
                                        width: `${Math.min(100, (artigo.existencia / artigo.nivelMaximo) * 100)}%`,
                                        background: artigo.existencia <= artigo.stockSeguranca ? 'var(--red,#ef4444)' : 'var(--green)',
                                    }} />
                                </div>
                            </div>
                        )}
                        {saEntries.length > 0 && (
                            <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
                                    <Warehouse size={13} /> Distribuição por Armazém
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 600, color: 'var(--text-muted)' }}>Armazém</th>
                                            <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 600, color: 'var(--text-muted)' }}>Qtd.</th>
                                            <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 600, color: 'var(--text-muted)' }}>Stk. Mín.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {saEntries.map(sa => (
                                            <tr key={sa.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '5px 8px' }}>
                                                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: 6 }}>{sa.armazem.codigo}</span>
                                                    {sa.armazem.nome}
                                                </td>
                                                <td style={{ textAlign: 'right', padding: '5px 8px', fontWeight: 600, color: sa.quantidade <= sa.stockMinimo ? 'var(--red,#ef4444)' : undefined }}>{fmt(sa.quantidade)}</td>
                                                <td style={{ textAlign: 'right', padding: '5px 8px', color: 'var(--text-muted)' }}>{fmt(sa.stockMinimo)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>)}
                    {/* ── Observação ── */}
                    {tab === 'obs' && (
                        artigo.observacao
                            ? <p style={{ fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{artigo.observacao}</p>
                            : <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sem observações registadas.</p>
                    )}
                </div>
                <div className="modal-footer">
                    <button type="button" className="abtn abtn-secondary" onClick={onClose}>Fechar</button>
                    <button type="button" className="abtn abtn-primary" onClick={onEdit}><Edit2 size={12} /> Editar</button>
                </div>
            </div>
        </div>
    );
};

/* ══ Inventário Modal (multi-article) ═══════════════════════ */
interface InventLine { artigoId: string; novaExist: string; }

interface InventarioModalProps {
    artigos: Artigo[];
    armazens: Armazem[];
    onClose: () => void;
    onConfirm: (lines: InventLine[]) => void;
}

const buildInventSheetHtml = (artigos: Artigo[], lines: InventLine[], armazens: Armazem[] = []): string => {
    const resolveArm = (val: string) =>
        armazens.find(a => a.id === val || a.codigo === val)?.codigo ?? val;
    const rows = lines.map(l => {
        const a = artigos.find(x => x.id === l.artigoId);
        if (!a) return '';
        return `<tr>
            <td>${a.codigo}</td>
            <td>${a.descricao}</td>
            <td>${resolveArm(a.codigoArmazem)}</td>
            <td style="text-align:right">${a.existencia}</td>
            <td></td>
            <td></td>
        </tr>`;
    }).join('');
    return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Ficha de Inventário — AQUATEX</title>
<style>
  @page { size: A4; margin: 0; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { font-family: Arial,sans-serif; font-size: 12px; margin: 0; padding: 15mm 20mm; color: #000; }
  h2 { margin: 0; font-size: 15px; }
  .hdr { display: flex; justify-content: space-between; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #000; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #999; padding: 4px 7px; }
  th { background: #eee !important; text-align: left; }
  td:last-child, td:nth-child(5) { width: 100px; min-height: 28px; }
  tfoot td { font-weight: bold; background: #f5f5f5 !important; }
</style>
</head><body>
<div class="hdr">
  <div><strong style="font-size:18px">AQUATEX SGI</strong><br/>Ficha de Inventário Físico</div>
  <div style="text-align:right">Data: ${new Date().toLocaleDateString('pt-PT')}<br/>Hora: ${new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</div>
</div>
<table>
  <thead><tr>
    <th>Código</th><th>Descrição</th><th>Armazém</th>
    <th>Exist. Sistema</th><th>Contagem Real</th><th>Diferença</th>
  </tr></thead>
  <tbody>${rows || '<tr><td colspan="6" style="text-align:center">Sem artigos seleccionados</td></tr>'}</tbody>
  <tfoot><tr><td colspan="3">Total de artigos: ${lines.length}</td><td colspan="3"></td></tr></tfoot>
</table>
<p style="margin-top:20px;font-size:10px;color:#666">
  Responsável: _______________________  &nbsp;&nbsp; Assinatura: _______________________  &nbsp;&nbsp; Data confirmação: ___________
</p>
</body></html>`;
};

const printInventSheet = (artigos: Artigo[], lines: InventLine[], armazens: Armazem[] = []) => {
    void imprimirPdf(buildInventSheetHtml(artigos, lines, armazens), 'Folha de inventário');
};

const InventarioModal: React.FC<InventarioModalProps> = ({ artigos, armazens, onClose, onConfirm }) => {
    const modalRef = useModalA11y(onClose); // #223 — Esc fecha e foco no modal (#45)
    const { fmt } = useGlobal();
    const resolveArmazem = (val: string) =>
        armazens.find(a => a.id === val || a.codigo === val)?.codigo ?? val;
    const [search, setSearch] = useState('');
    const [lines, setLines]   = useState<InventLine[]>(
        artigos.filter(a => !a.inativo).map(a => ({ artigoId: a.id, novaExist: String(a.existencia) }))
    );
    const [selected, setSelected] = useState<Set<string>>(new Set(artigos.filter(a => !a.inativo).map(a => a.id)));
    const [previewHtml, setPreviewHtml] = useState('');

    const filtered = artigos.filter(a => {
        const q = search.toLowerCase();
        return !a.inativo && (!q || a.codigo.toLowerCase().includes(q) || a.descricao.toLowerCase().includes(q));
    });

    const toggleAll = (checked: boolean) => {
        if (checked) setSelected(new Set(filtered.map(a => a.id)));
        else setSelected(s => { const n = new Set(s); filtered.forEach(a => n.delete(a.id)); return n; });
    };

    const setNovaExist = (artigoId: string, val: string) => {
        setLines(ls => ls.map(l => l.artigoId === artigoId ? { ...l, novaExist: val } : l));
    };

    const getLine = (id: string) => lines.find(l => l.artigoId === id);

    const handleConfirm = () => {
        const toUpdate = lines.filter(l => selected.has(l.artigoId));
        onConfirm(toUpdate);
        onClose();
    };

    const selectedLines = lines.filter(l => selected.has(l.artigoId));

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            {previewHtml && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, fontWeight: 700, fontSize: '0.85rem' }}>Pré-visualização</span>
                        <button type="button" className="abtn abtn-primary" onClick={() => printInventSheet(artigos, selectedLines, armazens)} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Printer size={13} /> Imprimir
                        </button>
                        <button type="button" className="abtn abtn-secondary" onClick={() => setPreviewHtml('')}>
                            <X size={13} /> Fechar
                        </button>
                    </div>
                    <iframe srcDoc={previewHtml} title="Pré-visualização" style={{ flex: 1, border: 'none', background: '#fff' }} />
                </div>
            )}
            <div className="modal" ref={modalRef} role="dialog" aria-modal="true" tabIndex={-1} style={{ maxWidth: 720 }}>
                <div className="modal-header">
                    <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Archive size={14} /> Inventário de Stock
                    </h3>
                    <button className="modal-close" aria-label="Fechar" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body" style={{ padding: 0 }}>
                    <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                        <div className="search-wrap" style={{ flex: 1 }}>
                            <Search className="search-icon" />
                            <input className="search-input" placeholder="Pesquisar artigo..."
                                value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <button type="button" className="abtn abtn-secondary"
                            onClick={() => setPreviewHtml(buildInventSheetHtml(artigos, selectedLines, armazens))}
                            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                            title="Pré-visualizar ficha de inventário">
                            <Eye size={12} /> Pré-visualizar
                        </button>
                        <button type="button" className="abtn abtn-secondary"
                            onClick={() => printInventSheet(artigos, selectedLines, armazens)}
                            title="Baixar ficha para contagem física">
                            <FileText size={12} /> Baixar Ficha PDF
                        </button>
                    </div>
                    <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 36, paddingLeft: 14 }}>
                                        <input type="checkbox"
                                            checked={filtered.length > 0 && filtered.every(a => selected.has(a.id))}
                                            onChange={e => toggleAll(e.target.checked)}
                                            style={{ width: 13, height: 13 }} />
                                    </th>
                                    <th>Código</th>
                                    <th>Descrição</th>
                                    <th>Armazém</th>
                                    <th style={{ textAlign: 'right' }}>Exist. Sistema</th>
                                    <th style={{ width: 130 }}>Nova Existência</th>
                                    <th style={{ textAlign: 'right' }}>Diferença</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(a => {
                                    const line = getLine(a.id);
                                    const nova  = Number(line?.novaExist ?? a.existencia);
                                    const diff  = nova - a.existencia;
                                    const isSel = selected.has(a.id);
                                    return (
                                        <tr key={a.id} style={{ opacity: isSel ? 1 : 0.4 }}>
                                            <td style={{ paddingLeft: 14 }}>
                                                <input type="checkbox" checked={isSel}
                                                    onChange={e => {
                                                        const n = new Set(selected);
                                                        if (e.target.checked) n.add(a.id); else n.delete(a.id);
                                                        setSelected(n);
                                                    }}
                                                    style={{ width: 13, height: 13 }} />
                                            </td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{a.codigo}</td>
                                            <td style={{ fontSize: '0.82rem' }}>{a.descricao}</td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{resolveArmazem(a.codigoArmazem)}</td>
                                            <td style={{ textAlign: 'right', fontSize: '0.82rem' }}>{fmt(a.existencia)}</td>
                                            <td>
                                                <input type="number" min={0} className="form-input"
                                                    style={{ padding: '3px 8px', fontSize: '0.82rem' }}
                                                    value={line?.novaExist ?? a.existencia}
                                                    disabled={!isSel}
                                                    onChange={e => setNovaExist(a.id, e.target.value)} />
                                            </td>
                                            <td style={{ textAlign: 'right', fontSize: '0.82rem', fontWeight: diff !== 0 ? 700 : 400,
                                                color: diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red,#ef4444)' : 'var(--text-muted)' }}>
                                                {diff > 0 ? `+${fmt(diff)}` : diff < 0 ? fmt(diff) : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ padding: '8px 20px', borderTop: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {selected.size} artigo(s) seleccionado(s) de {artigos.filter(a => !a.inativo).length}
                    </div>
                </div>
                <div className="modal-footer">
                    <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                    <button type="button" className="abtn abtn-primary" onClick={handleConfirm}>
                        <Check size={12} /> Actualizar Existências
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ══ Transferência Modal (multi-article) ════════════════════ */
interface TransfLine { artigoId: string; qtd: string; }

interface TransferenciaModalProps {
    artigos: Artigo[];
    armazens: Armazem[];
    onClose: () => void;
    onConfirm: (de: string, para: string, lines: TransfLine[]) => Promise<boolean>;
}

const TransferenciaModal: React.FC<TransferenciaModalProps> = ({ artigos, armazens, onClose, onConfirm }) => {
    const modalRef = useModalA11y(onClose); // #223 — Esc fecha e foco no modal (#45)
    const { fmt, stockArmazem } = useGlobal();
    const ativos = armazens.filter(a => a.ativo);
    const [armazDe,   setArmazDe]   = useState(ativos[0]?.codigo ?? '');
    const [armazPara, setArmazPara] = useState(ativos[1]?.codigo ?? '');
    const [lines, setLines]         = useState<TransfLine[]>([]);
    const [busy, setBusy]           = useState(false);

    // #203 — o que se transfere é o stock do armazém de origem (stock_armazem), não a existência total.
    const naOrigem = (artigoId: string) =>
        stockArmazem.find(sa => sa.artigoId === artigoId && sa.armazem.codigo === armazDe)?.quantidade ?? 0;

    const artigoOpts = artigos.filter(a => !a.inativo && naOrigem(a.id) > 0).map(a => ({
        value: a.id, label: a.descricao,
        sub: `${a.codigo} · Em ${armazDe}: ${fmt(naOrigem(a.id))}`,
    }));

    const mudarOrigem = (codigo: string) => {
        setArmazDe(codigo);
        setLines([]);
        if (armazPara === codigo) setArmazPara(ativos.find(a => a.codigo !== codigo)?.codigo ?? '');
    };
    const excede = (l: TransfLine) => !!l.artigoId && Number(l.qtd) > naOrigem(l.artigoId);
    const validas = lines.filter(l => l.artigoId && Number(l.qtd) > 0);
    const podeConfirmar = !busy && !!armazPara && armazPara !== armazDe && validas.length > 0 && !lines.some(excede);

    const addLine = () => setLines(ls => [...ls, { artigoId: '', qtd: '1' }]);
    const removeLine = (i: number) => setLines(ls => ls.filter((_, j) => j !== i));
    const setLine = (i: number, field: 'artigoId' | 'qtd', val: string) =>
        setLines(ls => ls.map((l, j) => j === i ? { ...l, [field]: val } : l));

    const handleConfirm = async () => {
        if (!podeConfirmar) return;
        setBusy(true);
        const ok = await onConfirm(armazDe, armazPara, validas);
        setBusy(false);
        if (ok) onClose();
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" ref={modalRef} role="dialog" aria-modal="true" tabIndex={-1} style={{ maxWidth: 620 }}>
                <div className="modal-header">
                    <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <RefreshCw size={14} /> Transferência entre Armazéns
                    </h3>
                    <button className="modal-close" aria-label="Fechar" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body">
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label req">Armazém de Origem</label>
                            <select className="form-select" value={armazDe} onChange={e => mudarOrigem(e.target.value)}>
                                {armazens.filter(a => a.ativo).map(a => <option key={a.id} value={a.codigo}>{a.codigo} — {a.nome}</option>)}
                            </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', paddingTop: 20, fontSize: '1.2rem', color: 'var(--text-muted)' }}>→</div>
                        <div className="form-group">
                            <label className="form-label req">Armazém de Destino</label>
                            <select className="form-select" value={armazPara} onChange={e => setArmazPara(e.target.value)}>
                                {armazens.filter(a => a.ativo && a.codigo !== armazDe).map(a => <option key={a.id} value={a.codigo}>{a.codigo} — {a.nome}</option>)}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0 6px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Artigos a transferir</span>
                        <button type="button" className="abtn abtn-secondary" style={{ padding: '3px 10px' }} onClick={addLine}>
                            <Plus size={11} /> Adicionar linha
                        </button>
                    </div>

                    {lines.length === 0 && (
                        <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 4 }}>
                            Clique em "Adicionar linha" para seleccionar artigos a transferir.
                        </div>
                    )}

                    {lines.map((line, i) => {
                        const artigo = artigos.find(a => a.id === line.artigoId);
                        return (
                            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                                <div style={{ flex: 1 }}>
                                    <SearchableSelect
                                        options={artigoOpts.filter(o => !lines.some((l, j) => j !== i && l.artigoId === o.value))}
                                        value={line.artigoId}
                                        onChange={v => setLine(i, 'artigoId', v)}
                                        placeholder="Seleccionar artigo..."
                                    />
                                    {artigo && (
                                        <div style={{ fontSize: '0.72rem', color: excede(line) ? 'var(--red,#ef4444)' : 'var(--text-muted)', marginTop: 2 }}>
                                            {excede(line)
                                                ? `Só existem ${fmt(naOrigem(artigo.id))} un em ${armazDe}.`
                                                : `Em ${armazDe}: ${fmt(naOrigem(artigo.id))} un`}
                                        </div>
                                    )}
                                </div>
                                <div style={{ width: 100 }}>
                                    <input type="number" min={1} max={artigo ? naOrigem(artigo.id) : undefined} aria-invalid={excede(line)}
                                        className="form-input" style={{ padding: '5px 8px' }}
                                        value={line.qtd} onChange={e => setLine(i, 'qtd', e.target.value)}
                                        placeholder="Qtd" />
                                </div>
                                <button type="button" className="icon-btn" style={{ marginTop: 2 }} onClick={() => removeLine(i)}>
                                    <Trash2 size={13} style={{ color: 'var(--red,#ef4444)' }} />
                                </button>
                            </div>
                        );
                    })}
                </div>
                <div className="modal-footer">
                    <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                    <button type="button" className="abtn abtn-primary"
                        disabled={!podeConfirmar}
                        onClick={handleConfirm}>
                        <Check size={12} /> {busy ? 'A transferir…' : 'Confirmar Transferência'}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ══ Simple Op Modal (Reposição / Devolução / Guia) ════════ */
type SimpleOpType = 'reposicao' | 'devolucao' | 'guia';
const SIMPLE_OP_LABELS: Record<SimpleOpType, { titulo: string; acao: string; icon: React.ReactNode }> = {
    reposicao: { titulo: 'Reposição de Stock', acao: 'Repor',     icon: <ArrowDownCircle size={14} /> },
    devolucao: { titulo: 'Devolução',           acao: 'Devolver',  icon: <ArrowUpCircle size={14} /> },
    guia:      { titulo: 'Guia de Transporte',  acao: 'Emitir',   icon: <Truck size={14} /> },
};
interface SimpleOpModalProps {
    tipo: SimpleOpType;
    artigos: Artigo[];
    onClose: () => void;
    onConfirm: (tipo: SimpleOpType, artigoId: string, quantidade: number, nota: string) => void;
}
const SimpleOpModal: React.FC<SimpleOpModalProps> = ({ tipo, artigos, onClose, onConfirm }) => {
    const modalRef = useModalA11y(onClose); // #223 — Esc fecha e foco no modal (#45)
    const { fmt } = useGlobal();
    const [artigoId, setArtigoId] = useState('');
    const [quantidade, setQtd]   = useState('');
    const [nota, setNota]        = useState('');
    const cfg = SIMPLE_OP_LABELS[tipo];
    const artigo = artigos.find(a => a.id === artigoId);
    const artigoOpts = artigos.map(a => ({ value: a.id, label: a.descricao, sub: `${a.codigo} · ${fmt(a.existencia)} un` }));

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" ref={modalRef} role="dialog" aria-modal="true" tabIndex={-1} style={{ maxWidth: 480 }}>
                <div className="modal-header">
                    <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {cfg.icon} {cfg.titulo}
                    </h3>
                    <button className="modal-close" aria-label="Fechar" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body">
                    <div className="form-group">
                        <label className="form-label req">Artigo</label>
                        <SearchableSelect options={artigoOpts} value={artigoId} onChange={setArtigoId} placeholder="Seleccionar artigo..." />
                        {artigo && (
                            <div style={{ marginTop: 6, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                                Existência actual: <strong>{fmt(artigo.existencia)}</strong> un
                            </div>
                        )}
                    </div>
                    <div className="form-group">
                        <label className="form-label req">Quantidade</label>
                        <input type="number" min={0} className="form-input"
                            value={quantidade} onChange={e => setQtd(e.target.value)} placeholder="0" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Nota / Referência</label>
                        <input className="form-input" value={nota} onChange={e => setNota(e.target.value)} placeholder="Opcional" />
                    </div>
                </div>
                <div className="modal-footer">
                    <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                    <button type="button" className="abtn abtn-primary"
                        onClick={() => {
                            if (!artigoId || !quantidade) return;
                            onConfirm(tipo, artigoId, Number(quantidade), nota);
                            onClose();
                        }}>
                        <Check size={12} /> {cfg.acao}
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ══ Stats Modal ════════════════════════════════════════════ */
const StatsModal: React.FC<{ artigos: Artigo[]; onClose: () => void }> = ({ artigos, onClose }) => {
    const modalRef = useModalA11y(onClose); // #223 — Esc fecha e foco no modal (#45)
    const { fmt, fmtMoney } = useGlobal();
    const totalValor = artigos.reduce((s, a) => s + a.existencia * a.precoUnitario, 0);
    const criticos   = artigos.filter(a => a.critico && a.existencia <= a.stockSeguranca);
    const abaixoSeg  = artigos.filter(a => a.existencia <= a.stockSeguranca);
    const semStock   = artigos.filter(a => a.existencia === 0);

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" ref={modalRef} role="dialog" aria-modal="true" tabIndex={-1} style={{ maxWidth: 520 }}>
                <div className="modal-header">
                    <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BarChart2 size={14} /> Estatísticas de Stock
                    </h3>
                    <button className="modal-close" aria-label="Fechar" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                        {[
                            { label: 'Total artigos',     value: artigos.length,     color: 'var(--blue)' },
                            { label: 'Valor total stock', value: fmtMoney(totalValor), color: 'var(--green)' },
                            { label: 'Artigos críticos',  value: criticos.length,    color: 'var(--red,#ef4444)' },
                            { label: 'Sem stock',         value: semStock.length,    color: 'var(--orange,#f97316)' },
                        ].map(s => (
                            <div key={s.label} style={{ background: 'var(--bg-subtle,#f8fafc)', borderRadius: 8, padding: '12px 14px' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.label}</div>
                                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
                            </div>
                        ))}
                    </div>
                    {abaixoSeg.length > 0 && (<>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                            Artigos abaixo do stock de segurança:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {abaixoSeg.map(a => (
                                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', padding: '4px 8px', background: a.existencia === 0 ? '#fff1f2' : '#fffbeb', borderRadius: 6 }}>
                                    <span><strong>{a.codigo}</strong> — {a.descricao}</span>
                                    <span style={{ color: a.existencia === 0 ? 'var(--red,#ef4444)' : 'var(--orange,#f97316)', fontWeight: 600 }}>
                                        {fmt(a.existencia)} / {fmt(a.stockSeguranca)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>)}
                </div>
                <div className="modal-footer">
                    <button type="button" className="abtn abtn-secondary" onClick={onClose}>Fechar</button>
                </div>
            </div>
        </div>
    );
};

/* ══ Page ════════════════════════════════════════════════════ */
type OpState = 'inventario' | 'transferencia' | 'reposicao' | 'devolucao' | 'guia' | 'stats' | null;

const StockPage: React.FC = () => {
    const { artigos, addArtigo, updateArtigo, adjustExistencia, transferirStock, armazens, addMovimento, currentUser, stockArmazem, fmt, fmtMoney, classesArtigo, familiasArtigo, loadingData } = useGlobal();

    // Resolve warehouse code from either a code string or a numeric ID (legacy data)
    const resolveArmazem = (val: string) =>
        armazens.find(a => a.id === val || a.codigo === val)?.nome ?? armazens.find(a => a.id === val || a.codigo === val)?.codigo ?? val;

    const [search,    setSearch]  = useState('');
    const [filterCls, setFCls]    = useState('');
    const [filterFam, setFFam]    = useState('');
    const [filterTipo, setFTipo]  = useState<TipoArtigo | ''>('');   // #195
    const [modal,     setModal]   = useState<'new' | string | null>(null);
    const [viewModal, setViewModal] = useState<string | null>(null);
    const [op,         setOp]       = useState<OpState>(null);
    const [showExport, setShowExport] = useState(false);
    const [expanded,   setExpanded]  = useState<Set<string>>(new Set());

    const showToast = (msg: string) => notify(msg, 'success');

    const classes  = classesArtigo.map(c => c.descricao);
    const familias = familiasArtigo.map(f => f.descricao);

    const filtered = artigos.filter(a => {
        const q = search.toLowerCase();
        return (!q || a.codigo.toLowerCase().includes(q) || a.descricao.toLowerCase().includes(q) || a.familia.toLowerCase().includes(q))
            && (!filterCls || a.classe  === filterCls)
            && (!filterFam || a.familia === filterFam)
            && (!filterTipo || a.tipo === filterTipo);
    });

    const exportData = filtered.map(a => ({
        ...a, critico: a.critico ? 'Sim' : 'Não',
        tipoLabel: TIPO_ARTIGO_LABEL[a.tipo], retencaoLabel: a.sujeitoRetencao ? 'Sim' : 'Não',
    }));

    const editTarget = typeof modal === 'string' && modal !== 'new' ? artigos.find(a => a.id === modal) : undefined;

    // #212 — só fecha e confirma depois de o servidor aceitar; o erro sobe para o modal.
    const handleSave = async (data: Omit<Artigo, 'id'>) => {
        if (typeof modal === 'string' && modal !== 'new') {
            await updateArtigo(modal, data);
            showToast('Artigo actualizado.');
        } else {
            const a = await addArtigo(data);
            showToast(`Artigo ${a.codigo} registado.`);
        }
        setModal(null);
    };

    // #212 — espera por cada pedido e pára no primeiro erro (já mostrado pelo interceptor).
    const handleInventario = async (lines: InventLine[]) => {
        const hoje = new Date().toISOString().split('T')[0];
        let count = 0;
        try {
            for (const l of lines) {
                const a = artigos.find(x => x.id === l.artigoId);
                if (!a) continue;
                const delta = Number(l.novaExist) - a.existencia;
                await adjustExistencia(l.artigoId, delta);
                await addMovimento({ artigoId: l.artigoId, tipo: 'ajuste', quantidade: delta, armazemId: a.codigoArmazem, usuario: currentUser?.email, observacao: 'Ajuste de inventário', data: hoje });
                count++;
            }
        } catch {
            if (count > 0) notify(`${count} de ${lines.length} artigo(s) ajustados antes do erro.`, 'warning');
            return;
        }
        showToast(`Inventário actualizado — ${count} artigo(s) ajustado(s).`);
    };

    // #203 — cada linha é uma transferência atómica no backend (stock_armazem de origem → destino
    // e o movimento); a existência total não muda e o armazém do artigo também não.
    const handleTransferencia = async (de: string, para: string, lines: TransfLine[]): Promise<boolean> => {
        let feitas = 0;
        for (const l of lines) {
            try {
                await transferirStock(l.artigoId, de, para, Number(l.qtd));
                feitas++;
            } catch {
                // o erro (ex.: stock insuficiente) já é mostrado pelo interceptor global (api.ts)
                if (feitas > 0) notify(`${feitas} de ${lines.length} artigo(s) transferidos antes do erro.`, 'warning');
                return false;
            }
        }
        showToast(`Transferência ${de} → ${para} registada (${feitas} artigo(s)).`);
        return true;
    };

    const handleSimpleOp = async (tipo: SimpleOpType, artigoId: string, quantidade: number) => {
        const hoje = new Date().toISOString().split('T')[0];
        const a = artigos.find(x => x.id === artigoId);
        try {
            if (tipo === 'reposicao') {
                await adjustExistencia(artigoId, quantidade);
                await addMovimento({ artigoId, tipo: 'entrada', quantidade, armazemId: a?.codigoArmazem, usuario: currentUser?.email, observacao: 'Reposição manual', data: hoje });
                showToast(`Reposição de ${fmt(quantidade)} un registada.`);
                return;
            }
            if (tipo === 'devolucao') {
                await adjustExistencia(artigoId, -quantidade);
                await addMovimento({ artigoId, tipo: 'devolucao', quantidade, armazemId: a?.codigoArmazem, usuario: currentUser?.email, observacao: 'Devolução', data: hoje });
                showToast(`Devolução de ${fmt(quantidade)} un registada.`);
                return;
            }
        } catch {
            return; // #212 — erro já mostrado pelo interceptor global (api.ts); não confirma sucesso
        }
        showToast(`Guia de transporte emitida.`);
    };

    const totalArtigos = artigos.length;
    const criticos     = artigos.filter(a => a.critico && a.existencia <= a.stockSeguranca).length;
    const semStock     = artigos.filter(a => a.existencia === 0).length;
    const valorTotal   = artigos.reduce((s, a) => s + a.existencia * a.precoUnitario, 0);

    const stockLevel = (a: Artigo) => {
        if (a.existencia === 0) return 'zero';
        if (a.existencia <= a.stockSeguranca) return 'low';
        return 'ok';
    };

    return (
        <AppLayout>
            <ActionBar title="Stock" breadcrumb="AQUATEX SGI · Stock">
                <div className="actionbar-spacer" />
                <button className="abtn abtn-secondary" type="button" onClick={() => setShowExport(true)}>
                    <Download size={13} /> Exportar
                </button>
                <button className="abtn abtn-ghost" type="button" onClick={() => setOp('stats')}>
                    <BarChart2 size={13} /> Estatísticas
                </button>
                <button className="abtn abtn-ghost" type="button" onClick={() => setOp('inventario')}>
                    <Archive size={13} /> Inventário
                </button>
                <button className="abtn abtn-ghost" type="button" onClick={() => setOp('reposicao')}>
                    <ArrowDownCircle size={13} /> Reposição
                </button>
                <button className="abtn abtn-ghost" type="button" onClick={() => setOp('devolucao')}>
                    <ArrowUpCircle size={13} /> Devolução
                </button>
                <button className="abtn abtn-ghost" type="button" onClick={() => setOp('transferencia')}>
                    <RefreshCw size={13} /> Transferência
                </button>
                <button className="abtn abtn-primary" type="button" onClick={() => setModal('new')}>
                    <Plus size={13} /> Novo Artigo
                </button>
            </ActionBar>

            <div className="page-content">
                <div className="stats-row">
                    {[
                        { label: 'Total Artigos',  value: totalArtigos,         cls: 'blue' },
                        { label: 'Críticos/Baixo', value: criticos,             cls: 'red' },
                        { label: 'Sem Stock',      value: semStock,             cls: 'muted' },
                        { label: 'Valor Stock',    value: fmtMoney(valorTotal), cls: 'green' },
                    ].map(s => (
                        <div key={s.label} className="stat-card">
                            <span className="stat-label">{s.label}</span>
                            <span className={`stat-value ${s.cls}`} >{s.value}</span>
                        </div>
                    ))}
                </div>

                <div className="filters-bar">
                    <div className="search-wrap">
                        <Search className="search-icon" />
                        <input className="search-input" placeholder="Pesquisar por código, descrição ou família..."
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select className="filter-select" value={filterCls} onChange={e => setFCls(e.target.value)}>
                        <option value="">Todas as classes</option>
                        {classes.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select className="filter-select" value={filterFam} onChange={e => setFFam(e.target.value)}>
                        <option value="">Todas as famílias</option>
                        {familias.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <select className="filter-select" aria-label="Tipo de artigo" value={filterTipo} onChange={e => setFTipo(e.target.value as TipoArtigo | '')}>
                        <option value="">Todos os tipos</option>
                        <option value="PRODUTO">Produtos</option>
                        <option value="SERVICO">Serviços</option>
                    </select>
                </div>

                <div className="table-container">
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 20 }} />
                                    <th>Código</th>
                                    <th>Descrição</th>
                                    <th>Classe / Família</th>
                                    <th style={{ textAlign: 'right' }}>Existência</th>
                                    <th style={{ textAlign: 'right' }}>Reservado</th>
                                    <th style={{ textAlign: 'right' }}>Disponível</th>
                                    <th style={{ textAlign: 'right' }}>Enc.</th>
                                    <th style={{ textAlign: 'right' }}>Seg.</th>
                                    <th style={{ textAlign: 'right' }}>Preço Unit.</th>
                                    <th>Armazém</th>
                                    <th style={{ width: 80 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {loadingData && <TableSkeleton cols={12} />}
                                {!loadingData && filtered.length === 0 && (
                                    <tr><td colSpan={12}><EmptyState icon={<Package size={28} />} title="Nenhum artigo encontrado" description="Registe artigos no catálogo para gerir stock, encomendas e consumos." /></td></tr>
                                )}
                                {!loadingData && filtered.map(a => {
                                    const lvl = stockLevel(a);
                                    const saRows = stockArmazem.filter(sa => sa.artigoId === a.id);
                                    const isExpanded = expanded.has(a.id);
                                    const toggleExpand = () => setExpanded(prev => {
                                        const s = new Set(prev);
                                        s.has(a.id) ? s.delete(a.id) : s.add(a.id);
                                        return s;
                                    });
                                    return (
                                        <React.Fragment key={a.id}>
                                        <tr style={{ opacity: a.inativo ? 0.5 : 1 }}>
                                            <td style={{ paddingLeft: 6, width: 32 }}>
                                                {saRows.length > 0 ? (
                                                    <button onClick={toggleExpand} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center', gap: 2 }}>
                                                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                        <span className={`dot ${lvl === 'ok' ? 'dot-green' : lvl === 'low' ? 'dot-orange' : 'dot-red'}`} style={{ marginLeft: 2 }} />
                                                    </button>
                                                ) : (
                                                    <span className={`dot ${lvl === 'ok' ? 'dot-green' : lvl === 'low' ? 'dot-orange' : 'dot-red'}`} style={{ marginLeft: 8 }} />
                                                )}
                                            </td>
                                            <td>
                                                {a.imagem && (
                                                    <img src={a.imagem} alt="" style={{ width: 22, height: 22, objectFit: 'cover', borderRadius: 3, marginRight: 6, verticalAlign: 'middle', border: '1px solid var(--border)' }} />
                                                )}
                                                <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{a.codigo}</span>
                                                {a.critico && <Star size={10} style={{ color: 'var(--orange,#f97316)', marginLeft: 4, verticalAlign: 'middle' }} />}
                                            </td>
                                            <td style={{ fontWeight: 600, fontSize: '0.83rem' }}>
                                                {a.descricao}
                                                {/* #195 — Serviço (e retenção na fonte) */}
                                                {a.tipo === 'SERVICO' && (
                                                    <span title={a.sujeitoRetencao ? 'Serviço sujeito a retenção na fonte' : 'Serviço'} style={{ marginLeft: 6, fontSize: '0.66rem', fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'var(--blue-light,#EFF6FF)', color: 'var(--blue)', verticalAlign: 'middle' }}>
                                                        Serviço{a.sujeitoRetencao ? ' · Ret.' : ''}
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                                {a.classe}{a.familia ? ` / ${a.familia}` : ''}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.83rem',
                                                color: lvl === 'ok' ? 'var(--text-primary)' : lvl === 'low' ? 'var(--orange,#f97316)' : 'var(--red,#ef4444)' }}>
                                                {fmt(a.existencia)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontSize: '0.78rem', color: a.stockReservado > 0 ? 'var(--orange,#f97316)' : 'var(--text-muted)' }}>
                                                {fmt(a.stockReservado)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.83rem',
                                                color: (a.existencia - a.stockReservado) <= 0 ? 'var(--red,#ef4444)' : 'var(--text-primary)' }}>
                                                {fmt(a.existencia - a.stockReservado)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontSize: '0.78rem', color: a.stockEncomendado > 0 ? 'var(--blue)' : 'var(--text-muted)' }}>
                                                {fmt(a.stockEncomendado)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                {fmt(a.stockSeguranca)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontSize: '0.78rem' }}>
                                                {fmtMoney(a.precoUnitario, a.moeda)}
                                            </td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                {saRows.length > 1
                                                    ? <span style={{ color: 'var(--blue)', fontWeight: 600 }}>{saRows.length} armazéns</span>
                                                    : resolveArmazem(a.codigoArmazem)
                                                }
                                            </td>
                                            <td>
                                                <div className="row-actions">
                                                    <button className="icon-btn" title="Ver detalhes" onClick={() => setViewModal(a.id)}>
                                                        <Eye size={12} />
                                                    </button>
                                                    <button className="icon-btn" title="Editar" onClick={() => setModal(a.id)}>
                                                        <Edit2 size={12} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && saRows.map(sa => (
                                            <tr key={`sa-${sa.id}`} style={{ background: 'var(--bg-secondary, #f8fafc)' }}>
                                                <td style={{ paddingLeft: 28, borderLeft: '3px solid var(--blue)' }}>
                                                    <Warehouse size={11} style={{ color: 'var(--blue)', verticalAlign: 'middle' }} />
                                                </td>
                                                <td colSpan={2} style={{ fontSize: '0.78rem', paddingLeft: 6 }}>
                                                    <span style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: 'var(--text-muted)', marginRight: 6 }}>{sa.armazem.codigo}</span>
                                                    <span style={{ fontWeight: 600 }}>{sa.armazem.nome}</span>
                                                </td>
                                                <td />
                                                <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.82rem',
                                                    color: sa.quantidade <= sa.stockMinimo ? 'var(--red,#ef4444)' : 'var(--text-primary)' }}>
                                                    {fmt(sa.quantidade)}
                                                </td>
                                                <td colSpan={2} style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                    Disp: {fmt(Math.max(0, sa.quantidade))}
                                                </td>
                                                <td />
                                                <td style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                    {fmt(sa.stockMinimo)}
                                                </td>
                                                <td colSpan={3} />
                                            </tr>
                                        ))}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="table-count">{filtered.length} artigos</div>
                </div>
            </div>

            {/* Modals */}
            {viewModal !== null && (() => {
                const va = artigos.find(a => a.id === viewModal);
                return va ? (
                    <ArtigoViewModal
                        artigo={va}
                        onClose={() => setViewModal(null)}
                        onEdit={() => { setModal(va.id); setViewModal(null); }}
                    />
                ) : null;
            })()}
            {modal !== null && (
                <ArtigoModal artigo={editTarget} onClose={() => setModal(null)} onSave={handleSave} />
            )}
            {op === 'inventario' && (
                <InventarioModal artigos={artigos} armazens={armazens} onClose={() => setOp(null)} onConfirm={handleInventario} />
            )}
            {op === 'transferencia' && (
                <TransferenciaModal artigos={artigos} armazens={armazens} onClose={() => setOp(null)} onConfirm={handleTransferencia} />
            )}
            {(op === 'reposicao' || op === 'devolucao' || op === 'guia') && (
                <SimpleOpModal tipo={op} artigos={artigos} onClose={() => setOp(null)}
                    onConfirm={(tipo, id, qtd, nota) => handleSimpleOp(tipo, id, qtd)} />
            )}
            {op === 'stats' && (
                <StatsModal artigos={artigos} onClose={() => setOp(null)} />
            )}

            {showExport && (
                <ExportModal
                    title="Stock — Artigos"
                    columns={COLS_STOCK}
                    data={exportData}
                    filename="stock_artigos"
                    onClose={() => setShowExport(false)}
                />
            )}

        </AppLayout>
    );
};

export default StockPage;
