import React, { useState, useRef } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import { useGlobal } from '../../contexts/GlobalContext';
import {
    Building2, DollarSign, TrendingUp, Shield, Upload, Check,
    Table2, Plus, X, Edit2,
} from 'lucide-react';

/* ── Types ── */
type Tab = 'empresa' | 'moeda' | 'comissoes' | 'seguranca' | 'tabelas';

const TABS: { id: Tab; label: string; icon: React.FC<any> }[] = [
    { id: 'empresa',  label: 'Empresa',          icon: Building2 },
    { id: 'moeda',    label: 'Moeda & Financeiro', icon: DollarSign },
    { id: 'comissoes',label: 'Comissões',          icon: TrendingUp },
    { id: 'tabelas',  label: 'Tabelas do Sistema', icon: Table2 },
    { id: 'seguranca',label: 'Segurança',           icon: Shield },
];

/* ── Initial state ── */
const initEmpresa = {
    nome: '', nif: '', morada: '', telefone: '', email: '', website: '',
    iban: '', banco: '', latitude: '', longitude: '', rodapeDocumentos: '',
    logo: null as string | null,
};

const initMoeda = {
    currency: 'AOA', symbol: 'Kz', decimals: '2', separador: ',', dateFormat: 'DD/MM/YYYY',
};

const initComissoes = {
    montagem: '80', preventiva: '40', corretiva: '50', remota: '25', vendaPercent: '3',
};

const initSeguranca = {
    minPassword: '8', sessionExpiry: '60', twoFactor: false, accessLog: true,
};

/* ════════════════════════════════════════════════
  MAIN PAGE
════════════════════════════════════════════════ */
/* ── Tabelas do Sistema ── */
const TabelaInlineEditor: React.FC<{
    titulo: string;
    colunas: { key: string; label: string; type?: 'text' | 'number' }[];
    rows: Record<string, any>[];
    onAdd: (row: Record<string, any>) => void;
    onUpdate: (id: string, field: string, val: any) => void;
    onRemove: (id: string) => void;
}> = ({ titulo, colunas, rows, onAdd, onUpdate, onRemove }) => {
    const emptyRow = () => Object.fromEntries(colunas.map(c => [c.key, c.type === 'number' ? 0 : '']));
    const [newRow, setNewRow] = useState<Record<string, any>>(emptyRow());
    const [editId, setEditId] = useState<string | null>(null);

    return (
        <div className="settings-section">
            <div className="settings-section-hdr">
                <div className="settings-section-title">{titulo}</div>
            </div>
            <div className="settings-section-body">
                <table className="data-table" style={{ marginBottom: 8 }}>
                    <thead>
                        <tr>
                            {colunas.map(c => <th key={c.key}>{c.label}</th>)}
                            <th style={{ width: 70 }} />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(r => (
                            <tr key={r.id}>
                                {colunas.map(c => (
                                    <td key={c.key}>
                                        {editId === r.id ? (
                                            <input
                                                type={c.type === 'number' ? 'number' : 'text'}
                                                className="form-input"
                                                style={{ padding: '3px 6px', height: 28, fontSize: '0.78rem' }}
                                                value={r[c.key]}
                                                onChange={e => onUpdate(r.id, c.key, c.type === 'number' ? Number(e.target.value) : e.target.value)}
                                            />
                                        ) : (
                                            <span style={{ fontSize: '0.8rem' }}>{r[c.key]}</span>
                                        )}
                                    </td>
                                ))}
                                <td>
                                    <div className="row-actions">
                                        <button className="icon-btn" title={editId === r.id ? 'Concluir' : 'Editar'}
                                            onClick={() => setEditId(editId === r.id ? null : r.id)}>
                                            {editId === r.id ? <Check size={12} /> : <Edit2 size={12} />}
                                        </button>
                                        <button className="icon-btn" title="Remover" onClick={() => onRemove(r.id)}>
                                            <X size={12} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {/* New row */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {colunas.map(c => (
                        <input key={c.key} type={c.type === 'number' ? 'number' : 'text'}
                            className="form-input" placeholder={c.label}
                            style={{ flex: 1, minWidth: 80, padding: '4px 8px', height: 30, fontSize: '0.78rem' }}
                            value={newRow[c.key]}
                            onChange={e => setNewRow(p => ({ ...p, [c.key]: c.type === 'number' ? Number(e.target.value) : e.target.value }))}
                        />
                    ))}
                    <button type="button" className="abtn abtn-primary" style={{ flexShrink: 0, fontSize: '0.78rem', padding: '4px 12px', height: 30 }}
                        onClick={() => { onAdd(newRow); setNewRow(emptyRow()); }}>
                        <Plus size={11} /> Adicionar
                    </button>
                </div>
            </div>
        </div>
    );
};

const ConfiguracoesPage: React.FC = () => {
    const {
        tiposTrabalho, addTipoTrabalho, updateTipoTrabalho, removeTipoTrabalho,
        tiposOT, addTipoOT, updateTipoOT, removeTipoOT,
        funcoesTecnico, addFuncaoTecnico, updateFuncaoTecnico, removeFuncaoTecnico,
        tiposDocumento, addTipoDocumento, updateTipoDocumento, removeTipoDocumento,
        armazens, addArmazem, updateArmazem,
        moedas,
        taxaIvaGlobal, setTaxaIvaGlobal,
        taxasIva, addTaxaIva, updateTaxaIva, removeTaxaIva,
        empresaConfig, updateEmpresaConfig,
    } = useGlobal();

    const [tab, setTab] = useState<Tab>('empresa');
    const [empresa, setEmpresa] = useState(() => ({
        ...initEmpresa,
        nome: empresaConfig.nome, nif: empresaConfig.nif, morada: empresaConfig.morada,
        telefone: empresaConfig.telefone, email: empresaConfig.email, website: empresaConfig.website ?? '',
        iban: empresaConfig.iban, banco: empresaConfig.banco,
        latitude: empresaConfig.latitude?.toString() ?? '',
        longitude: empresaConfig.longitude?.toString() ?? '',
        rodapeDocumentos: empresaConfig.rodapeDocumentos ?? '',
        logo: empresaConfig.logoUrl ?? null,
    }));
    const [moeda, setMoeda] = useState(() => ({
        ...initMoeda,
        currency: empresaConfig.moeda || initMoeda.currency,
        symbol: moedas.find(m => m.codigo === (empresaConfig.moeda || initMoeda.currency))?.simbolo ?? initMoeda.symbol,
        decimals: empresaConfig.casasDecimais !== undefined ? String(empresaConfig.casasDecimais) : initMoeda.decimals,
        dateFormat: empresaConfig.formatoData || initMoeda.dateFormat,
    }));
    const [comissoes, setComissoes] = useState(initComissoes);
    const [seguranca, setSeguranca] = useState(initSeguranca);
    const [dirty, setDirty] = useState(false);
    const [toast, setToast] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const markDirty = () => setDirty(true);

    const setE = (k: keyof typeof initEmpresa) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setEmpresa(p => ({ ...p, [k]: e.target.value })); markDirty(); };
    const setM = (k: keyof typeof initMoeda) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setMoeda(p => ({ ...p, [k]: e.target.value })); markDirty(); };
    const setC = (k: keyof typeof initComissoes) => (e: React.ChangeEvent<HTMLInputElement>) => { setComissoes(p => ({ ...p, [k]: e.target.value })); markDirty(); };
    const setS = (k: keyof typeof initSeguranca) => (e: React.ChangeEvent<HTMLInputElement>) => { setSeguranca(p => ({ ...p, [k]: e.target.value })); markDirty(); };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = ev => { setEmpresa(p => ({ ...p, logo: ev.target?.result as string })); markDirty(); };
        reader.readAsDataURL(f);
    };

    const save = async () => {
        try {
            await updateEmpresaConfig({
                nome: empresa.nome, nif: empresa.nif, morada: empresa.morada,
                telefone: empresa.telefone, email: empresa.email, website: empresa.website,
                iban: empresa.iban, banco: empresa.banco,
                latitude: empresa.latitude ? Number(empresa.latitude) : undefined,
                longitude: empresa.longitude ? Number(empresa.longitude) : undefined,
                rodapeDocumentos: empresa.rodapeDocumentos,
                logoUrl: empresa.logo ?? undefined,
                moeda: moeda.currency,
                casasDecimais: Number(moeda.decimals),
                formatoData: moeda.dateFormat,
            });
        } catch (e) { console.error('save empresa error', e); }
        setDirty(false);
        setToast(true);
        setTimeout(() => setToast(false), 3000);
    };

    const discard = () => {
        setEmpresa({
            ...initEmpresa,
            nome: empresaConfig.nome, nif: empresaConfig.nif, morada: empresaConfig.morada,
            telefone: empresaConfig.telefone, email: empresaConfig.email, website: empresaConfig.website ?? '',
            iban: empresaConfig.iban, banco: empresaConfig.banco,
            latitude: empresaConfig.latitude?.toString() ?? '',
            longitude: empresaConfig.longitude?.toString() ?? '',
            rodapeDocumentos: empresaConfig.rodapeDocumentos ?? '',
            logo: empresaConfig.logoUrl ?? null,
        });
        setMoeda({
            ...initMoeda,
            currency: empresaConfig.moeda || initMoeda.currency,
            symbol: moedas.find(m => m.codigo === (empresaConfig.moeda || initMoeda.currency))?.simbolo ?? initMoeda.symbol,
            decimals: empresaConfig.casasDecimais !== undefined ? String(empresaConfig.casasDecimais) : initMoeda.decimals,
            dateFormat: empresaConfig.formatoData || initMoeda.dateFormat,
        });
        setComissoes(initComissoes); setSeguranca(initSeguranca);
        setDirty(false);
    };

    const selectedCurrency = moedas.find(m => m.codigo === moeda.currency) ?? moedas[0];

    /* Helpers */
    const Field = ({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: any; placeholder?: string; type?: string }) => (
        <div className="form-group">
            <label className="form-label req">{label}</label>
            <input type={type} className="form-input" value={value} onChange={onChange} placeholder={placeholder} />
        </div>
    );

    return (
        <AppLayout>
            <ActionBar title="Configurações do Sistema" breadcrumb="AQUATEX SGI · Administração · Configurações">
                <div className="actionbar-spacer" />
                {dirty && <>
                    <button className="abtn abtn-secondary" onClick={discard} type="button">Descartar</button>
                    <button className="abtn abtn-primary" onClick={save} type="button">Guardar Alterações</button>
                </>}
            </ActionBar>

            <div className="page-content">
                <div className="settings-layout">

                    {/* Left tabs */}
                    <div className="settings-tabs">
                        {TABS.map(t => (
                            <button
                                key={t.id}
                                id={`tab-${t.id}`}
                                className={`settings-tab${tab === t.id ? ' active' : ''}`}
                                onClick={() => setTab(t.id)}
                                type="button"
                            >
                                <t.icon size={14} />
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Right content */}
                    <div className="settings-content">

                        {/* ── EMPRESA ── */}
                        {tab === 'empresa' && <>
                            <div className="settings-section">
                                <div className="settings-section-hdr">
                                    <div className="settings-section-title">Logótipo da Empresa</div>
                                    <div className="settings-section-desc">Utilizado em faturas, OS e no cabeçalho do sistema</div>
                                </div>
                                <div className="settings-section-body">
                                    <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                                    <div className="logo-upload" onClick={() => fileRef.current?.click()} role="button" tabIndex={0}>
                                        {empresa.logo
                                            ? <img src={empresa.logo} alt="Logo" />
                                            : <Upload size={32} style={{ margin: 'auto', color: 'var(--text-muted)' }} />
                                        }
                                        <div className="logo-upload-hint">
                                            {empresa.logo ? 'Clique para alterar' : 'Clique para carregar o logo'}
                                            <br />PNG, SVG ou JPG — recomendado fundo transparente, máx. 2 MB
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="settings-section">
                                <div className="settings-section-hdr">
                                    <div className="settings-section-title">Dados da Empresa</div>
                                    <div className="settings-section-desc">Informações que aparecem nos documentos emitidos</div>
                                </div>
                                <div className="settings-section-body">
                                    <div className="form-row">
                                        <Field label="Nome da Empresa" value={empresa.nome} onChange={setE('nome')} placeholder="AQUATEX, LDA" />
                                        <Field label="NIF" value={empresa.nif} onChange={setE('nif')} placeholder="5417XXXXXXX" />
                                    </div>
                                    <Field label="Morada" value={empresa.morada} onChange={setE('morada')} placeholder="Rua, Nº, Cidade, País" />
                                    <div className="form-row">
                                        <Field label="Telefone" value={empresa.telefone} onChange={setE('telefone')} placeholder="+244 222 XXX XXX" />
                                        <Field label="Email Institucional" value={empresa.email} onChange={setE('email')} type="email" />
                                    </div>
                                    <Field label="Website" value={empresa.website} onChange={setE('website')} placeholder="www.empresa.ao" />
                                </div>
                            </div>

                            <div className="settings-section">
                                <div className="settings-section-hdr">
                                    <div className="settings-section-title">Dados Bancários</div>
                                    <div className="settings-section-desc">Utilizados nas faturas e documentos financeiros</div>
                                </div>
                                <div className="settings-section-body">
                                    <div className="form-row">
                                        <Field label="Banco" value={empresa.banco} onChange={setE('banco')} placeholder="Banco BFA" />
                                        <Field label="IBAN" value={empresa.iban} onChange={setE('iban')} placeholder="AO06 0006 0000..." />
                                    </div>
                                </div>
                            </div>

                            <div className="settings-section">
                                <div className="settings-section-hdr">
                                    <div className="settings-section-title">Coordenadas Geográficas</div>
                                    <div className="settings-section-desc">Usadas em faturas e localização da empresa</div>
                                </div>
                                <div className="settings-section-body">
                                    <div className="form-row">
                                        <Field label="Latitude" value={empresa.latitude} onChange={setE('latitude')} placeholder="-8.8383" type="text" />
                                        <Field label="Longitude" value={empresa.longitude} onChange={setE('longitude')} placeholder="13.2344" type="text" />
                                    </div>
                                    {empresa.latitude && empresa.longitude && (
                                        <div className="preview-box">
                                            Coordenadas: <strong>{empresa.latitude}, {empresa.longitude}</strong>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="settings-section">
                                <div className="settings-section-hdr">
                                    <div className="settings-section-title">Rodapé dos Documentos</div>
                                    <div className="settings-section-desc">Texto personalizado que aparece no rodapé de faturas e OS</div>
                                </div>
                                <div className="settings-section-body">
                                    <div className="form-group">
                                        <label className="form-label">Texto do Rodapé</label>
                                        <textarea className="form-input" rows={2} style={{ resize: 'vertical' }}
                                            value={empresa.rodapeDocumentos}
                                            onChange={e => { setEmpresa(p => ({ ...p, rodapeDocumentos: e.target.value })); markDirty(); }}
                                            placeholder="Ex: AQUATEX, LDA — Válido como documento fiscal..." />
                                    </div>
                                </div>
                            </div>
                        </>}

                        {/* ── MOEDA ── */}
                        {tab === 'moeda' && <>
                            <div className="settings-section">
                                <div className="settings-section-hdr">
                                    <div className="settings-section-title">Moeda Principal</div>
                                    <div className="settings-section-desc">Utilizada em todos os preços, faturas e comissões</div>
                                </div>
                                <div className="settings-section-body">
                                    <div className="currency-grid">
                                        {moedas.map(m => (
                                            <button
                                                key={m.codigo}
                                                className={`currency-chip${moeda.currency === m.codigo ? ' active' : ''}`}
                                                onClick={() => { setMoeda(p => ({ ...p, currency: m.codigo, symbol: m.simbolo })); markDirty(); }}
                                                type="button"
                                            >
                                                <div className="currency-symbol">{m.simbolo}</div>
                                                <div>
                                                    <div className="currency-code">{m.codigo}</div>
                                                    <div className="currency-name">{m.descricao}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="settings-section">
                                <div className="settings-section-hdr">
                                    <div className="settings-section-title">Formatação de Valores</div>
                                </div>
                                <div className="settings-section-body">
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label req">Símbolo</label>
                                            <input className="form-input" value={moeda.symbol} onChange={setM('symbol')} placeholder="Kz" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label req">Casas Decimais</label>
                                            <select className="form-select" value={moeda.decimals} onChange={setM('decimals')}>
                                                <option value="0">0 casas</option>
                                                <option value="2">2 casas</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="preview-box">
                                        <span>Exemplo: </span>
                                        <strong>
                                            {moeda.symbol} 1{moeda.separador || ','}000{moeda.decimals === '2' ? ',00' : ''}
                                        </strong>
                                    </div>
                                </div>
                            </div>

                            <div className="settings-section">
                                <div className="settings-section-hdr">
                                    <div className="settings-section-title">Formato de Datas</div>
                                    <div className="settings-section-desc">Aplicado em OS, faturas e relatórios</div>
                                </div>
                                <div className="settings-section-body">
                                    <div className="form-group">
                                        <label className="form-label">Formato</label>
                                        <select className="form-select" value={moeda.dateFormat} onChange={setM('dateFormat')}>
                                            <option value="DD/MM/YYYY">DD/MM/YYYY (ex: 06/03/2026)</option>
                                            <option value="MM/DD/YYYY">MM/DD/YYYY (ex: 03/06/2026)</option>
                                            <option value="YYYY-MM-DD">YYYY-MM-DD (ex: 2026-03-06)</option>
                                        </select>
                                    </div>
                                    <div className="preview-box">
                                        <span>Hoje: </span>
                                        <strong>{(() => {
                                            const d = new Date();
                                            const dd = String(d.getDate()).padStart(2, '0');
                                            const mm = String(d.getMonth() + 1).padStart(2, '0');
                                            const yyyy = String(d.getFullYear());
                                            if (moeda.dateFormat === 'YYYY-MM-DD') return `${yyyy}-${mm}-${dd}`;
                                            if (moeda.dateFormat === 'MM/DD/YYYY') return `${mm}/${dd}/${yyyy}`;
                                            return `${dd}/${mm}/${yyyy}`;
                                        })()}</strong>
                                    </div>
                                </div>
                            </div>

                            <div className="settings-section">
                                <div className="settings-section-hdr">
                                    <div className="settings-section-title">Fiscalidade</div>
                                    <div className="settings-section-desc">Tabela de taxas IVA — seleccionável por artigo</div>
                                </div>
                                <div className="settings-section-body">
                                    <TabelaInlineEditor
                                        titulo=""
                                        colunas={[
                                            { key: 'codigo',    label: 'Código' },
                                            { key: 'descricao', label: 'Descrição' },
                                            { key: 'taxa',      label: 'Taxa (%)', type: 'number' },
                                        ]}
                                        rows={taxasIva}
                                        onAdd={r => addTaxaIva({ codigo: r.codigo, descricao: r.descricao, taxa: Number(r.taxa) })}
                                        onUpdate={(id, field, val) => updateTaxaIva(id, { [field]: field === 'taxa' ? Number(val) : val })}
                                        onRemove={id => removeTaxaIva(id)}
                                    />
                                    <div className="settings-section-hdr" style={{ marginTop: 16 }}>
                                        <div className="settings-section-title" style={{ fontSize: '0.82rem' }}>Taxa IVA Global (para faturas sem artigo associado)</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                                        <input
                                            type="number" min={0} max={100} className="form-input"
                                            style={{ maxWidth: 120 }}
                                            value={taxaIvaGlobal}
                                            onChange={e => { setTaxaIvaGlobal(Number(e.target.value)); markDirty(); }}
                                        />
                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>%</span>
                                    </div>
                                    <div className="preview-box" style={{ marginTop: 8 }}>
                                        Subtotal 100.000 {moeda.symbol} → IVA {taxaIvaGlobal}% = <strong>{(100000 * taxaIvaGlobal / 100).toLocaleString('pt-PT')} {moeda.symbol}</strong>
                                    </div>
                                </div>
                            </div>
                        </>}

                        {/* ── COMISSÕES ── */}
                        {tab === 'comissoes' && <>
                            <div className="settings-section">
                                <div className="settings-section-hdr">
                                    <div className="settings-section-title">Valor por Tipo de OS — Técnicos Campo</div>
                                    <div className="settings-section-desc">Comissão fixa ({selectedCurrency?.simbolo}) por ordem de serviço concluída</div>
                                </div>
                                <div className="settings-section-body">
                                    <div className="form-row">
                                        {([
                                            { key: 'montagem', label: 'Montagem/Instalação' },
                                            { key: 'preventiva', label: 'Manutenção Preventiva' },
                                            { key: 'corretiva', label: 'Manutenção Corretiva' },
                                            { key: 'remota', label: 'Suporte Remoto' },
                                        ] as const).map(({ key, label }) => (
                                            <div className="form-group" key={key}>
                                                <label className="form-label req">{label}</label>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', minWidth: 20 }}>{selectedCurrency?.simbolo}</span>
                                                    <input type="number" min={0} className="form-input" value={(comissoes as any)[key]} onChange={setC(key)} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="settings-section">
                                <div className="settings-section-hdr">
                                    <div className="settings-section-title">Comissão de Vendedores</div>
                                    <div className="settings-section-desc">Percentagem do valor de venda (Montagem)</div>
                                </div>
                                <div className="settings-section-body">
                                    <div style={{ maxWidth: 200 }}>
                                        <div className="form-group">
                                            <label className="form-label req">Percentagem (%)</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <input type="number" min={0} max={100} className="form-input" value={comissoes.vendaPercent} onChange={setC('vendaPercent')} />
                                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="preview-box">
                                        Exemplo: venda de {selectedCurrency?.simbolo} 50.000 → comissão de{' '}
                                        <strong>{selectedCurrency?.simbolo} {(50000 * Number(comissoes.vendaPercent) / 100).toLocaleString('pt-PT')}</strong>
                                    </div>
                                </div>
                            </div>
                        </>}

                        {/* ── TABELAS DO SISTEMA ── */}
                        {tab === 'tabelas' && <>
                            <TabelaInlineEditor
                                titulo="Tipos de Trabalho"
                                colunas={[
                                    { key: 'codigo', label: 'Código' },
                                    { key: 'descricao', label: 'Descrição' },
                                ]}
                                rows={tiposTrabalho}
                                onAdd={r => addTipoTrabalho({ codigo: r.codigo, descricao: r.descricao })}
                                onUpdate={(id, field, val) => updateTipoTrabalho(id, { [field]: val })}
                                onRemove={id => removeTipoTrabalho(id)}
                            />
                            <TabelaInlineEditor
                                titulo="Tipos de OT"
                                colunas={[
                                    { key: 'codigo', label: 'Código' },
                                    { key: 'descricao', label: 'Descrição' },
                                ]}
                                rows={tiposOT}
                                onAdd={r => addTipoOT({ codigo: r.codigo, descricao: r.descricao })}
                                onUpdate={(id, field, val) => updateTipoOT(id, { [field]: val })}
                                onRemove={id => removeTipoOT(id)}
                            />
                            <TabelaInlineEditor
                                titulo="Funções de Técnico"
                                colunas={[
                                    { key: 'codigo',    label: 'Código' },
                                    { key: 'descricao', label: 'Descrição' },
                                    { key: 'custo',     label: 'Custo/h (AOA)', type: 'number' },
                                ]}
                                rows={funcoesTecnico}
                                onAdd={r => addFuncaoTecnico({ codigo: r.codigo, descricao: r.descricao, custo: Number(r.custo) })}
                                onUpdate={(id, field, val) => updateFuncaoTecnico(id, { [field]: val })}
                                onRemove={id => removeFuncaoTecnico(id)}
                            />
                            <TabelaInlineEditor
                                titulo="Tipos de Documento"
                                colunas={[
                                    { key: 'codigo',    label: 'Código' },
                                    { key: 'descricao', label: 'Descrição' },
                                ]}
                                rows={tiposDocumento}
                                onAdd={r => addTipoDocumento({ codigo: r.codigo, descricao: r.descricao })}
                                onUpdate={(id, field, val) => updateTipoDocumento(id, { [field]: val })}
                                onRemove={id => removeTipoDocumento(id)}
                            />
                            <TabelaInlineEditor
                                titulo="Armazéns"
                                colunas={[
                                    { key: 'codigo',    label: 'Código' },
                                    { key: 'nome',      label: 'Nome' },
                                    { key: 'descricao', label: 'Descrição' },
                                ]}
                                rows={armazens}
                                onAdd={r => addArmazem({ codigo: r.codigo, nome: r.nome, descricao: r.descricao, ativo: true })}
                                onUpdate={(id, field, val) => updateArmazem(id, { [field]: val })}
                                onRemove={id => updateArmazem(id, { ativo: false })}
                            />
                        </>}

                        {/* ── SEGURANÇA ── */}
                        {tab === 'seguranca' && <>
                            <div className="settings-section">
                                <div className="settings-section-hdr">
                                    <div className="settings-section-title">Política de Passwords</div>
                                </div>
                                <div className="settings-section-body">
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label req">Comprimento Mínimo</label>
                                            <input type="number" min={4} max={32} className="form-input" value={seguranca.minPassword} onChange={setS('minPassword')} />
                                            <span className="form-hint">Mínimo recomendado: 8 caracteres</span>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label req">Expiração de Sessão (min)</label>
                                            <input type="number" min={5} max={480} className="form-input" value={seguranca.sessionExpiry} onChange={setS('sessionExpiry')} />
                                            <span className="form-hint">0 = nunca expira</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="settings-section">
                                <div className="settings-section-hdr">
                                    <div className="settings-section-title">Funcionalidades de Segurança</div>
                                </div>
                                <div className="settings-section-body" style={{ gap: 'var(--sp-3)' }}>
                                    <div className="toggle-row">
                                        <div className="toggle-info">
                                            <div className="toggle-title">Autenticação de Dois Fatores (2FA)</div>
                                            <div className="toggle-desc">Exige código adicional no login</div>
                                        </div>
                                        <label className="toggle">
                                            <input type="checkbox" checked={seguranca.twoFactor} onChange={e => { setSeguranca(p => ({ ...p, twoFactor: e.target.checked })); markDirty(); }} />
                                            <span className="toggle-slider" />
                                        </label>
                                    </div>
                                    <div className="toggle-row">
                                        <div className="toggle-info">
                                            <div className="toggle-title">Registo de Acessos</div>
                                            <div className="toggle-desc">Guarda histórico de logins e ações</div>
                                        </div>
                                        <label className="toggle">
                                            <input type="checkbox" checked={seguranca.accessLog} onChange={e => { setSeguranca(p => ({ ...p, accessLog: e.target.checked })); markDirty(); }} />
                                            <span className="toggle-slider" />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </>}

                    </div>
                </div>
            </div>

            {/* Floating save banner */}
            {dirty && (
                <div className="save-banner">
                    <p>Há alterações por guardar.</p>
                    <button className="abtn abtn-secondary" onClick={discard} type="button">Descartar</button>
                    <button className="abtn abtn-primary" onClick={save} type="button">Guardar</button>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="toast" role="status">
                    <Check size={14} strokeWidth={2.5} style={{ color: 'var(--green)' }} />
                    <span>Configurações guardadas com sucesso.</span>
                </div>
            )}
        </AppLayout>
    );
};

export default ConfiguracoesPage;
