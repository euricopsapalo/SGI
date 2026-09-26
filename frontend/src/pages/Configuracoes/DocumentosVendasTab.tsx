import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, X, Edit2, Lock, Trash2, Star, AlertCircle } from 'lucide-react';
import { useGlobal } from '../../contexts/GlobalContext';
import { useConfirm } from '../../components/useConfirm';
import { useModalA11y } from '../../components/useModalA11y';
import SubmitButton from '../../components/SubmitButton';
import FieldError, { fieldAria } from '../../components/FieldError';
import { extractErrorMessage, extractFieldErrors, showToast } from '../../utils/errorHandler';
import {
    vendasConfigApi, camposDisponiveis, dominio, eSubCampo, limparIndisponiveis,
    type Matriz, type DocumentoConfig, type DocCampo, type CcTipo, type ContaBancaria,
    type MotivoEstorno, type Serie, type ValoresConfig,
} from '../../services/vendasConfig';

/**
 * #164 — Separador "Documentos de Venda" das Configurações.
 * Configuração de documentos (FT, FR, NC, RE, MC, …), séries, contas correntes,
 * contas bancárias/caixas e motivos de estorno do Módulo de Vendas de Intervenções.
 *
 * O formulário do documento é gerado a partir da matriz (v10 R3): nenhum campo
 * ou valor está escrito aqui por tipo de documento.
 */

interface Dados {
    matriz: Matriz;
    documentos: DocumentoConfig[];
    ccTipos: CcTipo[];
    contas: ContaBancaria[];
    motivos: MotivoEstorno[];
}

const small: React.CSSProperties = { fontSize: '0.78rem' };
const muted: React.CSSProperties = { fontSize: '0.72rem', color: 'var(--text-muted)' };

const Badge: React.FC<{ tone: 'active' | 'inactive' | 'admin' | 'suporte'; children: React.ReactNode; title?: string }> = ({ tone, children, title }) => (
    <span className={`tbadge tbadge-${tone}`} title={title}>{children}</span>
);

const Modal: React.FC<{ titulo: string; largura?: number; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }> = ({ titulo, largura = 560, onClose, children, footer }) => {
    const ref = useModalA11y(onClose);
    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: largura }} ref={ref} role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1}>
                <div className="modal-header">
                    <h3 className="modal-title">{titulo}</h3>
                    <button className="modal-close" aria-label="Fechar" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>{children}</div>
                <div className="modal-footer">{footer}</div>
            </div>
        </div>
    );
};

/* ════════════════════════════════════════════════ */
const DocumentosVendasTab: React.FC = () => {
    const { currentUser } = useGlobal();
    const isAdmin = currentUser?.role === 'Administrador';
    const confirm = useConfirm();

    const [dados, setDados] = useState<Dados | null>(null);
    const [erroCarga, setErroCarga] = useState<string | null>(null);
    const [docModal, setDocModal] = useState<'new' | number | null>(null);
    const [ccModal, setCcModal] = useState<'new' | number | null>(null);
    const [contaModal, setContaModal] = useState<'new' | number | null>(null);
    const [motivoModal, setMotivoModal] = useState<'new' | number | null>(null);

    const carregar = useCallback(async () => {
        try {
            const [matriz, documentos, ccTipos, contas, motivos] = await Promise.all([
                vendasConfigApi.matriz(), vendasConfigApi.documentos(), vendasConfigApi.ccTipos(),
                vendasConfigApi.contas(), vendasConfigApi.motivos(),
            ]);
            setDados({ matriz, documentos, ccTipos, contas, motivos });
            setErroCarga(null);
        } catch (e) {
            setErroCarga(extractErrorMessage(e));
        }
    }, []);
    useEffect(() => { carregar(); }, [carregar]);

    if (erroCarga) {
        return <div className="settings-section"><div className="settings-section-body" role="alert">
            <AlertCircle size={13} /> Não foi possível carregar a configuração: {erroCarga}
        </div></div>;
    }
    if (!dados) return <div className="settings-section"><div className="settings-section-body" style={muted}>A carregar…</div></div>;

    const { matriz, documentos, ccTipos, contas, motivos } = dados;
    const tipoDesc = (c: string) => matriz.tipos.find(t => t.codigo === c)?.descricao ?? c;
    const porTipo = matriz.tipos
        .map(t => ({ tipo: t, docs: documentos.filter(d => d.tipoCodigo === t.codigo) }))
        .filter(g => g.docs.length);

    const eliminar = async (label: string, fn: () => Promise<unknown>) => {
        if (!await confirm({ title: `Eliminar ${label}?`, message: 'Esta operação não pode ser desfeita.', confirmLabel: 'Eliminar', variant: 'danger' })) return;
        try { await fn(); showToast(`${label} eliminado`, 'success'); carregar(); }
        catch (e) { showToast(extractErrorMessage(e), 'error'); }
    };

    return <>
        {!isAdmin && (
            <div className="settings-section"><div className="settings-section-body" style={muted}>
                <Lock size={11} /> Só administradores podem alterar esta configuração.
            </div></div>
        )}

        {/* ── Documentos ── */}
        <div className="settings-section">
            <div className="settings-section-hdr" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}>
                    <div className="settings-section-title">Documentos</div>
                    <div className="settings-section-desc">O comportamento de cada documento resulta da sua configuração. Após o primeiro documento emitido, a configuração fica bloqueada.</div>
                </div>
                {isAdmin && <button type="button" className="abtn abtn-primary" onClick={() => setDocModal('new')}><Plus size={11} /> Novo documento</button>}
            </div>
            <div className="settings-section-body">
                <table className="data-table">
                    <thead><tr><th>Código</th><th>Descrição</th><th>Tipo fiscal</th><th>Série por defeito</th><th>Estado</th><th style={{ width: 40 }} /></tr></thead>
                    <tbody>
                        {porTipo.map(({ tipo, docs }) => (
                            <React.Fragment key={tipo.codigo}>
                                <tr><td colSpan={6} style={{ ...muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', paddingTop: 10 }}>{tipo.descricao}</td></tr>
                                {docs.map(d => {
                                    const serie = d.series.find(s => s.porDefeito);
                                    return (
                                        <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => setDocModal(d.id)}>
                                            <td style={{ fontWeight: 700 }}>{d.codigo}</td>
                                            <td>{d.descricao}</td>
                                            <td>{d.tipoFiscal ?? '—'}</td>
                                            <td>{serie ? `${serie.codigo} (${serie.ano})` : <span style={{ color: 'var(--orange)' }}>sem série</span>}</td>
                                            <td>
                                                {!d.ativo ? <Badge tone="inactive">Inactivo</Badge>
                                                    : d.emUso ? <Badge tone="suporte" title="Configuração bloqueada (R2)"><Lock size={9} /> Em uso</Badge>
                                                        : <Badge tone="active">Livre</Badge>}
                                            </td>
                                            <td><button type="button" className="icon-btn" aria-label={`Abrir ${d.codigo}`}><Edit2 size={12} /></button></td>
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* ── Contas correntes ── */}
        <div className="settings-section">
            <div className="settings-section-hdr" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}>
                    <div className="settings-section-title">Contas correntes</div>
                    <div className="settings-section-desc">Tipos de conta corrente e os estados possíveis dos seus movimentos</div>
                </div>
                {isAdmin && <button type="button" className="abtn abtn-secondary" onClick={() => setCcModal('new')}><Plus size={11} /> Nova</button>}
            </div>
            <div className="settings-section-body">
                <table className="data-table">
                    <thead><tr><th>Código</th><th>Descrição</th><th>Entidade</th><th>Estados</th><th style={{ width: 70 }} /></tr></thead>
                    <tbody>{ccTipos.map(cc => (
                        <tr key={cc.id}>
                            <td style={{ fontWeight: 700 }}>{cc.codigo}</td><td>{cc.descricao}</td>
                            <td>{cc.entidade === 'CLIENTE' ? 'Cliente' : 'Fornecedor'}</td>
                            <td style={small}>{cc.estados.map(e => `${e.codigo} — ${e.descricao}`).join(' · ')}</td>
                            <td>{isAdmin && <div className="row-actions">
                                <button type="button" className="icon-btn" aria-label={`Editar ${cc.codigo}`} onClick={() => setCcModal(cc.id)}><Edit2 size={12} /></button>
                                <button type="button" className="icon-btn" aria-label={`Eliminar ${cc.codigo}`} onClick={() => eliminar(`Conta corrente ${cc.codigo}`, () => vendasConfigApi.eliminarCcTipo(cc.id))}><Trash2 size={12} /></button>
                            </div>}</td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
        </div>

        {/* ── Contas bancárias / caixas ── */}
        <div className="settings-section">
            <div className="settings-section-hdr" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}>
                    <div className="settings-section-title">Contas bancárias e caixas</div>
                    <div className="settings-section-desc">Contas de destino dos movimentos de tesouraria. Moeda fixa em AOA.</div>
                </div>
                {isAdmin && <button type="button" className="abtn abtn-secondary" onClick={() => setContaModal('new')}><Plus size={11} /> Nova</button>}
            </div>
            <div className="settings-section-body">
                <table className="data-table">
                    <thead><tr><th>Código</th><th>Descrição</th><th>Tipo</th><th>Banco / IBAN</th><th>Estado</th><th style={{ width: 70 }} /></tr></thead>
                    <tbody>{contas.map(c => (
                        <tr key={c.id}>
                            <td style={{ fontWeight: 700 }}>{c.codigo}</td><td>{c.descricao}</td>
                            <td>{c.tipo === 'CAIXA' ? 'Caixa' : 'Depósito à ordem'}</td>
                            <td style={small}>{[c.banco, c.iban].filter(Boolean).join(' · ') || '—'}</td>
                            <td>{c.ativo ? <Badge tone="active">Activa</Badge> : <Badge tone="inactive">Inactiva</Badge>}</td>
                            <td>{isAdmin && <div className="row-actions">
                                <button type="button" className="icon-btn" aria-label={`Editar ${c.codigo}`} onClick={() => setContaModal(c.id)}><Edit2 size={12} /></button>
                                <button type="button" className="icon-btn" aria-label={`Eliminar ${c.codigo}`} onClick={() => eliminar(`Conta ${c.codigo}`, () => vendasConfigApi.eliminarConta(c.id))}><Trash2 size={12} /></button>
                            </div>}</td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
        </div>

        {/* ── Motivos de estorno ── */}
        <div className="settings-section">
            <div className="settings-section-hdr" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}>
                    <div className="settings-section-title">Motivos de estorno</div>
                    <div className="settings-section-desc">Seleccionados linha a linha no editor de estorno</div>
                </div>
                {isAdmin && <button type="button" className="abtn abtn-secondary" onClick={() => setMotivoModal('new')}><Plus size={11} /> Novo</button>}
            </div>
            <div className="settings-section-body">
                <table className="data-table">
                    <thead><tr><th>Código</th><th>Descrição</th><th>Estado</th><th style={{ width: 70 }} /></tr></thead>
                    <tbody>{motivos.map(mo => (
                        <tr key={mo.id}>
                            <td style={{ fontWeight: 700 }}>{mo.codigo}</td><td>{mo.descricao}</td>
                            <td>{mo.ativo ? <Badge tone="active">Activo</Badge> : <Badge tone="inactive">Inactivo</Badge>}</td>
                            <td>{isAdmin && <div className="row-actions">
                                <button type="button" className="icon-btn" aria-label={`Editar ${mo.codigo}`} onClick={() => setMotivoModal(mo.id)}><Edit2 size={12} /></button>
                                <button type="button" className="icon-btn" aria-label={`Eliminar ${mo.codigo}`} onClick={() => eliminar(`Motivo ${mo.codigo}`, () => vendasConfigApi.eliminarMotivo(mo.id))}><Trash2 size={12} /></button>
                            </div>}</td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
        </div>

        {docModal !== null && (
            <DocumentoModal
                dados={dados}
                documento={docModal === 'new' ? undefined : documentos.find(d => d.id === docModal)}
                tipoDesc={tipoDesc}
                podeEditar={isAdmin}
                onClose={() => setDocModal(null)}
                onChanged={carregar}
                onCreated={id => { carregar(); setDocModal(id); }}
                onDelete={d => eliminar(`Documento ${d.codigo}`, async () => { await vendasConfigApi.eliminarDocumento(d.id); setDocModal(null); })}
            />
        )}
        {ccModal !== null && (
            <CcTipoModal ccTipo={ccModal === 'new' ? undefined : ccTipos.find(c => c.id === ccModal)}
                onClose={() => setCcModal(null)} onSaved={() => { setCcModal(null); carregar(); }} />
        )}
        {contaModal !== null && (
            <ContaModal conta={contaModal === 'new' ? undefined : contas.find(c => c.id === contaModal)}
                onClose={() => setContaModal(null)} onSaved={() => { setContaModal(null); carregar(); }} />
        )}
        {motivoModal !== null && (
            <MotivoModal motivo={motivoModal === 'new' ? undefined : motivos.find(m => m.id === motivoModal)}
                onClose={() => setMotivoModal(null)} onSaved={() => { setMotivoModal(null); carregar(); }} />
        )}
    </>;
};

/* ════ Documento — formulário gerado pela matriz ════════════════ */
const valoresDoDocumento = (m: Matriz, d?: DocumentoConfig): ValoresConfig =>
    Object.fromEntries(m.campos.map(c => [c.codigo, d ? (d as any)[c.codigo] : (c.tipoValor === 'BOOLEAN' ? false : c.tipoValor === 'CONTAS_REF' ? [] : null)]));

const DocumentoModal: React.FC<{
    dados: Dados;
    documento?: DocumentoConfig;
    tipoDesc: (c: string) => string;
    podeEditar: boolean;
    onClose: () => void;
    onChanged: () => void;
    onCreated: (id: number) => void;
    onDelete: (d: DocumentoConfig) => void;
}> = ({ dados, documento, tipoDesc, podeEditar, onClose, onChanged, onCreated, onDelete }) => {
    const { matriz, documentos, ccTipos, contas } = dados;
    const isNew = !documento;
    const bloqueado = !!documento?.emUso;              // R2
    const ro = !podeEditar;
    const roConfig = ro || bloqueado;

    const [codigo, setCodigo] = useState(documento?.codigo ?? '');
    const [descricao, setDescricao] = useState(documento?.descricao ?? '');
    const [tipoCodigo, setTipoCodigo] = useState(documento?.tipoCodigo ?? matriz.tipos[0]?.codigo ?? '');
    const [ativo, setAtivo] = useState(documento?.ativo ?? true);
    const [valores, setValores] = useState<ValoresConfig>(() => valoresDoDocumento(matriz, documento));
    const [erros, setErros] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    const disp = useMemo(() => camposDisponiveis(matriz, tipoCodigo, valores), [matriz, tipoCodigo, valores]);
    const campos = useMemo(() => [...matriz.campos].sort((a, b) => a.ordem - b.ordem).filter(c => disp.has(c.codigo)), [matriz, disp]);

    const set = (campo: string, v: unknown) =>
        setValores(prev => limparIndisponiveis(matriz, tipoCodigo, { ...prev, [campo]: v }));
    const mudarTipo = (t: string) => { setTipoCodigo(t); setValores(prev => limparIndisponiveis(matriz, t, prev)); };

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true); setErros({});
        const dto: ValoresConfig = bloqueado
            ? { descricao, ativo }                               // R2: só o descritivo muda
            : { codigo, descricao, tipoCodigo, ativo, ...valores };
        try {
            if (isNew) {
                const criado = await vendasConfigApi.criarDocumento(dto);
                showToast(`Documento ${criado.codigo} criado. Crie agora a sua série.`, 'success');
                onCreated(criado.id);
            } else {
                await vendasConfigApi.atualizarDocumento(documento!.id, dto);
                showToast(`Documento ${codigo} guardado`, 'success');
                onChanged(); onClose();
            }
        } catch (err) {
            const fe = extractFieldErrors(err);
            setErros(fe);
            if (!Object.keys(fe).length) showToast(extractErrorMessage(err), 'error');
        } finally { setSubmitting(false); }
    };

    /** Opções de um campo de referência, filtradas pelos metadados do campo. */
    const opcoes = (c: DocCampo): { value: string; label: string }[] => {
        switch (c.tipoValor) {
            case 'ENUM':
                return dominio(matriz, tipoCodigo, c.codigo).map(d => ({ value: d.valor, label: d.descricao }));
            case 'DOC_REF': {
                const inverso = dominio(matriz, tipoCodigo, 'natureza').find(d => d.valor === valores.natureza)?.inverso;
                return documentos
                    .filter(d => d.id !== documento?.id && (d.ativo || d.id === valores[c.codigo]))
                    .filter(d => c.alvoRegra === 'TIPO_FIXO' ? d.tipoCodigo === c.alvoTipoCodigo
                        : d.tipoCodigo === tipoCodigo && (!dominio(matriz, tipoCodigo, 'natureza').length || d.natureza === inverso))
                    .map(d => ({ value: String(d.id), label: `${d.codigo} — ${d.descricao}` }));
            }
            case 'SERIE_REF': {
                const docId = c.campoRef ? Number(valores[c.campoRef]) : NaN;
                return (documentos.find(d => d.id === docId)?.series ?? [])
                    .map(s => ({ value: String(s.id), label: `${s.codigo} (${s.ano})${s.porDefeito ? ' · por defeito' : ''}` }));
            }
            case 'CC_TIPO_REF': {
                const entidade = c.campoRef ? valores[c.campoRef] : undefined;
                return ccTipos.filter(t => !entidade || t.entidade === entidade)
                    .map(t => ({ value: String(t.id), label: `${t.codigo} — ${t.descricao}` }));
            }
            case 'CC_ESTADO_REF': {
                const ccId = c.campoRef ? Number(valores[c.campoRef]) : NaN;
                return (ccTipos.find(t => t.id === ccId)?.estados ?? [])
                    .map(e => ({ value: String(e.id), label: `${e.codigo} — ${e.descricao}` }));
            }
            default: return [];
        }
    };

    const renderCampo = (c: DocCampo) => {
        const id = `doc-${c.codigo}`;
        const errId = `${id}-err`;
        const erro = erros[c.codigo];
        const sub = eSubCampo(matriz, c.codigo);
        const wrap: React.CSSProperties = sub ? { marginLeft: 18, paddingLeft: 10, borderLeft: '2px solid var(--blue-border)' } : {};
        const label = <>{sub && <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>↳ </span>}{c.descricao}</>;

        if (c.tipoValor === 'BOOLEAN') {
            return (
                <div key={c.codigo} className="toggle-row" style={wrap}>
                    <div className="toggle-info"><div className="toggle-title">{label}</div><FieldError id={errId} message={erro} /></div>
                    <label className="toggle">
                        <input id={id} type="checkbox" disabled={roConfig} checked={!!valores[c.codigo]}
                            onChange={e => set(c.codigo, e.target.checked)} {...fieldAria(errId, erro)} />
                        <span className="toggle-slider" />
                    </label>
                </div>
            );
        }
        if (c.tipoValor === 'CONTAS_REF') {
            const sel = (valores[c.codigo] as number[]) ?? [];
            return (
                <div key={c.codigo} className="form-group" style={{ ...wrap, marginBottom: 10 }}>
                    <span className="form-label req">{label}</span>
                    <div role="group" aria-label={c.descricao} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
                        {contas.filter(ct => ct.ativo || sel.includes(ct.id)).map(ct => (
                            <label key={ct.id} style={{ ...small, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <input type="checkbox" disabled={roConfig} checked={sel.includes(ct.id)}
                                    onChange={e => set(c.codigo, e.target.checked ? [...sel, ct.id] : sel.filter(x => x !== ct.id))} />
                                {ct.codigo} — {ct.descricao}
                            </label>
                        ))}
                        {!contas.length && <span style={muted}>Crie primeiro uma conta bancária ou caixa.</span>}
                    </div>
                    <FieldError id={errId} message={erro} />
                </div>
            );
        }
        const ops = opcoes(c);
        const v = valores[c.codigo];
        return (
            <div key={c.codigo} className="form-group" style={{ ...wrap, marginBottom: 10 }}>
                <label className="form-label req" htmlFor={id}>{label}</label>
                <select id={id} className="form-select" disabled={roConfig} value={v === null || v === undefined ? '' : String(v)}
                    onChange={e => set(c.codigo, e.target.value === '' ? null : c.tipoValor === 'ENUM' ? e.target.value : Number(e.target.value))}
                    {...fieldAria(errId, erro)}>
                    <option value="">— seleccionar —</option>
                    {ops.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {!ops.length && c.tipoValor === 'DOC_REF' && (
                    <span className="form-hint">
                        Nenhum documento elegível. {c.alvoRegra === 'TIPO_FIXO'
                            ? `Crie primeiro um documento do tipo ${tipoDesc(c.alvoTipoCodigo ?? '')}.`
                            : 'Crie primeiro um documento do mesmo tipo com natureza inversa.'}
                    </span>
                )}
                <FieldError id={errId} message={erro} />
            </div>
        );
    };

    return (
        <Modal
            titulo={isNew ? 'Novo documento' : `Documento ${documento!.codigo}`}
            largura={680}
            onClose={onClose}
            footer={<>
                {!isNew && podeEditar && !bloqueado && (
                    <button type="button" className="abtn abtn-secondary" style={{ marginRight: 'auto', color: 'var(--red)' }} onClick={() => onDelete(documento!)}>
                        <Trash2 size={12} /> Eliminar
                    </button>
                )}
                <button type="button" className="abtn abtn-secondary" onClick={onClose}>{ro ? 'Fechar' : 'Cancelar'}</button>
                {!ro && <SubmitButton submitting={submitting} form="form-documento-config">Guardar</SubmitButton>}
            </>}
        >
            <form id="form-documento-config" onSubmit={guardar} noValidate>
                {bloqueado && (
                    <div role="note" style={{ ...small, background: 'var(--blue-s-bg)', color: 'var(--blue-s)', padding: '8px 10px', borderRadius: 6, marginBottom: 12 }}>
                        <Lock size={11} /> Este documento já foi utilizado: a configuração está bloqueada. Só a descrição e o estado activo podem mudar.
                    </div>
                )}
                <div className="form-row" style={{ marginBottom: 10 }}>
                    <div className="form-group">
                        <label className="form-label req" htmlFor="doc-codigo">Código</label>
                        <input id="doc-codigo" className="form-input" maxLength={10} disabled={roConfig} value={codigo}
                            onChange={e => setCodigo(e.target.value.toUpperCase())} {...fieldAria('doc-codigo-err', erros.codigo)} />
                        <FieldError id="doc-codigo-err" message={erros.codigo} />
                    </div>
                    <div className="form-group">
                        <label className="form-label req" htmlFor="doc-tipo">Tipo de documento</label>
                        <select id="doc-tipo" className="form-select" disabled={roConfig} value={tipoCodigo}
                            onChange={e => mudarTipo(e.target.value)} {...fieldAria('doc-tipo-err', erros.tipoCodigo)}>
                            {matriz.tipos.map(t => <option key={t.codigo} value={t.codigo}>{t.descricao}</option>)}
                        </select>
                        <FieldError id="doc-tipo-err" message={erros.tipoCodigo} />
                    </div>
                </div>
                <div className="form-group" style={{ marginBottom: 10 }}>
                    <label className="form-label req" htmlFor="doc-descricao">Descrição</label>
                    <input id="doc-descricao" className="form-input" maxLength={150} disabled={ro} value={descricao}
                        onChange={e => setDescricao(e.target.value)} {...fieldAria('doc-descricao-err', erros.descricao)} />
                    <FieldError id="doc-descricao-err" message={erros.descricao} />
                </div>
                <div className="toggle-row" style={{ marginBottom: 6 }}>
                    <div className="toggle-info"><div className="toggle-title">Activo</div><div className="toggle-desc">Documentos inactivos não podem ser emitidos nem apontados</div></div>
                    <label className="toggle">
                        <input type="checkbox" disabled={ro} checked={ativo} onChange={e => setAtivo(e.target.checked)} />
                        <span className="toggle-slider" />
                    </label>
                </div>

                <div style={{ ...muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '14px 0 8px' }}>
                    Configuração — {tipoDesc(tipoCodigo)}
                </div>
                {campos.length ? campos.map(renderCampo) : <div style={muted}>Este tipo não tem opções de configuração.</div>}
            </form>

            {!isNew && <SeriesPanel documento={documento!} podeEditar={podeEditar} onChanged={onChanged} />}
        </Modal>
    );
};

/* ════ Séries de um documento ═══════════════════════════════════ */
const SeriesPanel: React.FC<{ documento: DocumentoConfig; podeEditar: boolean; onChanged: () => void }> = ({ documento, podeEditar, onChanged }) => {
    const confirm = useConfirm();
    const anoAtual = new Date().getFullYear();
    const [novo, setNovo] = useState({ codigo: String(anoAtual), ano: anoAtual, limiteInferior: 0, limiteSuperior: 99999999 });
    const [erros, setErros] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [series, setSeries] = useState<Serie[]>(documento.series);
    useEffect(() => setSeries(documento.series), [documento.series]);

    const acao = async (fn: () => Promise<unknown>, ok: string) => {
        try { await fn(); showToast(ok, 'success'); onChanged(); }
        catch (e) { showToast(extractErrorMessage(e), 'error'); }
    };

    const criar = async () => {
        setSubmitting(true); setErros({});
        try {
            await vendasConfigApi.criarSerie({ documentoConfigId: documento.id, ...novo });
            showToast(`Série ${novo.codigo} criada`, 'success');
            setNovo(n => ({ ...n, codigo: '' }));
            onChanged();
        } catch (e) {
            const fe = extractFieldErrors(e);
            setErros(fe);
            if (!Object.keys(fe).length) showToast(extractErrorMessage(e), 'error');
        } finally { setSubmitting(false); }
    };

    return (
        <div style={{ marginTop: 18 }}>
            <div style={{ ...muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Séries</div>
            <table className="data-table" style={{ marginBottom: 8 }}>
                <thead><tr><th>Série</th><th>Período</th><th>Limites</th><th>Último n.º</th><th>Estado</th><th style={{ width: 90 }} /></tr></thead>
                <tbody>
                    {series.map(s => (
                        <tr key={s.id}>
                            <td style={{ fontWeight: 700 }}>{s.codigo} {s.porDefeito && <Star size={10} aria-label="por defeito" style={{ color: 'var(--orange)' }} />}</td>
                            <td style={small}>{s.dataInicial.split('-').reverse().join('/')} – {s.dataFinal.split('-').reverse().join('/')}</td>
                            <td style={small}>{s.limiteInferior} – {s.limiteSuperior}</td>
                            <td style={small}>{s.ultimoNumero ?? '—'}</td>
                            <td>{!s.ativo ? <Badge tone="inactive">Inactiva</Badge> : s.emUso ? <Badge tone="suporte"><Lock size={9} /> Em uso</Badge> : <Badge tone="active">Livre</Badge>}</td>
                            <td>{podeEditar && <div className="row-actions">
                                {!s.porDefeito && s.ativo && (
                                    <button type="button" className="icon-btn" title="Tornar série por defeito" aria-label={`Tornar ${s.codigo} por defeito`}
                                        onClick={() => acao(() => vendasConfigApi.atualizarSerie(s.id, { porDefeito: true }), `Série ${s.codigo} por defeito`)}>
                                        <Star size={12} />
                                    </button>
                                )}
                                <button type="button" className="icon-btn" title={s.ativo ? 'Desactivar' : 'Activar'} aria-label={`${s.ativo ? 'Desactivar' : 'Activar'} ${s.codigo}`}
                                    onClick={() => acao(() => vendasConfigApi.atualizarSerie(s.id, { ativo: !s.ativo }), `Série ${s.codigo} ${s.ativo ? 'desactivada' : 'activada'}`)}>
                                    {s.ativo ? <X size={12} /> : <Plus size={12} />}
                                </button>
                                {!s.emUso && (
                                    <button type="button" className="icon-btn" title="Eliminar" aria-label={`Eliminar série ${s.codigo}`}
                                        onClick={async () => {
                                            if (await confirm({ title: `Eliminar a série ${s.codigo}?`, message: 'A série não tem documentos emitidos.', confirmLabel: 'Eliminar', variant: 'danger' })) {
                                                acao(() => vendasConfigApi.eliminarSerie(s.id), `Série ${s.codigo} eliminada`);
                                            }
                                        }}>
                                        <Trash2 size={12} />
                                    </button>
                                )}
                            </div>}</td>
                        </tr>
                    ))}
                    {!series.length && <tr><td colSpan={6} style={{ ...small, color: 'var(--orange)' }}>Sem séries — o documento não pode ser emitido até ter uma.</td></tr>}
                </tbody>
            </table>
            {podeEditar && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {([
                        ['codigo', 'Série', 'text', 90],
                        ['ano', 'Ano', 'number', 80],
                        ['limiteInferior', 'Limite inferior', 'number', 110],
                        ['limiteSuperior', 'Limite superior', 'number', 120],
                    ] as const).map(([k, label, type, w]) => (
                        <div key={k} style={{ display: 'flex', flexDirection: 'column', width: w }}>
                            <label htmlFor={`serie-${k}`} style={muted}>{label}</label>
                            <input id={`serie-${k}`} type={type} className="form-input" style={{ height: 30, fontSize: '0.78rem', padding: '4px 8px' }}
                                value={(novo as any)[k]} onChange={e => setNovo(n => ({ ...n, [k]: type === 'number' ? Number(e.target.value) : e.target.value.toUpperCase() }))}
                                {...fieldAria(`serie-${k}-err`, erros[k])} />
                            <FieldError id={`serie-${k}-err`} message={erros[k]} />
                        </div>
                    ))}
                    <SubmitButton type="button" submitting={submitting} loadingLabel="A criar…" onClick={criar}
                        style={{ alignSelf: 'flex-end', height: 30, fontSize: '0.78rem', padding: '4px 12px' }} icon={<Plus size={11} />}>
                        Nova série
                    </SubmitButton>
                </div>
            )}
            <div className="form-hint" style={{ marginTop: 6 }}>
                A série cobre sempre o ano civil completo. Depois do primeiro documento emitido, o código, o ano e os limites ficam bloqueados.
                Para registar um documento com data anterior ao último da série, crie uma série nova.
            </div>
        </div>
    );
};

/* ════ Conta corrente ═══════════════════════════════════════════ */
const CcTipoModal: React.FC<{ ccTipo?: CcTipo; onClose: () => void; onSaved: () => void }> = ({ ccTipo, onClose, onSaved }) => {
    const [form, setForm] = useState({ codigo: ccTipo?.codigo ?? '', descricao: ccTipo?.descricao ?? '', entidade: ccTipo?.entidade ?? 'CLIENTE' as 'CLIENTE' | 'FORNECEDOR' });
    const [estados, setEstados] = useState(ccTipo?.estados.map(e => ({ ...e })) ?? [{ codigo: 'PEN', descricao: 'Pendente' }]);
    const [erros, setErros] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault(); setSubmitting(true); setErros({});
        try {
            const dto = { ...form, estados };
            if (ccTipo) await vendasConfigApi.atualizarCcTipo(ccTipo.id, dto); else await vendasConfigApi.criarCcTipo(dto);
            showToast(`Conta corrente ${form.codigo} guardada`, 'success'); onSaved();
        } catch (err) {
            const fe = extractFieldErrors(err); setErros(fe);
            if (!Object.keys(fe).length) showToast(extractErrorMessage(err), 'error');
        } finally { setSubmitting(false); }
    };

    return (
        <Modal titulo={ccTipo ? `Conta corrente ${ccTipo.codigo}` : 'Nova conta corrente'} onClose={onClose}
            footer={<><button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                <SubmitButton submitting={submitting} form="form-cc">Guardar</SubmitButton></>}>
            <form id="form-cc" onSubmit={guardar} noValidate>
                <div className="form-row" style={{ marginBottom: 10 }}>
                    <div className="form-group">
                        <label className="form-label req" htmlFor="cc-codigo">Código</label>
                        <input id="cc-codigo" className="form-input" maxLength={10} value={form.codigo}
                            onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} {...fieldAria('cc-codigo-err', erros.codigo)} />
                        <FieldError id="cc-codigo-err" message={erros.codigo} />
                    </div>
                    <div className="form-group">
                        <label className="form-label req" htmlFor="cc-entidade">Entidade</label>
                        <select id="cc-entidade" className="form-select" value={form.entidade}
                            onChange={e => setForm(f => ({ ...f, entidade: e.target.value as any }))} {...fieldAria('cc-entidade-err', erros.entidade)}>
                            <option value="CLIENTE">Cliente</option><option value="FORNECEDOR">Fornecedor</option>
                        </select>
                        <FieldError id="cc-entidade-err" message={erros.entidade} />
                    </div>
                </div>
                <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label req" htmlFor="cc-descricao">Descrição</label>
                    <input id="cc-descricao" className="form-input" maxLength={150} value={form.descricao}
                        onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} {...fieldAria('cc-descricao-err', erros.descricao)} />
                    <FieldError id="cc-descricao-err" message={erros.descricao} />
                </div>
                <span className="form-label">Estados possíveis</span>
                {estados.map((est, i) => (
                    <div key={est.id ?? `n${i}`} style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <input className="form-input" aria-label={`Código do estado ${i + 1}`} style={{ width: 90 }} maxLength={10} value={est.codigo}
                            onChange={e => setEstados(l => l.map((x, j) => j === i ? { ...x, codigo: e.target.value.toUpperCase() } : x))} />
                        <input className="form-input" aria-label={`Descrição do estado ${i + 1}`} style={{ flex: 1 }} maxLength={150} value={est.descricao}
                            onChange={e => setEstados(l => l.map((x, j) => j === i ? { ...x, descricao: e.target.value } : x))} />
                        <button type="button" className="icon-btn" aria-label={`Remover estado ${est.codigo}`} onClick={() => setEstados(l => l.filter((_, j) => j !== i))}><X size={12} /></button>
                    </div>
                ))}
                <FieldError id="cc-estados-err" message={erros.estados ?? Object.entries(erros).find(([k]) => k.startsWith('estados.'))?.[1]} />
                <button type="button" className="abtn abtn-secondary" style={{ marginTop: 8, fontSize: '0.75rem' }}
                    onClick={() => setEstados(l => [...l, { codigo: '', descricao: '' }])}><Plus size={11} /> Estado</button>
            </form>
        </Modal>
    );
};

/* ════ Conta bancária / caixa ═══════════════════════════════════ */
const ContaModal: React.FC<{ conta?: ContaBancaria; onClose: () => void; onSaved: () => void }> = ({ conta, onClose, onSaved }) => {
    const [form, setForm] = useState({
        codigo: conta?.codigo ?? '', descricao: conta?.descricao ?? '', tipo: conta?.tipo ?? 'DO' as 'CAIXA' | 'DO',
        banco: conta?.banco ?? '', numero: conta?.numero ?? '', iban: conta?.iban ?? '', agencia: conta?.agencia ?? '',
        titular: conta?.titular ?? '', gestor: conta?.gestor ?? '', contactos: conta?.contactos ?? '', ativo: conta?.ativo ?? true,
    });
    const [erros, setErros] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault(); setSubmitting(true); setErros({});
        const dto = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : v]));
        try {
            if (conta) await vendasConfigApi.atualizarConta(conta.id, dto); else await vendasConfigApi.criarConta(dto);
            showToast(`Conta ${form.codigo} guardada`, 'success'); onSaved();
        } catch (err) {
            const fe = extractFieldErrors(err); setErros(fe);
            if (!Object.keys(fe).length) showToast(extractErrorMessage(err), 'error');
        } finally { setSubmitting(false); }
    };

    const campo = (k: keyof typeof form, label: string, req = false, max = 150) => (
        <div className="form-group">
            <label className={`form-label${req ? ' req' : ''}`} htmlFor={`conta-${k}`}>{label}</label>
            <input id={`conta-${k}`} className="form-input" maxLength={max} value={form[k] as string}
                onChange={e => setForm(f => ({ ...f, [k]: k === 'codigo' ? e.target.value.toUpperCase() : e.target.value }))}
                {...fieldAria(`conta-${k}-err`, erros[k])} />
            <FieldError id={`conta-${k}-err`} message={erros[k]} />
        </div>
    );

    return (
        <Modal titulo={conta ? `Conta ${conta.codigo}` : 'Nova conta bancária ou caixa'} onClose={onClose}
            footer={<><button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                <SubmitButton submitting={submitting} form="form-conta">Guardar</SubmitButton></>}>
            <form id="form-conta" onSubmit={guardar} noValidate style={{ display: 'grid', gap: 10 }}>
                <div className="form-row">
                    {campo('codigo', 'Código', true, 20)}
                    <div className="form-group">
                        <label className="form-label req" htmlFor="conta-tipo">Tipo</label>
                        <select id="conta-tipo" className="form-select" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as any }))}
                            {...fieldAria('conta-tipo-err', erros.tipo)}>
                            <option value="DO">Depósito à ordem</option><option value="CAIXA">Caixa (numerário)</option>
                        </select>
                        <FieldError id="conta-tipo-err" message={erros.tipo} />
                    </div>
                </div>
                {campo('descricao', 'Descrição', true)}
                {form.tipo === 'DO' && <>
                    <div className="form-row">{campo('banco', 'Banco', false, 100)}{campo('agencia', 'Agência', false, 100)}</div>
                    <div className="form-row">{campo('numero', 'N.º de conta', false, 50)}{campo('iban', 'IBAN', false, 50)}</div>
                    <div className="form-row">{campo('titular', 'Titular')}{campo('gestor', 'Gestor de conta')}</div>
                    {campo('contactos', 'Contactos')}
                </>}
                <div className="toggle-row">
                    <div className="toggle-info"><div className="toggle-title">Activa</div></div>
                    <label className="toggle"><input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} /><span className="toggle-slider" /></label>
                </div>
                <div className="form-hint">Moeda: AOA. O estado aberta/fechada de uma caixa é gerido pela gestão de caixa, não aqui.</div>
            </form>
        </Modal>
    );
};

/* ════ Motivo de estorno ═══════════════════════════════════════ */
const MotivoModal: React.FC<{ motivo?: MotivoEstorno; onClose: () => void; onSaved: () => void }> = ({ motivo, onClose, onSaved }) => {
    const [form, setForm] = useState({ codigo: motivo?.codigo ?? '', descricao: motivo?.descricao ?? '', ativo: motivo?.ativo ?? true });
    const [erros, setErros] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault(); setSubmitting(true); setErros({});
        try {
            if (motivo) await vendasConfigApi.atualizarMotivo(motivo.id, form); else await vendasConfigApi.criarMotivo(form);
            showToast(`Motivo ${form.codigo} guardado`, 'success'); onSaved();
        } catch (err) {
            const fe = extractFieldErrors(err); setErros(fe);
            if (!Object.keys(fe).length) showToast(extractErrorMessage(err), 'error');
        } finally { setSubmitting(false); }
    };

    return (
        <Modal titulo={motivo ? `Motivo ${motivo.codigo}` : 'Novo motivo de estorno'} largura={460} onClose={onClose}
            footer={<><button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                <SubmitButton submitting={submitting} form="form-motivo">Guardar</SubmitButton></>}>
            <form id="form-motivo" onSubmit={guardar} noValidate style={{ display: 'grid', gap: 10 }}>
                <div className="form-group">
                    <label className="form-label req" htmlFor="motivo-codigo">Código</label>
                    <input id="motivo-codigo" className="form-input" maxLength={10} value={form.codigo}
                        onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase() }))} {...fieldAria('motivo-codigo-err', erros.codigo)} />
                    <FieldError id="motivo-codigo-err" message={erros.codigo} />
                </div>
                <div className="form-group">
                    <label className="form-label req" htmlFor="motivo-descricao">Descrição</label>
                    <input id="motivo-descricao" className="form-input" maxLength={150} value={form.descricao}
                        onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} {...fieldAria('motivo-descricao-err', erros.descricao)} />
                    <FieldError id="motivo-descricao-err" message={erros.descricao} />
                </div>
                <div className="toggle-row">
                    <div className="toggle-info"><div className="toggle-title">Activo</div></div>
                    <label className="toggle"><input type="checkbox" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} /><span className="toggle-slider" /></label>
                </div>
            </form>
        </Modal>
    );
};

export default DocumentosVendasTab;
