import React, { useState, useRef } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import SearchableSelect from '../../components/SearchableSelect';
import { useGlobal, Artigo, Armazem } from '../../contexts/GlobalContext';
import {
    Search, Plus, Edit2, X, AlertCircle, Check, Package, Download,
    BarChart2, ArrowDownCircle, ArrowUpCircle, RefreshCw,
    Truck, Archive, Star, FileText, Image as ImageIcon, Trash2,
} from 'lucide-react';
import ExportModal, { ExportCol } from '../../components/ExportModal';

/* ══ Helpers ════════════════════════════════════════════════ */
const fmt      = (n: number) => n.toLocaleString('pt-PT');
const fmtMoney = (n: number, m = 'AOA') => `${fmt(n)} ${m}`;

const COLS_STOCK: ExportCol[] = [
    { key: 'codigo',         label: 'Código' },
    { key: 'descricao',      label: 'Descrição' },
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
    onSave: (a: Omit<Artigo, 'id'>) => void;
}
const TABS_A = [
    { id: 'ident', label: 'Identificação' },
    { id: 'preco', label: 'Preço' },
    { id: 'arm',   label: 'Armazém' },
    { id: 'obs',   label: 'Observação' },
] as const;
type ATab = typeof TABS_A[number]['id'];

const ArtigoModal: React.FC<ArtigoModalProps> = ({ artigo, onClose, onSave }) => {
    const { armazens } = useGlobal();
    const [tab, setTab] = useState<ATab>('ident');

    // Identificação
    const [codigo,    setCodigo]    = useState(artigo?.codigo    ?? '');
    const [descricao, setDescricao] = useState(artigo?.descricao ?? '');
    const [classe,    setClasse]    = useState(artigo?.classe    ?? '');
    const [familia,   setFamilia]   = useState(artigo?.familia   ?? '');
    const [imagem,    setImagem]    = useState(artigo?.imagem    ?? '');

    // Preço
    const [precoUnitario, setPreco] = useState(String(artigo?.precoUnitario ?? ''));
    const [moeda, setMoeda]         = useState(artigo?.moeda ?? 'AOA');

    // Armazém
    const [existencia,     setExist]   = useState(String(artigo?.existencia     ?? '0'));
    const [nivelMaximo,    setNMax]    = useState(String(artigo?.nivelMaximo    ?? ''));
    const [stockSeguranca, setSeg]     = useState(String(artigo?.stockSeguranca ?? ''));
    const [custoMedio,     setCusto]   = useState(String(artigo?.custoMedio     ?? ''));
    const [codigoArmazem,  setArmazem] = useState(artigo?.codigoArmazem ?? 'ARM-01');
    const [inativo,        setInativo] = useState(artigo?.inativo  ?? false);
    const [critico,        setCritico] = useState(artigo?.critico  ?? false);

    // Observação
    const [observacao, setObs] = useState(artigo?.observacao ?? '');

    const [errors, setErrors] = useState<Record<string, string>>({});
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
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSave = (ev: React.FormEvent) => {
        ev.preventDefault();
        if (!validate()) return;
        onSave({
            codigo, descricao, classe, familia, imagem,
            precoUnitario: Number(precoUnitario), moeda,
            existencia: Number(existencia), nivelMaximo: Number(nivelMaximo),
            stockSeguranca: Number(stockSeguranca), custoMedio: Number(custoMedio),
            codigoArmazem, inativo, critico, observacao,
        });
    };

    const tabErr = (t: ATab) => {
        if (t === 'ident') return !!(errors.codigo || errors.descricao);
        if (t === 'preco') return !!errors.preco;
        return false;
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 620 }}>
                <div className="modal-header">
                    <h3 className="modal-title">{artigo ? 'Editar Artigo' : 'Novo Artigo'}</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
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
                        {tab === 'ident' && (<>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label req">Código</label>
                                    <input className={`form-input${errors.codigo ? ' err' : ''}`} value={codigo}
                                        onChange={e => setCodigo(e.target.value)} placeholder="ART-001" />
                                    {errors.codigo && <span className="form-error"><AlertCircle size={11} /> {errors.codigo}</span>}
                                </div>
                                <div className="form-group" style={{ flex: 2 }}>
                                    <label className="form-label req">Descrição</label>
                                    <input className={`form-input${errors.descricao ? ' err' : ''}`} value={descricao}
                                        onChange={e => setDescricao(e.target.value)} placeholder="Descrição do artigo" />
                                    {errors.descricao && <span className="form-error"><AlertCircle size={11} /> {errors.descricao}</span>}
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Classe</label>
                                    <input className="form-input" value={classe}
                                        onChange={e => setClasse(e.target.value)} placeholder="Ex: Consumível" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Família</label>
                                    <input className="form-input" value={familia}
                                        onChange={e => setFamilia(e.target.value)} placeholder="Ex: Filtros" />
                                </div>
                            </div>
                            {/* Image upload + preview */}
                            <div className="form-group">
                                <label className="form-label">Imagem do Artigo</label>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                    <div style={{
                                        width: 90, height: 90, border: '1px solid var(--border)',
                                        borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: 'var(--bg-subtle,#f8fafc)', flexShrink: 0, overflow: 'hidden',
                                    }}>
                                        {imagem
                                            ? <img src={imagem} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : <ImageIcon size={28} style={{ color: 'var(--text-muted)' }} />
                                        }
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                                            onChange={handleImageFile} />
                                        <button type="button" className="abtn abtn-secondary" onClick={() => fileRef.current?.click()}>
                                            <ImageIcon size={12} /> Carregar imagem
                                        </button>
                                        {imagem && (
                                            <button type="button" className="abtn abtn-ghost" style={{ color: 'var(--red,#ef4444)' }}
                                                onClick={() => { setImagem(''); if (fileRef.current) fileRef.current.value = ''; }}>
                                                <Trash2 size={12} /> Remover
                                            </button>
                                        )}
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                            JPG, PNG, WEBP — máx 2 MB
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </>)}

                        {/* ── Preço ── */}
                        {tab === 'preco' && (<>
                            <div className="form-row">
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
                            </div>
                            <div className="form-group">
                                <label className="form-label">Custo Médio</label>
                                <input type="number" min={0} step="0.01" className="form-input"
                                    value={custoMedio} onChange={e => setCusto(e.target.value)} />
                            </div>
                            <div style={{ background: 'var(--bg-subtle,#f8fafc)', borderRadius: 8, padding: '12px 14px', marginTop: 8 }}>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Previsão valor em stock</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--blue)', marginTop: 4 }}>
                                    {fmtMoney(Number(precoUnitario || 0) * Number(existencia || 0), moeda)}
                                </div>
                            </div>
                        </>)}

                        {/* ── Armazém ── */}
                        {tab === 'arm' && (<>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Existência Actual</label>
                                    <input type="number" min={0} className="form-input"
                                        value={existencia} onChange={e => setExist(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Nível Máximo</label>
                                    <input type="number" min={0} className="form-input"
                                        value={nivelMaximo} onChange={e => setNMax(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Stock Segurança</label>
                                    <input type="number" min={0} className="form-input"
                                        value={stockSeguranca} onChange={e => setSeg(e.target.value)} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Código Armazém</label>
                                <select className="form-select" value={codigoArmazem}
                                    onChange={e => setArmazem(e.target.value)}>
                                    {armazens.filter(a => a.ativo).map(a => <option key={a.id} value={a.id}>{a.codigo} — {a.nome}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={critico} onChange={e => setCritico(e.target.checked)} style={{ width: 14, height: 14 }} />
                                    Artigo crítico (alerta quando abaixo do segurança)
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={inativo} onChange={e => setInativo(e.target.checked)} style={{ width: 14, height: 14 }} />
                                    Inactivo
                                </label>
                            </div>
                            {Number(nivelMaximo) > 0 && (
                                <div style={{ marginTop: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                                        <span>0</span><span>{fmt(Number(existencia))}</span><span>{fmt(Number(nivelMaximo))}</span>
                                    </div>
                                    <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', borderRadius: 4,
                                            width: `${Math.min(100, (Number(existencia) / Number(nivelMaximo)) * 100)}%`,
                                            background: Number(existencia) <= Number(stockSeguranca) ? 'var(--red,#ef4444)' : 'var(--green)',
                                        }} />
                                    </div>
                                </div>
                            )}
                        </>)}

                        {/* ── Observação ── */}
                        {tab === 'obs' && (
                            <div className="form-group">
                                <label className="form-label">Observações</label>
                                <textarea className="form-input" rows={6} style={{ resize: 'vertical' }}
                                    value={observacao} onChange={e => setObs(e.target.value)}
                                    placeholder="Notas internas sobre este artigo..." />
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="abtn abtn-primary"><Check size={12} /> Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ══ Inventário Modal (multi-article) ═══════════════════════ */
interface InventLine { artigoId: string; novaExist: string; }

interface InventarioModalProps {
    artigos: Artigo[];
    onClose: () => void;
    onConfirm: (lines: InventLine[]) => void;
}

const printInventSheet = (artigos: Artigo[], lines: InventLine[]) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const rows = lines.map(l => {
        const a = artigos.find(x => x.id === l.artigoId);
        if (!a) return '';
        return `<tr>
            <td>${a.codigo}</td>
            <td>${a.descricao}</td>
            <td>${a.codigoArmazem}</td>
            <td style="text-align:right">${a.existencia}</td>
            <td></td>
            <td></td>
        </tr>`;
    }).join('');
    w.document.write(`<!DOCTYPE html>
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
<script>window.onload = () => { window.print(); }</script>
</body></html>`);
    w.document.close();
};

const InventarioModal: React.FC<InventarioModalProps> = ({ artigos, onClose, onConfirm }) => {
    const [search, setSearch] = useState('');
    const [lines, setLines]   = useState<InventLine[]>(
        artigos.filter(a => !a.inativo).map(a => ({ artigoId: a.id, novaExist: String(a.existencia) }))
    );
    const [selected, setSelected] = useState<Set<string>>(new Set(artigos.filter(a => !a.inativo).map(a => a.id)));

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
            <div className="modal" style={{ maxWidth: 720 }}>
                <div className="modal-header">
                    <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Archive size={14} /> Inventário de Stock
                    </h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body" style={{ padding: 0 }}>
                    <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                        <div className="search-wrap" style={{ flex: 1 }}>
                            <Search className="search-icon" />
                            <input className="search-input" placeholder="Pesquisar artigo..."
                                value={search} onChange={e => setSearch(e.target.value)} />
                        </div>
                        <button type="button" className="abtn abtn-secondary"
                            onClick={() => printInventSheet(artigos, selectedLines)}
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
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{a.codigoArmazem}</td>
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
    onConfirm: (de: string, para: string, lines: TransfLine[]) => void;
}

const TransferenciaModal: React.FC<TransferenciaModalProps> = ({ artigos, armazens, onClose, onConfirm }) => {
    const [armazDe,   setArmazDe]   = useState('ARM-01');
    const [armazPara, setArmazPara] = useState('ARM-02');
    const [lines, setLines]         = useState<TransfLine[]>([]);

    const artigoOpts = artigos.filter(a => !a.inativo && a.codigoArmazem === armazDe).map(a => ({
        value: a.id, label: a.descricao,
        sub: `${a.codigo} · Stk: ${fmt(a.existencia)}`,
    }));

    const addLine = () => setLines(ls => [...ls, { artigoId: '', qtd: '1' }]);
    const removeLine = (i: number) => setLines(ls => ls.filter((_, j) => j !== i));
    const setLine = (i: number, field: 'artigoId' | 'qtd', val: string) =>
        setLines(ls => ls.map((l, j) => j === i ? { ...l, [field]: val } : l));

    const handleConfirm = () => {
        const valid = lines.filter(l => l.artigoId && Number(l.qtd) > 0);
        if (valid.length === 0) return;
        onConfirm(armazDe, armazPara, valid);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 620 }}>
                <div className="modal-header">
                    <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <RefreshCw size={14} /> Transferência entre Armazéns
                    </h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body">
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label req">Armazém de Origem</label>
                            <select className="form-select" value={armazDe} onChange={e => { setArmazDe(e.target.value); setLines([]); }}>
                                {armazens.filter(a => a.ativo).map(a => <option key={a.id} value={a.id}>{a.codigo} — {a.nome}</option>)}
                            </select>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', paddingTop: 20, fontSize: '1.2rem', color: 'var(--text-muted)' }}>→</div>
                        <div className="form-group">
                            <label className="form-label req">Armazém de Destino</label>
                            <select className="form-select" value={armazPara} onChange={e => setArmazPara(e.target.value)}>
                                {armazens.filter(a => a.ativo && a.id !== armazDe).map(a => <option key={a.id} value={a.id}>{a.codigo} — {a.nome}</option>)}
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
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                            Disponível: {fmt(artigo.existencia)} un
                                        </div>
                                    )}
                                </div>
                                <div style={{ width: 100 }}>
                                    <input type="number" min={1} max={artigo?.existencia ?? 9999}
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
                        disabled={lines.filter(l => l.artigoId && Number(l.qtd) > 0).length === 0}
                        onClick={handleConfirm}>
                        <Check size={12} /> Confirmar Transferência
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
    const [artigoId, setArtigoId] = useState('');
    const [quantidade, setQtd]   = useState('');
    const [nota, setNota]        = useState('');
    const cfg = SIMPLE_OP_LABELS[tipo];
    const artigo = artigos.find(a => a.id === artigoId);
    const artigoOpts = artigos.map(a => ({ value: a.id, label: a.descricao, sub: `${a.codigo} · ${fmt(a.existencia)} un` }));

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 480 }}>
                <div className="modal-header">
                    <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {cfg.icon} {cfg.titulo}
                    </h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
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
    const totalValor = artigos.reduce((s, a) => s + a.existencia * a.precoUnitario, 0);
    const criticos   = artigos.filter(a => a.critico && a.existencia <= a.stockSeguranca);
    const abaixoSeg  = artigos.filter(a => a.existencia <= a.stockSeguranca);
    const semStock   = artigos.filter(a => a.existencia === 0);

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 520 }}>
                <div className="modal-header">
                    <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BarChart2 size={14} /> Estatísticas de Stock
                    </h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
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
    const { artigos, addArtigo, updateArtigo, adjustExistencia, armazens, addMovimento, currentUser } = useGlobal();

    const [search,    setSearch]  = useState('');
    const [filterCls, setFCls]    = useState('');
    const [filterFam, setFFam]    = useState('');
    const [modal,     setModal]   = useState<'new' | string | null>(null);
    const [op,         setOp]       = useState<OpState>(null);
    const [toast,      setToast]   = useState('');
    const [showExport, setShowExport] = useState(false);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    const classes  = Array.from(new Set(artigos.map(a => a.classe).filter(Boolean)));
    const familias = Array.from(new Set(artigos.map(a => a.familia).filter(Boolean)));

    const filtered = artigos.filter(a => {
        const q = search.toLowerCase();
        return (!q || a.codigo.toLowerCase().includes(q) || a.descricao.toLowerCase().includes(q) || a.familia.toLowerCase().includes(q))
            && (!filterCls || a.classe  === filterCls)
            && (!filterFam || a.familia === filterFam);
    });

    const exportData = filtered.map(a => ({ ...a, critico: a.critico ? 'Sim' : 'Não' }));

    const editTarget = typeof modal === 'string' && modal !== 'new' ? artigos.find(a => a.id === modal) : undefined;

    const handleSave = (data: Omit<Artigo, 'id'>) => {
        if (typeof modal === 'string' && modal !== 'new') {
            updateArtigo(modal, data);
            showToast('Artigo actualizado.');
        } else {
            const a = addArtigo(data);
            showToast(`Artigo ${a.codigo} registado.`);
        }
        setModal(null);
    };

    const handleInventario = (lines: InventLine[]) => {
        const hoje = new Date().toISOString().split('T')[0];
        let count = 0;
        lines.forEach(l => {
            const a = artigos.find(x => x.id === l.artigoId);
            if (a) {
                const delta = Number(l.novaExist) - a.existencia;
                adjustExistencia(l.artigoId, delta);
                addMovimento({ artigoId: l.artigoId, tipo: 'ajuste', quantidade: delta, armazemId: a.codigoArmazem, usuario: currentUser?.email, observacao: 'Ajuste de inventário', data: hoje });
                count++;
            }
        });
        showToast(`Inventário actualizado — ${count} artigo(s) ajustado(s).`);
    };

    const handleTransferencia = (de: string, para: string, lines: TransfLine[]) => {
        const hoje = new Date().toISOString().split('T')[0];
        lines.forEach(l => {
            const qtd = Number(l.qtd);
            adjustExistencia(l.artigoId, -qtd);
            updateArtigo(l.artigoId, { codigoArmazem: para });
            addMovimento({ artigoId: l.artigoId, tipo: 'transferencia', quantidade: qtd, armazemId: de, armazemDestinoId: para, usuario: currentUser?.email, observacao: `Transferência ${de} → ${para}`, data: hoje });
        });
        showToast(`Transferência ${de} → ${para} registada (${lines.length} artigo(s)).`);
    };

    const handleSimpleOp = (tipo: SimpleOpType, artigoId: string, quantidade: number) => {
        const hoje = new Date().toISOString().split('T')[0];
        const a = artigos.find(x => x.id === artigoId);
        if (tipo === 'reposicao') {
            adjustExistencia(artigoId, quantidade);
            addMovimento({ artigoId, tipo: 'entrada', quantidade, armazemId: a?.codigoArmazem, usuario: currentUser?.email, observacao: 'Reposição manual', data: hoje });
            showToast(`Reposição de ${fmt(quantidade)} un registada.`);
        } else if (tipo === 'devolucao') {
            adjustExistencia(artigoId, -quantidade);
            addMovimento({ artigoId, tipo: 'devolucao', quantidade, armazemId: a?.codigoArmazem, usuario: currentUser?.email, observacao: 'Devolução', data: hoje });
            showToast(`Devolução de ${fmt(quantidade)} un registada.`);
        } else {
            showToast(`Guia de transporte emitida.`);
        }
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
                                    <th style={{ textAlign: 'right' }}>Seg.</th>
                                    <th style={{ textAlign: 'right' }}>Preço Unit.</th>
                                    <th>Armazém</th>
                                    <th style={{ width: 80 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr><td colSpan={9}><div className="empty-state"><Package size={28} /><br />Nenhum artigo encontrado.</div></td></tr>
                                )}
                                {filtered.map(a => {
                                    const lvl = stockLevel(a);
                                    return (
                                        <tr key={a.id} style={{ opacity: a.inativo ? 0.5 : 1 }}>
                                            <td style={{ paddingLeft: 10 }}>
                                                <span className={`dot ${lvl === 'ok' ? 'dot-green' : lvl === 'low' ? 'dot-orange' : 'dot-red'}`} />
                                            </td>
                                            <td>
                                                {a.imagem && (
                                                    <img src={a.imagem} alt="" style={{ width: 22, height: 22, objectFit: 'cover', borderRadius: 3, marginRight: 6, verticalAlign: 'middle', border: '1px solid var(--border)' }} />
                                                )}
                                                <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{a.codigo}</span>
                                                {a.critico && <Star size={10} style={{ color: 'var(--orange,#f97316)', marginLeft: 4, verticalAlign: 'middle' }} />}
                                            </td>
                                            <td style={{ fontWeight: 600, fontSize: '0.83rem' }}>{a.descricao}</td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                                {a.classe}{a.familia ? ` / ${a.familia}` : ''}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.83rem',
                                                color: lvl === 'ok' ? 'var(--text-primary)' : lvl === 'low' ? 'var(--orange,#f97316)' : 'var(--red,#ef4444)' }}>
                                                {fmt(a.existencia)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                {fmt(a.stockSeguranca)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontSize: '0.78rem' }}>
                                                {fmtMoney(a.precoUnitario, a.moeda)}
                                            </td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                {a.codigoArmazem}
                                            </td>
                                            <td>
                                                <div className="row-actions">
                                                    <button className="icon-btn" title="Editar" onClick={() => setModal(a.id)}>
                                                        <Edit2 size={12} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="table-count">{filtered.length} artigos</div>
                </div>
            </div>

            {/* Modals */}
            {modal !== null && (
                <ArtigoModal artigo={editTarget} onClose={() => setModal(null)} onSave={handleSave} />
            )}
            {op === 'inventario' && (
                <InventarioModal artigos={artigos} onClose={() => setOp(null)} onConfirm={handleInventario} />
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

            {toast && (
                <div className="toast" role="status">
                    <Check size={14} strokeWidth={2.5} style={{ color: 'var(--green)' }} />
                    <span>{toast}</span>
                </div>
            )}
        </AppLayout>
    );
};

export default StockPage;
