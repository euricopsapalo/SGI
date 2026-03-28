import React, { useState } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import ExportModal, { ExportCol } from '../../components/ExportModal';
import { useGlobal, Fornecedor, Encomenda, Artigo, EmpresaConfig, Provincia, Municipio } from '../../contexts/GlobalContext';
import { Search, Plus, Edit2, Eye, X, AlertCircle, Check, Truck, Download, Trash2, MapPin, Printer } from 'lucide-react';

/* ══ Print helpers ═══════════════════════════════════════════ */
const RF_CSS = `
  body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:0;padding:16px}
  h1{font-size:15px;margin:0 0 2px}h2{font-size:12px;margin:10px 0 4px;border-bottom:1px solid #ccc;padding-bottom:2px}
  table{width:100%;border-collapse:collapse;margin-bottom:12px}
  th{background:#f3f4f6;font-size:10px;text-transform:uppercase;padding:4px 6px;text-align:left;border:1px solid #d1d5db}
  td{padding:4px 6px;border:1px solid #e5e7eb;font-size:10px;vertical-align:top}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;border-bottom:2px solid #1d4ed8;padding-bottom:8px}
  .hdr-left h1{color:#1d4ed8}.sub{font-size:9px;color:#666;margin-top:1px}
  .badge{display:inline-block;padding:1px 7px;border-radius:8px;font-size:9px;font-weight:700}
  .badge-green{background:#d1fae5;color:#065f46}.badge-red{background:#fee2e2;color:#991b1b}
  .badge-blue{background:#dbeafe;color:#1e40af}.badge-gray{background:#f3f4f6;color:#6b7280}
  .kv{margin-bottom:3px}.kv span:first-child{font-weight:600;min-width:110px;display:inline-block;color:#374151}
  @media print{body{padding:0}button{display:none}}
`;

const fRF = (d?: string) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('pt-AO'); } catch { return d; }
};

const openPrintF = (html: string, title: string) => {
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>${RF_CSS}</style></head><body>${html}<script>window.onload=()=>window.print();<\/script></body></html>`);
    w.document.close();
};

const totalEnc = (e: Encomenda) => e.linhas.reduce((s, l) => s + l.custoUnit * l.qtdEncomendada * (1 - (l.desconto || 0) / 100), 0);

function buildFichaFornecedorHtml(f: Fornecedor, encs: Encomenda[], provinciaNome: string, municipioNome: string, empresa?: EmpresaConfig | null): string {
    const fEncs = encs.filter(e => String(e.fornecedorId) === String(f.id));
    const total = fEncs.reduce((s, e) => s + totalEnc(e), 0);
    const encRows = fEncs.map(e => `
        <tr>
            <td>${e.numero}</td><td>${fRF(e.data)}</td><td>${fRF(e.dataEntrega)}</td>
            <td>${e.linhas.length} artigo(s)</td>
            <td style="text-align:right">${totalEnc(e).toFixed(2)} ${e.moeda}</td>
            <td><span class="badge badge-${e.estado==='Recebida'?'green':e.estado==='Cancelada'?'red':e.estado==='Parcial'?'blue':'gray'}">${e.estado}</span></td>
        </tr>`).join('') || '<tr><td colspan="6" style="color:#999;text-align:center">Sem encomendas</td></tr>';

    return `
        <div class="hdr">
            <div class="hdr-left"><h1>${empresa?.nome || 'SGI'}</h1><div class="sub">${empresa?.morada || ''} · NIF: ${empresa?.nif || ''}</div></div>
            <div style="text-align:right"><h1>Ficha de Fornecedor</h1><div class="sub">Emitido em ${fRF(new Date().toISOString())}</div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin-bottom:12px">
            <div class="kv"><span>Nome / Razão Social</span>${f.nome}</div>
            <div class="kv"><span>NIF</span>${f.nif || '—'}</div>
            <div class="kv"><span>Telefone</span>${f.telefone || '—'}</div>
            <div class="kv"><span>Email</span>${f.email || '—'}</div>
            <div class="kv"><span>Morada</span>${f.morada || '—'}</div>
            <div class="kv"><span>Província / Município</span>${provinciaNome || '—'} / ${municipioNome || '—'}</div>
            <div class="kv"><span>Estado</span><span class="badge ${f.ativo?'badge-green':'badge-red'}">${f.ativo?'Activo':'Inactivo'}</span></div>
            <div class="kv"><span>Total Encomendado</span>${total.toFixed(2)} AOA</div>
        </div>
        <h2>Histórico de Encomendas</h2>
        <table><thead><tr><th>Nº</th><th>Data</th><th>Data Entrega</th><th>Artigos</th><th>Total</th><th>Estado</th></tr></thead>
        <tbody>${encRows}</tbody></table>`;
}

function printFichaFornecedor(f: Fornecedor, encs: Encomenda[], provinciaNome: string, municipioNome: string, empresa?: EmpresaConfig | null) {
    openPrintF(buildFichaFornecedorHtml(f, encs, provinciaNome, municipioNome, empresa), `Ficha Fornecedor - ${f.nome}`);
}

function buildFornecedoresPorCategoriaHtml(fors: Fornecedor[], encs: Encomenda[], artigos: Artigo[], provincias: Provincia[], municipios: Municipio[], empresa?: EmpresaConfig | null): string {
    // Group suppliers by the "classe" of articles they supply (from encomenda linhas)
    const forMap = new Map<string, { f: Fornecedor; classes: Set<string>; totalEncs: number }>();
    for (const f of fors) {
        const fEncs = encs.filter(e => String(e.fornecedorId) === String(f.id));
        const classes = new Set<string>();
        for (const enc of fEncs) {
            for (const l of enc.linhas) {
                const art = artigos.find(a => String(a.id) === String(l.artigoId));
                if (art?.classe) classes.add(art.classe);
            }
        }
        if (classes.size === 0) classes.add('Sem categoria');
        forMap.set(f.id, { f, classes, totalEncs: fEncs.length });
    }

    // Group by category
    const catMap = new Map<string, typeof fors>();
    for (const { f, classes } of Array.from(forMap.values())) {
        for (const cls of Array.from(classes)) {
            if (!catMap.has(cls)) catMap.set(cls, []);
            catMap.get(cls)!.push(f);
        }
    }

    const sections = Array.from(catMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([cat, fs]) => {
        const rows = fs.map(f => {
            const pNome = provincias.find(p => String(p.id) === String(f.provinciaId))?.nome ?? '—';
            const { totalEncs } = forMap.get(f.id)!;
            return `<tr>
                <td>${f.nome}</td><td style="font-family:monospace">${f.nif||'—'}</td>
                <td>${f.telefone||'—'}</td><td>${pNome}</td>
                <td style="text-align:center">${totalEncs}</td>
                <td><span class="badge ${f.ativo?'badge-green':'badge-gray'}">${f.ativo?'Activo':'Inactivo'}</span></td>
            </tr>`;
        }).join('');
        return `<h2>${cat} (${fs.length})</h2>
            <table><thead><tr><th>Nome</th><th>NIF</th><th>Telefone</th><th>Província</th><th>Encomendas</th><th>Estado</th></tr></thead>
            <tbody>${rows}</tbody></table>`;
    }).join('');

    return `
        <div class="hdr">
            <div class="hdr-left"><h1>${empresa?.nome || 'SGI'}</h1><div class="sub">${empresa?.morada || ''}</div></div>
            <div style="text-align:right"><h1>Fornecedores por Categoria</h1><div class="sub">Emitido em ${fRF(new Date().toISOString())}</div></div>
        </div>
        ${sections || '<p style="color:#999">Sem dados para apresentar.</p>'}`;
}

function printFornecedoresPorCategoria(fors: Fornecedor[], encs: Encomenda[], artigos: Artigo[], provincias: Provincia[], municipios: Municipio[], empresa?: EmpresaConfig | null) {
    openPrintF(buildFornecedoresPorCategoriaHtml(fors, encs, artigos, provincias, municipios, empresa), 'Fornecedores por Categoria');
}

function buildHistoricoComprasHtml(fors: Fornecedor[], encs: Encomenda[], dateFrom: string, dateTo: string, empresa?: EmpresaConfig | null): string {
    const from = dateFrom ? new Date(dateFrom) : null;
    const to   = dateTo   ? new Date(dateTo + 'T23:59:59') : null;
    const filtered = encs.filter(e => {
        const d = new Date(e.data);
        return (!from || d >= from) && (!to || d <= to);
    });
    const grandTotal = filtered.reduce((s, e) => s + totalEnc(e), 0);

    const sections = fors.map(f => {
        const fEncs = filtered.filter(e => String(e.fornecedorId) === String(f.id));
        if (fEncs.length === 0) return '';
        const forTotal = fEncs.reduce((s, e) => s + totalEnc(e), 0);
        const rows = fEncs.map(e => {
            const lineRows = e.linhas.map(l => `<tr>
                <td style="padding-left:20px">${l.codigo}</td><td>${l.descricao}</td>
                <td style="text-align:right">${l.qtdEncomendada} ${l.unidade}</td>
                <td style="text-align:right">${l.custoUnit.toFixed(2)}</td>
                <td style="text-align:right">${l.desconto||0}%</td>
                <td style="text-align:right">${(l.custoUnit * l.qtdEncomendada * (1-(l.desconto||0)/100)).toFixed(2)}</td>
            </tr>`).join('');
            return `<tr style="background:#f9fafb">
                <td colspan="2" style="font-weight:600">${e.numero} — ${fRF(e.data)} (Entrega: ${fRF(e.dataEntrega)})</td>
                <td colspan="3"><span class="badge badge-${e.estado==='Recebida'?'green':e.estado==='Cancelada'?'red':e.estado==='Parcial'?'blue':'gray'}">${e.estado}</span></td>
                <td style="text-align:right;font-weight:600">${totalEnc(e).toFixed(2)} ${e.moeda}</td>
            </tr>${lineRows}`;
        }).join('');
        return `<h2>${f.nome} — ${fEncs.length} encomenda(s) · Total: ${forTotal.toFixed(2)} AOA</h2>
            <table><thead><tr><th>Código</th><th>Descrição</th><th>Qtd</th><th>Custo Unit.</th><th>Desc.</th><th>Total</th></tr></thead>
            <tbody>${rows}</tbody></table>`;
    }).filter(Boolean).join('');

    const periodStr = (from || to) ? `Período: ${from ? fRF(from.toISOString()) : '—'} a ${to ? fRF(to.toISOString()) : '—'}` : 'Todo o período';

    return `
        <div class="hdr">
            <div class="hdr-left"><h1>${empresa?.nome || 'SGI'}</h1><div class="sub">${empresa?.morada || ''}</div></div>
            <div style="text-align:right"><h1>Histórico de Compras por Fornecedor</h1><div class="sub">${periodStr} · Total Geral: ${grandTotal.toFixed(2)} AOA</div></div>
        </div>
        ${sections || '<p style="color:#999">Sem encomendas no período seleccionado.</p>'}`;
}

function printHistoricoCompras(fors: Fornecedor[], encs: Encomenda[], dateFrom: string, dateTo: string, empresa?: EmpresaConfig | null) {
    openPrintF(buildHistoricoComprasHtml(fors, encs, dateFrom, dateTo, empresa), 'Histórico de Compras');
}

/* ══ Relatórios Modal ════════════════════════════════════════ */
type RelFornTipo = 'ficha' | 'categoria' | 'historico';
interface RelatoriosFornecedorModalProps {
    fornecedores: Fornecedor[];
    encomendas: Encomenda[];
    artigos: Artigo[];
    provincias: Provincia[];
    municipios: Municipio[];
    getProvinciaNome: (id?: string) => string;
    getMunicipioNome: (id?: string) => string;
    empresaConfig?: EmpresaConfig | null;
    onClose: () => void;
}
const RelatoriosFornecedorModal: React.FC<RelatoriosFornecedorModalProps> = ({
    fornecedores, encomendas, artigos, provincias, municipios, getProvinciaNome, getMunicipioNome, empresaConfig, onClose
}) => {
    const [tipo, setTipo] = useState<RelFornTipo>('ficha');
    const [fornecedorId, setFornecedorId] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [previewHtml, setPreviewHtml] = useState('');

    const buildHtml = (): string => {
        if (tipo === 'ficha') {
            const f = fornecedores.find(x => x.id === fornecedorId);
            if (!f) { alert('Seleccione um fornecedor.'); return ''; }
            return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${RF_CSS}</style></head><body>${buildFichaFornecedorHtml(f, encomendas, getProvinciaNome(f.provinciaId), getMunicipioNome(f.municipioId), empresaConfig)}</body></html>`;
        } else if (tipo === 'categoria') {
            return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${RF_CSS}</style></head><body>${buildFornecedoresPorCategoriaHtml(fornecedores, encomendas, artigos, provincias, municipios, empresaConfig)}</body></html>`;
        } else {
            return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${RF_CSS}</style></head><body>${buildHistoricoComprasHtml(fornecedores, encomendas, dateFrom, dateTo, empresaConfig)}</body></html>`;
        }
    };

    const handlePrint = () => {
        if (tipo === 'ficha') {
            const f = fornecedores.find(x => x.id === fornecedorId);
            if (!f) return alert('Seleccione um fornecedor.');
            printFichaFornecedor(f, encomendas, getProvinciaNome(f.provinciaId), getMunicipioNome(f.municipioId), empresaConfig);
        } else if (tipo === 'categoria') {
            printFornecedoresPorCategoria(fornecedores, encomendas, artigos, provincias, municipios, empresaConfig);
        } else {
            printHistoricoCompras(fornecedores, encomendas, dateFrom, dateTo, empresaConfig);
        }
    };

    const handlePreview = () => {
        const html = buildHtml();
        if (html) setPreviewHtml(html);
    };

    const tipos: { value: RelFornTipo; label: string; desc: string }[] = [
        { value: 'ficha',     label: 'Ficha de Fornecedor',          desc: 'Dados, contactos e histórico de encomendas de um fornecedor' },
        { value: 'categoria', label: 'Fornecedores por Categoria',   desc: 'Lista agrupada por categoria de artigos fornecidos'          },
        { value: 'historico', label: 'Histórico de Compras',         desc: 'Encomendas detalhadas por fornecedor num período'            },
    ];

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 480 }}>
                <div className="modal-header">
                    <h3 className="modal-title">Relatórios de Fornecedores</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body">
                    <div className="form-group">
                        <label className="form-label">Tipo de Relatório</label>
                        {tipos.map(t => (
                            <label key={t.value} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, cursor: 'pointer' }}>
                                <input type="radio" name="rel-forn" value={t.value} checked={tipo === t.value} onChange={() => setTipo(t.value)} style={{ marginTop: 3 }} />
                                <div>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.label}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.desc}</div>
                                </div>
                            </label>
                        ))}
                    </div>

                    {tipo === 'ficha' && (
                        <div className="form-group">
                            <label className="form-label req">Fornecedor</label>
                            <select className="form-select" value={fornecedorId} onChange={e => setFornecedorId(e.target.value)}>
                                <option value="">Seleccionar...</option>
                                {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                            </select>
                        </div>
                    )}

                    {tipo === 'historico' && (
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Data Início</label>
                                <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Data Fim</label>
                                <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                            </div>
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                    <button type="button" className="abtn abtn-secondary" onClick={handlePreview}><Eye size={13} /> Pré-visualizar</button>
                    <button type="button" className="abtn abtn-primary" onClick={handlePrint}><Printer size={13} /> Imprimir</button>
                </div>
            </div>
            {previewHtml && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 10000, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, fontWeight: 700, fontSize: '0.85rem' }}>Pré-visualização</span>
                        <button type="button" className="abtn abtn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Printer size={13} /> Imprimir
                        </button>
                        <button type="button" className="abtn abtn-secondary" onClick={() => setPreviewHtml('')}>
                            <X size={13} /> Fechar
                        </button>
                    </div>
                    <iframe srcDoc={previewHtml} title="Pré-visualização" style={{ flex: 1, border: 'none', background: '#fff' }} />
                </div>
            )}
        </div>
    );
};

/* ══ View Modal ══════════════════════════════════════════════ */
interface FornecedorViewModalProps {
    fornecedor: Fornecedor;
    provinciaNome: string;
    municipioNome: string;
    encomendasCount: number;
    onClose: () => void;
    onEdit: () => void;
}
const FornecedorViewModal: React.FC<FornecedorViewModalProps> = ({ fornecedor: f, provinciaNome, municipioNome, encomendasCount, onClose, onEdit }) => (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
                <h3 className="modal-title">Fornecedor</h3>
                <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
            </div>
            <div className="modal-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--blue-light,#eff6ff)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Truck size={18} style={{ color: 'var(--blue)' }} />
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{f.nome}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>NIF: {f.nif || '—'}</div>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', padding: '2px 8px', borderRadius: 10, background: f.ativo ? 'var(--green-light,#f0fdf4)' : 'var(--bg-secondary)', color: f.ativo ? 'var(--green)' : 'var(--text-muted)', fontWeight: 600 }}>
                        {f.ativo ? 'Activo' : 'Inactivo'}
                    </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                    {[
                        { label: 'Telefone', value: f.telefone || '—' },
                        { label: 'Email',    value: f.email || '—'    },
                        { label: 'Morada',   value: f.morada || '—', span: true },
                        { label: 'Província', value: provinciaNome || '—' },
                        { label: 'Município', value: municipioNome || '—' },
                        { label: 'Encomendas', value: String(encomendasCount) },
                    ].map(row => (
                        <div key={row.label} style={(row as any).span ? { gridColumn: '1 / -1' } : {}}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{row.label}</div>
                            <div style={{ fontSize: '0.83rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>{row.value}</div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="modal-footer">
                <button type="button" className="abtn abtn-secondary" onClick={onClose}>Fechar</button>
                <button type="button" className="abtn abtn-primary" onClick={onEdit}><Edit2 size={12} /> Editar</button>
            </div>
        </div>
    </div>
);

/* ══ Edit/Create Modal ══════════════════════════════════════ */
interface FornecedorModalProps {
    fornecedor?: Fornecedor;
    onClose: () => void;
    onSave: (f: Omit<Fornecedor, 'id'>) => void;
}
const FornecedorModal: React.FC<FornecedorModalProps> = ({ fornecedor, onClose, onSave }) => {
    const { provincias, municipios, condicoesPagamento, modosPagamento } = useGlobal();
    const [tab, setTab]             = useState<'geral' | 'comercial'>('geral');
    const [nome, setNome]           = useState(fornecedor?.nome       ?? '');
    const [nif, setNif]             = useState(fornecedor?.nif        ?? '');
    const [telefone, setTel]        = useState(fornecedor?.telefone   ?? '');
    const [email, setEmail]         = useState(fornecedor?.email      ?? '');
    const [morada, setMorada]       = useState(fornecedor?.morada     ?? '');
    const [ativo, setAtivo]         = useState(fornecedor?.ativo      ?? true);
    const [provinciaId, setProvId]  = useState(fornecedor?.provinciaId ? String(fornecedor.provinciaId) : '');
    const [municipioId, setMunId]   = useState(fornecedor?.municipioId ? String(fornecedor.municipioId) : '');
    const [condicaoPagId, setCondId] = useState(fornecedor?.condicaoPagamentoId ?? '');
    const [modoPagId, setModoId]    = useState(fornecedor?.modoPagamentoId ?? '');
    const [errors, setErrors]       = useState<Record<string, string>>({});

    const munsFiltrados = municipios.filter(m => m.provinciaId === provinciaId);

    const validate = () => {
        const e: Record<string, string> = {};
        if (!nome.trim()) e.nome = 'Obrigatório';
        if (!nif.trim())  e.nif  = 'Obrigatório';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSave = (ev: React.FormEvent) => {
        ev.preventDefault();
        if (!validate()) return;
        onSave({ nome, nif, telefone, email, morada, ativo, provinciaId: provinciaId || undefined, municipioId: municipioId || undefined, condicaoPagamentoId: condicaoPagId || undefined, modoPagamentoId: modoPagId || undefined });
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 520 }}>
                <div className="modal-header">
                    <h3 className="modal-title">{fornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
                    {(['geral', 'comercial'] as const).map(t => (
                        <button key={t} type="button" onClick={() => setTab(t)}
                            style={{ padding: '8px 14px', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer', borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent', color: tab === t ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: tab === t ? 600 : 400 }}>
                            {t === 'geral' ? 'Dados Gerais' : 'Dados Comerciais'}
                        </button>
                    ))}
                </div>
                <form onSubmit={handleSave} noValidate>
                    <div className="modal-body">
                        {tab === 'geral' && <>
                            <div className="form-group">
                                <label className="form-label req">Nome / Razão Social</label>
                                <input className={`form-input${errors.nome ? ' err' : ''}`} value={nome}
                                    onChange={e => setNome(e.target.value)} placeholder="Ex: Grundfos Angola, LDA" />
                                {errors.nome && <span className="form-error"><AlertCircle size={11} /> {errors.nome}</span>}
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label req">NIF</label>
                                    <input className={`form-input${errors.nif ? ' err' : ''}`} value={nif}
                                        onChange={e => setNif(e.target.value)} placeholder="5XXXXXXXXX" />
                                    {errors.nif && <span className="form-error"><AlertCircle size={11} /> {errors.nif}</span>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Telefone</label>
                                    <input className="form-input" value={telefone}
                                        onChange={e => setTel(e.target.value)} placeholder="222 XXX XXX" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input type="email" className="form-input" value={email}
                                    onChange={e => setEmail(e.target.value)} placeholder="comercial@empresa.ao" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Morada</label>
                                <input className="form-input" value={morada}
                                    onChange={e => setMorada(e.target.value)} placeholder="Rua, nº, Localidade" />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label"><MapPin size={11} style={{ verticalAlign: 'middle' }} /> Província</label>
                                    <select className="form-select" value={provinciaId}
                                        onChange={e => { setProvId(e.target.value); setMunId(''); }}>
                                        <option value="">Seleccionar...</option>
                                        {provincias.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Município</label>
                                    <select className="form-select" value={municipioId}
                                        onChange={e => setMunId(e.target.value)} disabled={!provinciaId}>
                                        <option value="">Seleccionar...</option>
                                        {munsFiltrados.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input type="checkbox" id="for-ativo" checked={ativo} onChange={e => setAtivo(e.target.checked)} style={{ width: 14, height: 14 }} />
                                <label htmlFor="for-ativo" style={{ fontSize: '0.82rem', color: 'var(--text-primary)', cursor: 'pointer' }}>Fornecedor activo</label>
                            </div>
                        </>}
                        {tab === 'comercial' && <>
                            <div className="form-group">
                                <label className="form-label">Condição de Pagamento</label>
                                <select className="form-select" value={condicaoPagId} onChange={e => setCondId(e.target.value)}>
                                    <option value="">Seleccionar...</option>
                                    {condicoesPagamento.map(c => <option key={c.id} value={c.id}>{c.descricao}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Modo de Pagamento</label>
                                <select className="form-select" value={modoPagId} onChange={e => setModoId(e.target.value)}>
                                    <option value="">Seleccionar...</option>
                                    {modosPagamento.map(m => <option key={m.id} value={m.id}>{m.movimento} — {m.descricao}</option>)}
                                </select>
                            </div>
                        </>}
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

/* ══ Page ════════════════════════════════════════════════ */
const FornecedoresPage: React.FC = () => {
    const { fornecedores, addFornecedor, updateFornecedor, removeFornecedor, encomendas, artigos, provincias, municipios, empresaConfig } = useGlobal();

    const [search, setSearch]         = useState('');
    const [modal, setModal]           = useState<'new' | string | null>(null);
    const [viewId, setViewId]         = useState<string | null>(null);
    const [toast, setToast]           = useState('');
    const [toastErr, setToastErr]     = useState('');
    const [showExport, setShowExport] = useState(false);
    const [showRelatorios, setShowRelatorios] = useState(false);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
    const showErr   = (msg: string) => { setToastErr(msg); setTimeout(() => setToastErr(''), 5000); };

    const handleRemove = async (id: string, nome: string) => {
        if (!window.confirm(`Eliminar o fornecedor "${nome}"? Esta acção não pode ser desfeita.`)) return;
        try {
            await removeFornecedor(id);
            showToast(`Fornecedor "${nome}" eliminado.`);
        } catch (e: any) {
            showErr(e?.response?.data?.message ?? 'Erro ao eliminar fornecedor.');
        }
    };

    const countEncomendas = (id: string) => encomendas.filter(e => e.fornecedorId === id).length;

    const getProvinciaNome = (id?: string) => provincias.find(p => String(p.id) === String(id))?.nome ?? '';
    const getMunicipioNome = (id?: string) => municipios.find(m => String(m.id) === String(id))?.nome ?? '';

    const filtered = fornecedores.filter(f => {
        const q = search.toLowerCase();
        return !q || f.nome.toLowerCase().includes(q) || f.nif.includes(q) || f.email.toLowerCase().includes(q);
    });

    const exportData = filtered.map(f => ({
        ...f,
        provincia: getProvinciaNome(f.provinciaId),
        municipio: getMunicipioNome(f.municipioId),
        estado: f.ativo ? 'Activo' : 'Inactivo',
    }));

    const ativos   = fornecedores.filter(f => f.ativo).length;
    const inativos = fornecedores.filter(f => !f.ativo).length;

    const editTarget = typeof modal === 'string' && modal !== 'new' ? fornecedores.find(f => f.id === modal) : undefined;
    const viewTarget = viewId ? fornecedores.find(f => f.id === viewId) : undefined;

    const handleSave = (data: Omit<Fornecedor, 'id'>) => {
        if (typeof modal === 'string' && modal !== 'new') {
            updateFornecedor(modal, data);
            showToast('Fornecedor actualizado.');
        } else {
            addFornecedor(data);
            showToast('Fornecedor registado.');
        }
        setModal(null);
    };

    const EXPORT_COLS: ExportCol[] = [
        { key: 'nome',      label: 'Nome / Razão Social' },
        { key: 'nif',       label: 'NIF'                 },
        { key: 'telefone',  label: 'Telefone'             },
        { key: 'email',     label: 'Email'                },
        { key: 'morada',    label: 'Morada'               },
        { key: 'provincia', label: 'Província'            },
        { key: 'municipio', label: 'Município'            },
        { key: 'estado',    label: 'Estado'               },
    ];

    return (
        <AppLayout>
            <ActionBar title="Fornecedores" breadcrumb="AQUATEX SGI · Fornecedores">
                <div className="actionbar-spacer" />
                <button className="abtn abtn-secondary" type="button" onClick={() => setShowRelatorios(true)}>
                    <Printer size={13} /> Relatórios
                </button>
                <button className="abtn abtn-secondary" type="button" onClick={() => setShowExport(true)}>
                    <Download size={13} /> Exportar
                </button>
                <button className="abtn abtn-primary" type="button" onClick={() => setModal('new')}>
                    <Plus size={13} /> Novo Fornecedor
                </button>
            </ActionBar>

            <div className="page-content">
                <div className="stats-row">
                    {[
                        { label: 'Activos',    value: ativos,          cls: 'green' },
                        { label: 'Inativos',   value: inativos,        cls: 'muted' },
                        { label: 'Encomendas', value: encomendas.length, cls: 'blue' },
                    ].map(s => (
                        <div key={s.label} className="stat-card">
                            <span className="stat-label">{s.label}</span>
                            <span className={`stat-value ${s.cls}`}>{s.value}</span>
                        </div>
                    ))}
                </div>

                <div className="filters-bar">
                    <div className="search-wrap">
                        <Search className="search-icon" />
                        <input className="search-input" placeholder="Pesquisar por nome, NIF ou email..."
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>

                <div className="table-container">
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 20 }} />
                                    <th>Nome / Razão Social</th>
                                    <th>NIF</th>
                                    <th>Telefone</th>
                                    <th>Email</th>
                                    <th>Morada</th>
                                    <th>Município</th>
                                    <th>Encomendas</th>
                                    <th style={{ width: 80 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr><td colSpan={9}><div className="empty-state"><Truck size={28} /><br />Nenhum fornecedor encontrado.</div></td></tr>
                                )}
                                {filtered.map(f => (
                                    <tr key={f.id} style={{ opacity: f.ativo ? 1 : 0.5 }}>
                                        <td style={{ paddingLeft: 10 }}>
                                            <span className={`dot ${f.ativo ? 'dot-green' : 'dot-gray'}`} />
                                        </td>
                                        <td style={{ fontWeight: 600, fontSize: '0.83rem' }}>{f.nome}</td>
                                        <td style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{f.nif}</td>
                                        <td style={{ fontSize: '0.78rem' }}>{f.telefone || '—'}</td>
                                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{f.email || '—'}</td>
                                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: 160 }}>{f.morada || '—'}</td>
                                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                            {getMunicipioNome(f.municipioId) || '—'}
                                        </td>
                                        <td style={{ fontSize: '0.78rem', textAlign: 'center' }}>
                                            <span style={{ background: 'var(--blue-light,#eff6ff)', color: 'var(--blue)', borderRadius: 10, padding: '2px 8px', fontSize: '0.75rem' }}>
                                                {countEncomendas(f.id)}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="row-actions">
                                                <button className="icon-btn" title="Pré-visualizar" onClick={() => setViewId(f.id)}>
                                                    <Eye size={12} />
                                                </button>
                                                <button className="icon-btn" title="Editar" onClick={() => setModal(f.id)}>
                                                    <Edit2 size={12} />
                                                </button>
                                                <button className="icon-btn icon-btn-danger" title="Eliminar" onClick={() => handleRemove(f.id, f.nome)}>
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="table-count">{filtered.length} fornecedores</div>
                </div>
            </div>

            {viewTarget && (
                <FornecedorViewModal
                    fornecedor={viewTarget}
                    provinciaNome={getProvinciaNome(viewTarget.provinciaId)}
                    municipioNome={getMunicipioNome(viewTarget.municipioId)}
                    encomendasCount={countEncomendas(viewTarget.id)}
                    onClose={() => setViewId(null)}
                    onEdit={() => { setModal(viewTarget.id); setViewId(null); }}
                />
            )}

            {modal !== null && (
                <FornecedorModal
                    fornecedor={editTarget}
                    onClose={() => setModal(null)}
                    onSave={handleSave}
                />
            )}

            {toast && (
                <div className="toast" role="status">
                    <Check size={14} strokeWidth={2.5} style={{ color: 'var(--green)' }} />
                    <span>{toast}</span>
                </div>
            )}
            {toastErr && (
                <div className="toast" role="alert" style={{ background: 'var(--red,#ef4444)', color: '#fff' }}>
                    <AlertCircle size={14} />
                    <span>{toastErr}</span>
                </div>
            )}

            {showRelatorios && (
                <RelatoriosFornecedorModal
                    fornecedores={fornecedores}
                    encomendas={encomendas}
                    artigos={artigos}
                    provincias={provincias}
                    municipios={municipios}
                    getProvinciaNome={getProvinciaNome}
                    getMunicipioNome={getMunicipioNome}
                    empresaConfig={empresaConfig}
                    onClose={() => setShowRelatorios(false)}
                />
            )}

            {showExport && (
                <ExportModal
                    title="Fornecedores"
                    columns={EXPORT_COLS}
                    data={exportData}
                    filename="fornecedores"
                    onClose={() => setShowExport(false)}
                />
            )}
        </AppLayout>
    );
};

export default FornecedoresPage;
