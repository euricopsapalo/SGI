import React, { useState, useRef } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import SearchableSelect from '../../components/SearchableSelect';
import {
    useGlobal, EMPRESA_INFO,
    Fatura, FaturaEstado, FaturaLinha, EmpresaConfig,
} from '../../contexts/GlobalContext';
import {
    Search, Plus, X, Printer, Check, AlertCircle, FileText, Filter, Download,
    ChevronDown,
} from 'lucide-react';
import ExportModal, { ExportCol } from '../../components/ExportModal';

/* ── Helpers ── */
const fmtDate  = (iso?: string) => iso ? new Date(iso).toLocaleDateString('pt-PT') : '—';
const fmtMoney = (v: number, m = 'AOA') => `${v.toLocaleString('pt-PT')} ${m}`;

const ESTADO_DOT: Record<FaturaEstado, string> = {
    Pendente: 'dot-orange', Paga: 'dot-green', Anulada: 'dot-gray', Emitido: 'dot-blue',
};
const ESTADO_BADGE: Record<FaturaEstado, { bg: string; color: string }> = {
    Pendente: { bg: '#FFF3E0', color: '#E65100' },
    Paga:     { bg: '#E8F5E9', color: '#2E7D32' },
    Anulada:  { bg: '#ECEFF1', color: '#546E7A' },
    Emitido:  { bg: '#EFF6FF', color: '#1565C0' },
};

/* ══ Emitir Documento Modal ═════════════════════════════════ */
interface EmitirModalProps { onClose: () => void; onSave: (f: Omit<Fatura, 'id'>) => void; }

const EmitirDocumentoModal: React.FC<EmitirModalProps> = ({ onClose, onSave }) => {
    const { ordens, clientes, artigos, equipInstalados, tiposDocumento, taxaIvaGlobal, empresaConfig } = useGlobal();

    const [tipoDoc,       setTipoDoc]    = useState(tiposDocumento[0]?.codigo ?? 'FAT');
    const [otId,          setOtId]       = useState('');
    const [linhas,        setLinhas]     = useState<FaturaLinha[]>([]);
    const [clienteId,     setClienteId]  = useState('');
    const [fpLinhas,      setFpLinhas]   = useState<(FaturaLinha & { artigoId: string })[]>([]);
    const taxaIva = taxaIvaGlobal;
    const [observacoes,   setObs]        = useState('');
    const [errors,        setErrors]     = useState<Record<string, string>>({});

    const isFAT = tipoDoc === 'FAT';
    const isFP  = tipoDoc === 'FP';

    const otOpts = ordens
        .filter(o => o.estado === 'Terminado' || o.estado === 'Encerrado')
        .map(o => {
            const cli = clientes.find(c => c.id === o.clienteId);
            return { value: o.id, label: `${o.id} — ${cli?.nome ?? o.clienteId}`, sub: o.tipoTrabalho };
        });

    const clienteOpts = clientes.filter(c => c.ativo).map(c => ({ value: c.id, label: c.nome, sub: c.nif }));
    const artigoOpts  = artigos.filter(a => !a.inativo && a.existencia > 0).map(a => ({
        value: a.id, label: a.descricao, sub: `${a.codigo} · Stock: ${a.existencia}`,
    }));

    const otSelected  = ordens.find(o => o.id === otId);
    const otClienteId = otSelected?.clienteId ?? '';

    const totalLinhasFAT = linhas.reduce((s, l) => s + l.quantidade * l.precoUnit, 0);
    const subtotalFAT    = totalLinhasFAT;
    const subtotalFP     = fpLinhas.reduce((s, l) => s + l.quantidade * l.precoUnit, 0);
    const subtotal       = isFAT ? subtotalFAT : subtotalFP;
    const ivaVal         = Math.round(subtotal * Number(taxaIva) / 100);
    const total          = subtotal + ivaVal;
    const hoje           = new Date().toISOString().split('T')[0];

    const addLinha    = () => setLinhas(p => [...p, { descricao: '', quantidade: 1, precoUnit: 0 }]);
    const removeLinha = (i: number) => setLinhas(p => p.filter((_, j) => j !== i));
    const updateLinha = <K extends keyof FaturaLinha>(i: number, k: K, v: FaturaLinha[K]) =>
        setLinhas(p => p.map((l, j) => j === i ? { ...l, [k]: v } : l));

    const addFpLinha    = () => setFpLinhas(p => [...p, { artigoId: '', descricao: '', quantidade: 1, precoUnit: 0 }]);
    const removeFpLinha = (i: number) => setFpLinhas(p => p.filter((_, j) => j !== i));
    const updateFpArtigo = (i: number, artigoId: string) => {
        const a = artigos.find(x => x.id === artigoId);
        if (!a) return;
        setFpLinhas(p => p.map((l, j) => j === i ? { ...l, artigoId, descricao: a.descricao, precoUnit: a.precoUnitario, quantidade: 1 } : l));
    };
    const updateFpLinha = <K extends keyof FaturaLinha>(i: number, k: K, v: FaturaLinha[K]) =>
        setFpLinhas(p => p.map((l, j) => j === i ? { ...l, [k]: v } : l));

    const validate = () => {
        const e: Record<string, string> = {};
        if (isFAT) {
            if (!otId) e.ot = 'Seleccione uma Ordem de Trabalho';
        }
        if (isFP) {
            if (!clienteId)              e.cliente = 'Seleccione um cliente';
            if (fpLinhas.length === 0)   e.linhas  = 'Adicione pelo menos um artigo';
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const getNrSerie = (ot?: typeof otSelected) => {
        if (!ot?.equipInstaladoId) return undefined;
        return equipInstalados.find(e => e.id === ot.equipInstaladoId)?.nrSerie;
    };

    const handleSubmit = (ev: React.FormEvent) => {
        ev.preventDefault();
        if (!validate()) return;

        if (isFAT) {
            const allLinhas: FaturaLinha[] = linhas.filter(l => l.descricao.trim());
            onSave({
                tipoDocumento: tipoDoc, otId, clienteId: otClienteId,
                dataEmissao: hoje, linhas: allLinhas,
                precoServico: 0, taxaIva: taxaIva,
                valorSubtotal: subtotal, valorIva: ivaVal, valorTotal: total,
                moeda: empresaConfig.moeda, estado: 'Pendente',
                observacoes, nrSerieEquip: getNrSerie(otSelected),
            });
        } else {
            const allLinhas: FaturaLinha[] = fpLinhas.map(l => ({ descricao: l.descricao, quantidade: l.quantidade, precoUnit: l.precoUnit }));
            onSave({
                tipoDocumento: tipoDoc, otId: 'N/A', clienteId,
                dataEmissao: hoje, linhas: allLinhas,
                precoServico: 0, taxaIva: taxaIva,
                valorSubtotal: subtotal, valorIva: ivaVal, valorTotal: total,
                moeda: empresaConfig.moeda, estado: 'Emitido',
                observacoes,
            });
        }
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 620 }}>
                <div className="modal-header">
                    <h3 className="modal-title">Emitir Documento</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <form onSubmit={handleSubmit} noValidate>
                    <div className="modal-body" style={{ maxHeight: '68vh', overflowY: 'auto' }}>

                        {/* Tipo de Documento */}
                        <div className="form-group">
                            <label className="form-label req">Tipo de Documento</label>
                            <select className="form-select" value={tipoDoc} onChange={e => { setTipoDoc(e.target.value); setErrors({}); setOtId(''); setClienteId(''); setFpLinhas([]); setLinhas([]); }}>
                                {tiposDocumento.map(t => <option key={t.id} value={t.codigo}>{t.codigo} — {t.descricao}</option>)}
                            </select>
                        </div>

                        {/* ── FAT: OT select ── */}
                        {isFAT && (<>
                            <div className="form-group">
                                <label className="form-label req">Ordem de Trabalho</label>
                                <SearchableSelect
                                    options={otOpts} value={otId}
                                    onChange={v => {
                                        setOtId(v);
                                        const ot = ordens.find(o => o.id === v);
                                        if (ot?.artigos?.length) {
                                            setLinhas(ot.artigos.map(a => ({ descricao: a.descricao, quantidade: a.quantidade, precoUnit: a.preco })));
                                        }
                                    }}
                                    placeholder="Seleccionar OT concluída..."
                                />
                                {errors.ot && <span className="form-error"><AlertCircle size={11} /> {errors.ot}</span>}
                            </div>

                            {otSelected && (
                                <div style={{ padding: '8px 12px', background: '#f8f9fa', border: '1px solid var(--border)', borderRadius: 3, fontSize: '0.81rem', marginBottom: 8 }}>
                                    <strong>{clientes.find(c => c.id === otSelected.clienteId)?.nome}</strong> · {otSelected.tipoTrabalho} · {otSelected.descricao}
                                </div>
                            )}

                            <div className="form-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <label className="form-label" style={{ margin: 0 }}>Artigos / Consumíveis</label>
                                    <button type="button" className="abtn abtn-secondary" style={{ fontSize: '0.75rem', padding: '3px 8px' }} onClick={addLinha}>
                                        <Plus size={11} /> Adicionar
                                    </button>
                                </div>
                                {linhas.length === 0 ? (
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sem artigos adicionais.</div>
                                ) : linhas.map((l, i) => (
                                    <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(100px,1fr) 60px 100px 28px', gap: 6, marginBottom: 4, alignItems: 'center', minWidth: 300, overflowX: 'auto' }}>
                                        <input type="text" className="form-input" placeholder="Descrição"
                                            value={l.descricao} onChange={e => updateLinha(i, 'descricao', e.target.value)} />
                                        <input type="number" className="form-input" placeholder="Qtd" min={1}
                                            value={l.quantidade} onChange={e => updateLinha(i, 'quantidade', Number(e.target.value))} />
                                        <input type="number" className="form-input" placeholder="Preço unit." min={0}
                                            value={l.precoUnit} onChange={e => updateLinha(i, 'precoUnit', Number(e.target.value))} />
                                        <button type="button" className="icon-btn" onClick={() => removeLinha(i)}><X size={11} /></button>
                                    </div>
                                ))}
                            </div>
                        </>)}

                        {/* ── FP: Client + Stock articles ── */}
                        {isFP && (<>
                            <div className="form-group">
                                <label className="form-label req">Cliente</label>
                                <SearchableSelect options={clienteOpts} value={clienteId} onChange={setClienteId} placeholder="Seleccionar cliente..." />
                                {errors.cliente && <span className="form-error"><AlertCircle size={11} /> {errors.cliente}</span>}
                            </div>

                            <div className="form-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <label className="form-label req" style={{ margin: 0 }}>Artigos / Consumíveis</label>
                                    <button type="button" className="abtn abtn-secondary" style={{ fontSize: '0.75rem', padding: '3px 8px' }} onClick={addFpLinha}>
                                        <Plus size={11} /> Adicionar linha
                                    </button>
                                </div>
                                {errors.linhas && <span className="form-error" style={{ display: 'block', marginBottom: 6 }}><AlertCircle size={11} /> {errors.linhas}</span>}
                                {fpLinhas.length === 0 ? (
                                    <div style={{ padding: 12, border: '1px dashed var(--border)', borderRadius: 4, fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                        Clique em "Adicionar linha" para seleccionar artigos do stock.
                                    </div>
                                ) : fpLinhas.map((l, i) => {
                                    const art = artigos.find(a => a.id === l.artigoId);
                                    return (
                                        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(100px,1fr) 70px 90px 28px', gap: 6, marginBottom: 8, alignItems: 'flex-start', minWidth: 300, overflowX: 'auto' }}>
                                            <div>
                                                <SearchableSelect
                                                    options={artigoOpts.filter(o => !fpLinhas.some((ll, j) => j !== i && ll.artigoId === o.value))}
                                                    value={l.artigoId}
                                                    onChange={v => updateFpArtigo(i, v)}
                                                    placeholder="Artigo..."
                                                />
                                                {art && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>Disponível: {art.existencia} un</div>}
                                            </div>
                                            <input type="number" className="form-input" placeholder="Qtd" min={1} max={art?.existencia ?? 9999}
                                                value={l.quantidade} onChange={e => updateFpLinha(i, 'quantidade', Number(e.target.value))} />
                                            <input type="number" className="form-input" placeholder="Preço unit." min={0}
                                                value={l.precoUnit} onChange={e => updateFpLinha(i, 'precoUnit', Number(e.target.value))} />
                                            <button type="button" className="icon-btn" style={{ marginTop: 2 }} onClick={() => removeFpLinha(i)}><X size={11} /></button>
                                        </div>
                                    );
                                })}
                            </div>
                        </>)}

                        {/* Totals */}
                        <div style={{ padding: '8px 12px', background: '#f0fdf4', border: '1px solid #BBF7D0', borderRadius: 4, fontSize: '0.8rem', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                            <span>Subtotal: <strong>{fmtMoney(subtotal)}</strong></span>
                            <span>IVA ({taxaIva}%): <strong>{fmtMoney(ivaVal)}</strong></span>
                            <span style={{ fontWeight: 700, color: '#166534' }}>Total: <strong>{fmtMoney(total)}</strong></span>
                        </div>

                        <div className="form-group" style={{ marginTop: 12 }}>
                            <label className="form-label">Observações</label>
                            <textarea className="form-input" rows={2} style={{ resize: 'vertical' }}
                                value={observacoes} onChange={e => setObs(e.target.value)}
                                placeholder="Notas adicionais..." />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="abtn abtn-primary"><Plus size={12} /> Emitir {tipoDoc}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ══ Fatura Detalhe Modal ════════════════════════════════════ */
interface FaturaDetalheProps {
    fatura: Fatura;
    nomeCliente: string;
    otDesc: string;
    onClose: () => void;
    onPagar: (comprovativo: string, dataPagamento: string) => void;
    onAnular: (motivo: string) => void;
}

const FaturaDetalhe: React.FC<FaturaDetalheProps> = ({ fatura, nomeCliente, otDesc, onClose, onPagar, onAnular }) => {
    const { empresaConfig } = useGlobal();
    const [confirmAnular,  setConfirmAnular]  = useState(false);
    const [motivoAnular,   setMotivoAnular]   = useState('');
    const [confirmPagar,   setConfirmPagar]   = useState(false);
    const [comprovativo,   setComprovativo]   = useState('');
    const [dataPag,        setDataPag]        = useState(new Date().toISOString().split('T')[0]);
    const eb = ESTADO_BADGE[fatura.estado];
    const isFP  = fatura.tipoDocumento === 'FP';
    const isFAT = fatura.tipoDocumento === 'FAT';

    const handlePrint = () => {
        const w = window.open('', '_blank', 'width=860,height=700');
        if (!w) return;
        const docTitle = isFP ? 'FATURA PRO-FORMA' : 'FATURA';
        const fpNote = isFP ? `<div style="margin-top:20px;padding:10px 14px;background:#FFF3E0;border:1px solid #FFCC80;border-radius:4px;font-size:0.85rem;font-weight:700;color:#E65100;text-align:center">Este documento não serve de fatura</div>` : '';
        const anuladaNote = fatura.estado === 'Anulada' && fatura.motivoAnulacao
            ? `<div style="margin-top:8px;padding:10px 14px;background:#ECEFF1;border:1px solid #CFD8DC;border-radius:4px;font-size:0.8rem"><div style="font-weight:700;margin-bottom:4px">Fatura Anulada</div><div>Motivo: ${fatura.motivoAnulacao}</div></div>` : '';
        w.document.write(`<!DOCTYPE html><html lang="pt"><head>
  <meta charset="UTF-8"><title>${docTitle} ${fatura.id}</title>
  <style>
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 15mm 20mm; color: #1a1a1a; max-width: 780px; margin: 0 auto; }
    @page { size: A4; margin: 0; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; border-bottom: 3px solid #1565C0; padding-bottom: 16px; }
    .company { font-size: 1.1rem; font-weight: 800; color: #1565C0; }
    .company-info { font-size: 0.78rem; color: #555; margin-top: 4px; }
    .fatura-title { font-size: 1.4rem; font-weight: 900; text-align: right; }
    .fatura-id { font-size: 0.9rem; color: #777; text-align: right; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 22px; }
    .meta-box { padding: 10px 14px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.82rem; }
    .meta-label { font-size: 0.72rem; color: #888; text-transform: uppercase; margin-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #1565C0 !important; color: #fff !important; padding: 8px 12px; font-size: 0.82rem; text-align: left; }
    th:last-child, td:last-child { text-align: right; }
    td { padding: 7px 12px; border-bottom: 1px solid #eee; font-size: 0.82rem; }
    .totals { margin-left: auto; width: 280px; }
    .totals td { border: none; padding: 4px 12px; }
    .totals .grand { font-size: 1rem; font-weight: 800; color: #1565C0; border-top: 2px solid #1565C0; }
    .pagamento { margin-top: 16px; padding: 10px 14px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 4px; font-size: 0.8rem; }
  </style></head><body>
  <div class="header">
    <div>
      <div class="company">${empresaConfig.nome}</div>
      <div class="company-info">NIF: ${empresaConfig.nif} · ${empresaConfig.telefone} · ${empresaConfig.email}</div>
    </div>
    <div>
      <div class="fatura-title">${docTitle}</div>
      <div class="fatura-id">${fatura.id}</div>
    </div>
  </div>
  <div class="meta">
    <div class="meta-box"><div class="meta-label">Cliente</div><div style="font-weight:700">${nomeCliente}</div></div>
    <div class="meta-box"><div class="meta-label">OT Referência</div><div style="font-weight:700">${fatura.otId}</div><div style="font-size:0.75rem;color:#888">Data emissão: ${fmtDate(fatura.dataEmissao)}</div></div>
  </div>
  <table>
    <thead><tr><th>Descrição</th><th>Qtd</th><th>Preço Unit. (${fatura.moeda})</th><th>Total (${fatura.moeda})</th></tr></thead>
    <tbody>
      ${fatura.linhas.map(l => `<tr><td>${l.descricao}</td><td>${l.quantidade}</td><td>${l.precoUnit.toLocaleString('pt-PT')}</td><td>${(l.quantidade * l.precoUnit).toLocaleString('pt-PT')}</td></tr>`).join('')}
    </tbody>
  </table>
  <table class="totals">
    <tr><td>Subtotal:</td><td>${fmtMoney(fatura.valorSubtotal, fatura.moeda)}</td></tr>
    <tr><td>IVA (${fatura.taxaIva}%):</td><td>${fmtMoney(fatura.valorIva, fatura.moeda)}</td></tr>
    <tr class="grand"><td>TOTAL:</td><td>${fmtMoney(fatura.valorTotal, fatura.moeda)}</td></tr>
  </table>
  ${!isFP ? `<div class="pagamento"><div style="font-weight:700;margin-bottom:4px">Coordenadas de Pagamento</div><div>${empresaConfig.banco} · IBAN: ${empresaConfig.iban}</div></div>` : ''}
  ${fatura.observacoes ? `<div class="pagamento" style="margin-top:8px"><div style="font-weight:700;margin-bottom:4px">Observações</div><div>${fatura.observacoes}</div></div>` : ''}
  ${fpNote}
  ${anuladaNote}
  <div style="margin-top:32px;font-size:0.72rem;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:12px">${empresaConfig.nome} · NIF ${empresaConfig.nif} · SGI · ${fmtDate(fatura.dataEmissao)}</div>
  <script>window.onload = () => window.print();</script>
</body></html>`);
        w.document.close();
    };

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 620 }}>
                <div className="modal-header">
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <h3 className="modal-title">{fatura.id}</h3>
                            <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 10, fontWeight: 700, background: '#f0f4ff', color: '#1565C0', border: '1px solid #BFDBFE' }}>
                                {fatura.tipoDocumento}
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <span className={`dot ${ESTADO_DOT[fatura.estado]}`} />
                            <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 10, fontWeight: 700, background: eb.bg, color: eb.color }}>
                                {fatura.estado}
                            </span>
                        </div>
                    </div>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    <div style={{ padding: '10px 14px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 4, marginBottom: 12 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--blue)' }}>{empresaConfig.nome}</div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>NIF: {empresaConfig.nif} · {empresaConfig.telefone}</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
                        {[
                            { label: 'Cliente',         value: nomeCliente },
                            { label: 'OT Referência',   value: fatura.otId },
                            { label: 'Tipo Documento',  value: fatura.tipoDocumento },
                            { label: 'Data Emissão',    value: fmtDate(fatura.dataEmissao) },
                            ...(fatura.dataPagamento ? [{ label: 'Data Pagamento', value: fmtDate(fatura.dataPagamento) }] : []),
                            ...(fatura.nrSerieEquip ? [{ label: 'N/S Equipamento', value: fatura.nrSerieEquip }] : []),
                        ].map(r => (
                            <div key={r.label} className="form-group">
                                <label className="form-label">{r.label}</label>
                                <div style={{ padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 3, fontSize: '0.82rem' }}>{r.value}</div>
                            </div>
                        ))}
                    </div>

                    {otDesc && (
                        <div style={{ padding: '6px 12px', background: '#f8f9fa', border: '1px solid var(--border)', borderRadius: 3, fontSize: '0.81rem', marginBottom: 12 }}>
                            {otDesc}
                        </div>
                    )}

                    <table className="data-table" style={{ marginBottom: 12 }}>
                        <thead>
                            <tr>
                                <th>Descrição</th>
                                <th style={{ textAlign: 'right', width: 60 }}>Qtd</th>
                                <th style={{ textAlign: 'right', width: 120 }}>Preço Unit.</th>
                                <th style={{ textAlign: 'right', width: 120 }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {fatura.linhas.map((l, i) => (
                                <tr key={i}>
                                    <td style={{ fontSize: '0.82rem' }}>{l.descricao}</td>
                                    <td style={{ textAlign: 'right', fontSize: '0.82rem' }}>{l.quantidade}</td>
                                    <td style={{ textAlign: 'right', fontSize: '0.82rem' }}>{fmtMoney(l.precoUnit, fatura.moeda)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.82rem' }}>{fmtMoney(l.quantidade * l.precoUnit, fatura.moeda)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', padding: '8px 0' }}>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Subtotal: <strong style={{ color: 'var(--text-primary)' }}>{fmtMoney(fatura.valorSubtotal, fatura.moeda)}</strong></div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>IVA ({fatura.taxaIva}%): <strong style={{ color: 'var(--text-primary)' }}>{fmtMoney(fatura.valorIva, fatura.moeda)}</strong></div>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--blue)' }}>TOTAL: {fmtMoney(fatura.valorTotal, fatura.moeda)}</div>
                    </div>

                    {isFAT && (
                        <div style={{ padding: '8px 12px', background: '#f8f9fa', border: '1px solid var(--border)', borderRadius: 4, fontSize: '0.8rem' }}>
                            <div style={{ fontWeight: 700, marginBottom: 2 }}>Coordenadas de Pagamento</div>
                            <div style={{ color: 'var(--text-secondary)' }}>{empresaConfig.banco} · IBAN: {empresaConfig.iban}</div>
                        </div>
                    )}

                    {isFP && (
                        <div style={{ padding: '10px 14px', background: '#FFF3E0', border: '1px solid #FFCC80', borderRadius: 4, fontSize: '0.82rem', fontWeight: 700, color: '#E65100', textAlign: 'center' }}>
                            Este documento não serve de fatura
                        </div>
                    )}

                    {fatura.observacoes && (
                        <div style={{ marginTop: 8, padding: '8px 12px', background: '#f8f9fa', border: '1px solid var(--border)', borderRadius: 4, fontSize: '0.8rem' }}>
                            <div style={{ fontWeight: 700, marginBottom: 2 }}>Observações</div>
                            <div style={{ color: 'var(--text-secondary)' }}>{fatura.observacoes}</div>
                        </div>
                    )}

                    {fatura.motivoAnulacao && (
                        <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--red-bg)', border: '1px solid #FFCDD2', borderRadius: 4, fontSize: '0.8rem' }}>
                            <div style={{ fontWeight: 700, marginBottom: 2, color: 'var(--red)' }}>Motivo de Anulação</div>
                            <div style={{ color: 'var(--text-secondary)' }}>{fatura.motivoAnulacao}</div>
                        </div>
                    )}

                    {fatura.comprovativo && (
                        <div style={{ marginTop: 8, padding: '8px 12px', background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: 4, fontSize: '0.8rem' }}>
                            <div style={{ fontWeight: 700, marginBottom: 2, color: '#2E7D32' }}>Comprovativo de Pagamento</div>
                            <div style={{ color: 'var(--text-secondary)' }}>{fatura.comprovativo}</div>
                        </div>
                    )}

                    {confirmPagar && (
                        <div style={{ marginTop: 12, padding: '12px 14px', background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: 4 }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#2E7D32', marginBottom: 8 }}>Registar pagamento</div>
                            <div className="form-row" style={{ marginBottom: 8 }}>
                                <div className="form-group" style={{ flex: 2 }}>
                                    <label className="form-label">Referência / Comprovativo</label>
                                    <input className="form-input" value={comprovativo} onChange={e => setComprovativo(e.target.value)} placeholder="Nº transferência, recibo, etc." />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Data Pagamento</label>
                                    <input type="date" className="form-input" value={dataPag} onChange={e => setDataPag(e.target.value)} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button className="abtn abtn-secondary" type="button" onClick={() => setConfirmPagar(false)}>Cancelar</button>
                                <button className="abtn abtn-primary" style={{ background: '#16a34a', borderColor: '#16a34a' }} type="button" onClick={() => onPagar(comprovativo, dataPag)}>
                                    <Check size={12} /> Confirmar Pagamento
                                </button>
                            </div>
                        </div>
                    )}

                    {confirmAnular && (
                        <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--red-bg)', border: '1px solid #FFCDD2', borderRadius: 4 }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--red)', marginBottom: 8 }}>Motivo de anulação (obrigatório)</div>
                            <textarea className="form-input" rows={2} style={{ resize: 'vertical', marginBottom: 8 }}
                                value={motivoAnular} onChange={e => setMotivoAnular(e.target.value)}
                                placeholder="Descreva o motivo da anulação..." />
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button className="abtn abtn-secondary" type="button" onClick={() => { setConfirmAnular(false); setMotivoAnular(''); }}>Cancelar</button>
                                <button className="abtn abtn-danger" type="button"
                                    disabled={!motivoAnular.trim()}
                                    onClick={() => onAnular(motivoAnular)}>
                                    Confirmar Anulação
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                    <div>
                        {isFAT && fatura.estado === 'Pendente' && !confirmAnular && !confirmPagar && (
                            <button className="abtn abtn-danger" type="button" onClick={() => setConfirmAnular(true)}>
                                <X size={12} /> Anular
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="abtn abtn-secondary" type="button" onClick={onClose}>Fechar</button>
                        {isFAT && fatura.estado === 'Pendente' && !confirmAnular && !confirmPagar && (
                            <button className="abtn abtn-primary" style={{ background: '#16a34a', borderColor: '#16a34a' }} type="button" onClick={() => setConfirmPagar(true)}>
                                <Check size={12} /> Marcar como Paga
                            </button>
                        )}
                        <button className="abtn abtn-secondary" type="button" onClick={handlePrint}>
                            <Printer size={12} /> Imprimir
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const COLS_FATURA: ExportCol[] = [
    { key: 'id',            label: 'Documento' },
    { key: 'tipoDocumento', label: 'Tipo' },
    { key: 'otId',          label: 'OT Ref.' },
    { key: 'clienteNome',   label: 'Cliente' },
    { key: 'dataEmissao',   label: 'Data Emissão' },
    { key: 'dataPagamento', label: 'Data Pagamento' },
    { key: 'nrSerieEquip',  label: 'N/S Equip.' },
    { key: 'valorIva',      label: 'IVA' },
    { key: 'valorTotal',    label: 'Total' },
    { key: 'moeda',         label: 'Moeda' },
    { key: 'estado',        label: 'Estado' },
];

/* ══ Page ════════════════════════════════════════════════════ */
const FaturacaoPage: React.FC = () => {
    const { faturas, addFatura, updateFatura, clientes, ordens, empresaConfig } = useGlobal();

    const [search,       setSearch]       = useState('');
    const [filterEstado, setFilterEstado] = useState('');
    const [toast,         setToast]        = useState('');
    const [showExport,    setShowExport]   = useState(false);
    const [emitirModal,   setEmitirModal]  = useState(false);
    const [detalheId,     setDetalheId]    = useState<string | null>(null);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

    const getClienteNome = (id: string) => clientes.find(c => c.id === id)?.nome ?? id;
    const getOTDesc      = (otId: string) => {
        if (otId === 'N/A') return '';
        const ot = ordens.find(o => o.id === otId);
        return ot ? `${ot.tipoTrabalho} · ${ot.descricao}` : '';
    };

    const handleEmitir = (f: Omit<Fatura, 'id'>) => {
        const fat = addFatura(f);
        setEmitirModal(false);
        showToast(`Documento ${fat.id} emitido.`);
    };

    const handlePagar = (id: string, comprovativo: string, dataPagamento: string) => {
        updateFatura(id, { estado: 'Paga', dataPagamento, comprovativo });
        setDetalheId(null);
        showToast('Fatura marcada como paga.');
    };

    const handleAnular = (id: string, motivo: string) => {
        updateFatura(id, { estado: 'Anulada', motivoAnulacao: motivo });
        setDetalheId(null);
        showToast('Fatura anulada.');
    };

    const pendentes     = faturas.filter(f => f.estado === 'Pendente').length;
    const pagas         = faturas.filter(f => f.estado === 'Paga').length;
    const anuladas      = faturas.filter(f => f.estado === 'Anulada').length;
    const totalPendente = faturas.filter(f => f.estado === 'Pendente').reduce((s, f) => s + f.valorTotal, 0);
    const totalPago     = faturas.filter(f => f.estado === 'Paga').reduce((s, f) => s + f.valorTotal, 0);

    const filtered = faturas.filter(f => {
        const q = search.toLowerCase();
        const nomeCliente = getClienteNome(f.clienteId).toLowerCase();
        return (!q || f.id.toLowerCase().includes(q) || nomeCliente.includes(q) || f.otId.toLowerCase().includes(q) || (f.nrSerieEquip ?? '').toLowerCase().includes(q))
            && (!filterEstado || f.estado === filterEstado);
    });

    const exportData = filtered.map(f => ({
        ...f,
        clienteNome:   getClienteNome(f.clienteId),
        dataEmissao:   fmtDate(f.dataEmissao),
        dataPagamento: fmtDate(f.dataPagamento),
        nrSerieEquip:  f.nrSerieEquip ?? '—',
    }));

    const detalheF  = detalheId ? faturas.find(f => f.id === detalheId) ?? null : null;
    const hasFilters = !!(search || filterEstado);

    return (
        <AppLayout>
            <ActionBar title="Faturação" breadcrumb="AQUATEX SGI · Faturação">
                <div className="actionbar-spacer" />
                <button className="abtn abtn-secondary" type="button" onClick={() => setShowExport(true)}>
                    <Download size={13} /> Exportar
                </button>
                <button className="abtn abtn-primary" type="button" onClick={() => setEmitirModal(true)}>
                    <Plus size={13} /> Emitir Documento
                </button>
            </ActionBar>

            <div className="page-content">
                <div className="stats-row">
                    {[
                        { label: 'Pendentes',      value: pendentes,                                   cls: pendentes > 0 ? 'orange' : 'muted' },
                        { label: 'Pagas',          value: pagas,                                       cls: 'green' },
                        { label: 'Anuladas',       value: anuladas,                                    cls: 'muted' },
                        { label: 'Total Recebido', value: fmtMoney(totalPago, empresaConfig.moeda),     cls: 'green' },
                        { label: 'Total Pendente', value: fmtMoney(totalPendente, empresaConfig.moeda), cls: 'blue' },
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
                        <input className="search-input" placeholder="Pesquisar documento, cliente, OT, N/S..."
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select className="filter-select" value={filterEstado} onChange={e => setFilterEstado(e.target.value)}>
                        <option value="">Todos os estados</option>
                        <option value="Pendente">Pendente</option>
                        <option value="Paga">Paga</option>
                        <option value="Anulada">Anulada</option>
                        <option value="Emitido">Emitido</option>
                    </select>
                    {hasFilters && (
                        <button className="abtn abtn-secondary" type="button" onClick={() => { setSearch(''); setFilterEstado(''); }}>
                            <Filter size={12} /> Limpar
                        </button>
                    )}
                </div>

                <div className="table-container">
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 20 }} />
                                    <th>Documento</th>
                                    <th>Tipo</th>
                                    <th>OT Ref.</th>
                                    <th>Cliente</th>
                                    <th>N/S Equip.</th>
                                    <th>Data Emissão</th>
                                    <th>Data Pagamento</th>
                                    <th style={{ textAlign: 'right' }}>IVA</th>
                                    <th style={{ textAlign: 'right' }}>Total</th>
                                    <th>Estado</th>
                                    <th style={{ width: 50 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr><td colSpan={12}><div className="empty-state"><FileText size={28} /><br />Nenhum documento encontrado.</div></td></tr>
                                )}
                                {filtered.map(f => {
                                    const eb = ESTADO_BADGE[f.estado];
                                    return (
                                        <tr key={f.id}>
                                            <td style={{ paddingLeft: 10 }}><span className={`dot ${ESTADO_DOT[f.estado]}`} /></td>
                                            <td>
                                                <span className="td-link" onClick={() => setDetalheId(f.id)} style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--blue)', cursor: 'pointer' }}>
                                                    {f.id}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{ fontSize: '0.72rem', padding: '2px 7px', borderRadius: 10, fontWeight: 700, background: '#EFF6FF', color: '#1565C0', border: '1px solid #BFDBFE' }}>
                                                    {f.tipoDocumento}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{f.otId}</td>
                                            <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{getClienteNome(f.clienteId)}</td>
                                            <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{f.nrSerieEquip ?? '—'}</td>
                                            <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{fmtDate(f.dataEmissao)}</td>
                                            <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{fmtDate(f.dataPagamento)}</td>
                                            <td style={{ textAlign: 'right', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>{fmtMoney(f.valorIva, f.moeda)}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoney(f.valorTotal, f.moeda)}</td>
                                            <td>
                                                <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 10, fontWeight: 700, background: eb.bg, color: eb.color }}>
                                                    {f.estado}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="row-actions">
                                                    <button className="icon-btn" title="Ver detalhe" onClick={() => setDetalheId(f.id)}>
                                                        <FileText size={12} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="table-count">{filtered.length} documento(s)</div>
                </div>
            </div>

            {emitirModal && <EmitirDocumentoModal onClose={() => setEmitirModal(false)} onSave={handleEmitir} />}

            {detalheF && (
                <FaturaDetalhe
                    fatura={detalheF}
                    nomeCliente={getClienteNome(detalheF.clienteId)}
                    otDesc={getOTDesc(detalheF.otId)}
                    onClose={() => setDetalheId(null)}
                    onPagar={(comp, dataPag) => handlePagar(detalheF.id, comp, dataPag)}
                    onAnular={(motivo) => handleAnular(detalheF.id, motivo)}
                />
            )}

            {showExport && (
                <ExportModal
                    title="Faturação"
                    columns={COLS_FATURA}
                    data={exportData}
                    filename="faturas"
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

export default FaturacaoPage;
