import React, { useState, useEffect } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import {
    Search, Plus, Filter, AlertTriangle, Package, Eye, Pencil, Trash2,
    ArrowUpDown, ArrowUp, ArrowDown, Check, X, AlertCircle, Wrench, History,
} from 'lucide-react';

/* ══════════════════════════════════════════
   TYPES
══════════════════════════════════════════ */
type ItemTipo = 'maquina' | 'filtro' | 'peca' | 'filtro_maquina';
type EstadoMaquina = 'ativa' | 'com_problema' | 'desativada';
type TipoHistorico = 'MONTAGEM' | 'PREVENTIVA' | 'CORRETIVA' | 'REMOTA';

export interface Equipamento {
    id: string; nome: string; tipo: ItemTipo; marca: string; modelo: string;
    stock: number; stockMin: number; preco: number; ativo: boolean;
}

export interface HistoricoItem {
    id: string; data: string; tipo: TipoHistorico;
    descricao: string; tecnico: string; estado: 'concluida' | 'cancelada';
}

export interface MaquinaInstalada {
    id: string;
    clienteId: number; clienteNome: string;
    equipId: string; modelo: string; nrSerie: string;
    dataInstalacao: string; dataProximaManut: string; estado: EstadoMaquina;
    historico: HistoricoItem[];
}

interface ClienteRef { id: number; codigo: string; nome: string; }

/* ── Labels & styles ── */
const TIPO_LABEL: Record<ItemTipo, string> = {
    maquina: 'Máquina', filtro: 'Filtro', peca: 'Peça', filtro_maquina: 'Filtro NT',
};
const TIPO_BADGE: Record<ItemTipo, string> = {
    maquina: 'tbadge tbadge-admin', filtro: 'tbadge tbadge-suporte',
    peca: 'tbadge tbadge-vendedor', filtro_maquina: 'tbadge tbadge-campo',
};
const ESTADO_LABEL: Record<EstadoMaquina, string> = {
    ativa: 'Ativa', com_problema: 'Com problema', desativada: 'Desativada',
};
const ESTADO_DOT: Record<EstadoMaquina, string> = {
    ativa: 'dot-green', com_problema: 'dot-orange', desativada: 'dot-gray',
};
const HIST_TIPO: Record<TipoHistorico, { label: string; color: string; bg: string }> = {
    MONTAGEM:   { label: 'Montagem',   color: '#1565C0', bg: '#E3F2FD' },
    PREVENTIVA: { label: 'Preventiva', color: '#2E7D32', bg: '#E8F5E9' },
    CORRETIVA:  { label: 'Corretiva',  color: '#E65100', bg: '#FFF3E0' },
    REMOTA:     { label: 'Remota',     color: '#546E7A', bg: '#ECEFF1' },
};

/* ── Date helpers ── */
const TODAY = new Date('2026-03-07');
const daysUntil = (iso: string) =>
    Math.round((new Date(iso).getTime() - TODAY.getTime()) / 86400000);
const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-PT');

/* ── Clientes registados (espelha ClientesPage — em produção viria da API) ── */
const CLIENTES_REF: ClienteRef[] = [
    { id: 1,  codigo: 'CLI-0001', nome: 'Empresa Alpha, LDA' },
    { id: 2,  codigo: 'CLI-0002', nome: 'Hotel Marina Palace' },
    { id: 3,  codigo: 'CLI-0003', nome: 'Clínica São João' },
    { id: 4,  codigo: 'CLI-0004', nome: 'GlobalTrade SA' },
    { id: 5,  codigo: 'CLI-0005', nome: 'Escola da Nação' },
    { id: 6,  codigo: 'CLI-0006', nome: 'Farmácia Saúde +' },
    { id: 7,  codigo: 'CLI-0007', nome: 'Residencial Vista Mar' },
    { id: 8,  codigo: 'CLI-0008', nome: 'António Ferreira' },
    { id: 9,  codigo: 'CLI-0009', nome: 'MINSA — Direcção Luanda' },
    { id: 10, codigo: 'CLI-0010', nome: 'Petro Servicing Angola' },
];

/* ── Mock data ── */
let SEQ_EQUIP = 11;
let SEQ_MAQ   = 6;

const INIT_EQUIP: Equipamento[] = [
    { id: 'EQ-0001', nome: 'Purificador Neutratech Pro 300',   tipo: 'maquina',       marca: 'Neutratech', modelo: 'NTP-300',    stock: 4,  stockMin: 2, preco: 450000, ativo: true },
    { id: 'EQ-0002', nome: 'Purificador Neutratech Elite 500', tipo: 'maquina',       marca: 'Neutratech', modelo: 'NTE-500',    stock: 1,  stockMin: 2, preco: 650000, ativo: true },
    { id: 'EQ-0003', nome: 'Filtro AR G010 Standard',         tipo: 'filtro',        marca: 'AquaFilter', modelo: 'G010-STD',  stock: 2,  stockMin: 5, preco: 8500,   ativo: true },
    { id: 'EQ-0004', nome: 'Filtro para Líquidos FL200',      tipo: 'filtro',        marca: 'AquaFilter', modelo: 'FL-200',    stock: 8,  stockMin: 3, preco: 12000,  ativo: true },
    { id: 'EQ-0005', nome: 'Membrana RO Neutratech',          tipo: 'filtro_maquina',marca: 'Neutratech', modelo: 'MEM-RO-NT', stock: 3,  stockMin: 2, preco: 28000,  ativo: true },
    { id: 'EQ-0006', nome: 'O-Ring Conjunto 12pcs',           tipo: 'peca',          marca: 'Genérico',   modelo: 'ORG-012',   stock: 18, stockMin: 5, preco: 2000,   ativo: true },
    { id: 'EQ-0007', nome: 'Bomba de Pressão NT-P1',          tipo: 'peca',          marca: 'Neutratech', modelo: 'NT-P1',     stock: 2,  stockMin: 2, preco: 45000,  ativo: true },
    { id: 'EQ-0008', nome: 'Controlador Digital CDX',         tipo: 'peca',          marca: 'Neutratech', modelo: 'CDX-v2',    stock: 0,  stockMin: 1, preco: 32000,  ativo: true },
    { id: 'EQ-0009', nome: 'Filtro Carvão Ativado FCA-50',    tipo: 'filtro_maquina',marca: 'AquaFilter', modelo: 'FCA-50',    stock: 12, stockMin: 5, preco: 6500,   ativo: true },
    { id: 'EQ-0010', nome: 'Kit Manutenção Preventiva',       tipo: 'peca',          marca: 'Neutratech', modelo: 'KMP-001',   stock: 5,  stockMin: 3, preco: 35000,  ativo: true },
];

const INIT_MAQUINAS: MaquinaInstalada[] = [
    {
        id: 'MI-0001', clienteId: 2, clienteNome: 'Hotel Marina Palace',
        equipId: 'EQ-0001', modelo: 'NTP-300', nrSerie: 'NTP-300-2023-001',
        dataInstalacao: '2023-03-15', dataProximaManut: '2026-03-09', estado: 'ativa',
        historico: [
            { id: 'H-MI001-1', data: '2023-03-15', tipo: 'MONTAGEM',   descricao: 'Montagem e configuração inicial do equipamento',              tecnico: 'Carlos Mendes', estado: 'concluida' },
            { id: 'H-MI001-2', data: '2023-09-15', tipo: 'PREVENTIVA', descricao: 'Manutenção preventiva — substituição de filtros',            tecnico: 'Carlos Mendes', estado: 'concluida' },
            { id: 'H-MI001-3', data: '2024-03-15', tipo: 'PREVENTIVA', descricao: 'Manutenção preventiva — limpeza e substituição de membrana', tecnico: 'André Silva',   estado: 'concluida' },
            { id: 'H-MI001-4', data: '2024-09-15', tipo: 'PREVENTIVA', descricao: 'Manutenção preventiva — revisão completa do sistema',        tecnico: 'André Silva',   estado: 'concluida' },
        ],
    },
    {
        id: 'MI-0002', clienteId: 2, clienteNome: 'Hotel Marina Palace',
        equipId: 'EQ-0002', modelo: 'NTE-500', nrSerie: 'NTE-500-2023-004',
        dataInstalacao: '2023-03-15', dataProximaManut: '2025-09-15', estado: 'com_problema',
        historico: [
            { id: 'H-MI002-1', data: '2023-03-15', tipo: 'MONTAGEM',   descricao: 'Montagem e configuração inicial do equipamento',            tecnico: 'Carlos Mendes', estado: 'concluida' },
            { id: 'H-MI002-2', data: '2023-09-15', tipo: 'PREVENTIVA', descricao: 'Manutenção preventiva semestral',                           tecnico: 'André Silva',   estado: 'concluida' },
            { id: 'H-MI002-3', data: '2024-02-10', tipo: 'REMOTA',     descricao: 'Suporte remoto — problema de pressão reportado pelo cliente', tecnico: 'João Costa',    estado: 'concluida' },
            { id: 'H-MI002-4', data: '2024-02-15', tipo: 'CORRETIVA',  descricao: 'Corretiva — substituição da bomba de pressão NT-P1',        tecnico: 'Carlos Mendes', estado: 'concluida' },
            { id: 'H-MI002-5', data: '2024-08-20', tipo: 'PREVENTIVA', descricao: 'Manutenção preventiva semestral',                           tecnico: 'André Silva',   estado: 'concluida' },
        ],
    },
    {
        id: 'MI-0003', clienteId: 3, clienteNome: 'Clínica São João',
        equipId: 'EQ-0001', modelo: 'NTP-300', nrSerie: 'NTP-300-2024-012',
        dataInstalacao: '2024-09-10', dataProximaManut: '2025-03-10', estado: 'ativa',
        historico: [
            { id: 'H-MI003-1', data: '2024-09-10', tipo: 'MONTAGEM', descricao: 'Montagem e configuração inicial do equipamento', tecnico: 'André Silva', estado: 'concluida' },
        ],
    },
    {
        id: 'MI-0004', clienteId: 4, clienteNome: 'GlobalTrade SA',
        equipId: 'EQ-0002', modelo: 'NTE-500', nrSerie: 'NTE-500-2024-008',
        dataInstalacao: '2024-04-22', dataProximaManut: '2025-10-22', estado: 'ativa',
        historico: [
            { id: 'H-MI004-1', data: '2024-04-22', tipo: 'MONTAGEM',   descricao: 'Montagem e configuração inicial do equipamento', tecnico: 'Carlos Mendes', estado: 'concluida' },
            { id: 'H-MI004-2', data: '2024-10-22', tipo: 'PREVENTIVA', descricao: 'Manutenção preventiva semestral',               tecnico: 'André Silva',   estado: 'concluida' },
        ],
    },
    {
        id: 'MI-0005', clienteId: 9, clienteNome: 'MINSA — Direcção Luanda',
        equipId: 'EQ-0001', modelo: 'NTP-300', nrSerie: 'NTP-300-2022-055',
        dataInstalacao: '2022-10-01', dataProximaManut: '2026-04-01', estado: 'ativa',
        historico: [
            { id: 'H-MI005-1', data: '2022-10-01', tipo: 'MONTAGEM',   descricao: 'Montagem e configuração inicial do equipamento',                    tecnico: 'Carlos Mendes', estado: 'concluida' },
            { id: 'H-MI005-2', data: '2023-04-01', tipo: 'PREVENTIVA', descricao: 'Manutenção preventiva semestral',                                   tecnico: 'Carlos Mendes', estado: 'concluida' },
            { id: 'H-MI005-3', data: '2023-10-01', tipo: 'PREVENTIVA', descricao: 'Manutenção preventiva — substituição de filtros e membrana',        tecnico: 'André Silva',   estado: 'concluida' },
            { id: 'H-MI005-4', data: '2024-04-01', tipo: 'PREVENTIVA', descricao: 'Manutenção preventiva — revisão completa',                         tecnico: 'André Silva',   estado: 'concluida' },
            { id: 'H-MI005-5', data: '2024-06-15', tipo: 'REMOTA',     descricao: 'Suporte remoto — calibração de sensor de pressão',                 tecnico: 'João Costa',    estado: 'concluida' },
            { id: 'H-MI005-6', data: '2024-10-01', tipo: 'PREVENTIVA', descricao: 'Manutenção preventiva semestral — substituição kit filtros',       tecnico: 'André Silva',   estado: 'concluida' },
        ],
    },
];

/* ══════════════════════════════════════════
   SHARED — module-level to prevent focus loss
══════════════════════════════════════════ */
const InfoRow: React.FC<{ label: string; value: string; color?: string; mono?: boolean }> = ({ label, value, color, mono }) => (
    <div className="form-group">
        <label className="form-label">{label}</label>
        <div style={{ padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 3, fontSize: '0.82rem', fontWeight: color ? 700 : 400, color: color ?? 'var(--text-primary)', fontFamily: mono ? 'monospace' : undefined }}>
            {value}
        </div>
    </div>
);

interface FieldProps {
    label: string; placeholder?: string; type?: string; required?: boolean;
    value: string; error?: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
const Field: React.FC<FieldProps> = ({ label, placeholder, type = 'text', required, value, error, onChange }) => (
    <div className="form-group">
        <label className={`form-label${required ? ' req' : ''}`}>{label}</label>
        <input type={type} className={`form-input${error ? ' err' : ''}`}
            value={value} onChange={onChange} placeholder={placeholder} />
        {error && <span className="form-error"><AlertCircle size={11} /> {error}</span>}
    </div>
);

/* ══════════════════════════════════════════
   MODAL — Novo / Editar Equipamento
══════════════════════════════════════════ */
type EquipForm = { nome: string; tipo: ItemTipo; marca: string; modelo: string; stockMin: string; preco: string; stockInicial: string; };
type EquipErrors = Partial<Record<keyof EquipForm, string>>;
const BLANK_EQUIP: EquipForm = { nome: '', tipo: 'maquina', marca: '', modelo: '', stockMin: '0', preco: '0', stockInicial: '0' };

interface EquipModalProps { initial: Equipamento | null; onClose: () => void; onSave: (f: EquipForm) => void; }

const EquipamentoModal: React.FC<EquipModalProps> = ({ initial, onClose, onSave }) => {
    const isEdit = Boolean(initial);
    const [form, setForm] = useState<EquipForm>(BLANK_EQUIP);
    const [errors, setErrors] = useState<EquipErrors>({});

    useEffect(() => {
        setForm(initial
            ? { nome: initial.nome, tipo: initial.tipo, marca: initial.marca, modelo: initial.modelo, stockMin: String(initial.stockMin), preco: String(initial.preco), stockInicial: '0' }
            : { ...BLANK_EQUIP });
        setErrors({});
    }, [initial]);

    const setF = (k: keyof EquipForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(p => ({ ...p, [k]: e.target.value }));

    const validate = (): boolean => {
        const e: EquipErrors = {};
        if (!form.nome.trim()) e.nome = 'Obrigatório';
        if (!form.marca.trim()) e.marca = 'Obrigatório';
        if (!form.modelo.trim()) e.modelo = 'Obrigatório';
        if (isNaN(Number(form.stockMin)) || Number(form.stockMin) < 0) e.stockMin = 'Valor inválido';
        if (isNaN(Number(form.preco)) || Number(form.preco) < 0) e.preco = 'Valor inválido';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); if (validate()) onSave(form); };

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 520 }}>
                <div className="modal-header">
                    <h3 className="modal-title">{isEdit ? `Editar — ${initial?.nome}` : 'Novo Item de Catálogo'}</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <form onSubmit={handleSubmit} noValidate>
                    <div className="modal-body">
                        <div className="form-group">
                            <label className="form-label req">Tipo</label>
                            <select className="form-select" value={form.tipo}
                                onChange={e => setForm(p => ({ ...p, tipo: e.target.value as ItemTipo }))}>
                                <option value="maquina">Máquina</option>
                                <option value="filtro">Filtro</option>
                                <option value="filtro_maquina">Filtro p/ Máquina (NT)</option>
                                <option value="peca">Peça de Substituição</option>
                            </select>
                        </div>
                        <Field label="Nome do Produto" required placeholder="Ex: Purificador Neutratech Pro 300"
                            value={form.nome} error={errors.nome} onChange={setF('nome')} />
                        <div className="form-row">
                            <Field label="Marca" required placeholder="Ex: Neutratech"
                                value={form.marca} error={errors.marca} onChange={setF('marca')} />
                            <Field label="Modelo / Referência" required placeholder="Ex: NTP-300"
                                value={form.modelo} error={errors.modelo} onChange={setF('modelo')} />
                        </div>
                        <div className="form-row">
                            <Field label="Preço de Venda (Kz)" required type="number"
                                value={form.preco} error={errors.preco} onChange={setF('preco')} />
                            <Field label="Stock Mínimo" required type="number"
                                value={form.stockMin} error={errors.stockMin} onChange={setF('stockMin')} />
                        </div>
                        {!isEdit && (
                            <Field label="Stock Inicial" type="number" placeholder="0"
                                value={form.stockInicial} onChange={setF('stockInicial')} />
                        )}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="abtn abtn-primary">{isEdit ? 'Guardar Alterações' : 'Criar Item'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════
   MODAL — Detalhe do Equipamento
══════════════════════════════════════════ */
interface EquipDetalheProps { equip: Equipamento; onClose: () => void; onEdit: () => void; onAjuste: () => void; onDelete: () => void; }

const EquipDetalhe: React.FC<EquipDetalheProps> = ({ equip, onClose, onEdit, onAjuste, onDelete }) => {
    const [confirmDel, setConfirmDel] = useState(false);
    const stockColor = equip.stock === 0 ? 'var(--red)' : equip.stock <= equip.stockMin ? 'var(--orange)' : 'var(--green)';
    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 500 }}>
                <div className="modal-header">
                    <div>
                        <h3 className="modal-title">{equip.id} — {equip.nome}</h3>
                        <div style={{ marginTop: 4 }}><span className={TIPO_BADGE[equip.tipo]}>{TIPO_LABEL[equip.tipo]}</span></div>
                    </div>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="panel" style={{ padding: '12px 16px', textAlign: 'center', marginBottom: 0 }}>
                            <div className="stat-label">Stock Actual</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: stockColor, lineHeight: 1.2, marginTop: 4 }}>{equip.stock}</div>
                        </div>
                        <div className="panel" style={{ padding: '12px 16px', textAlign: 'center', marginBottom: 0 }}>
                            <div className="stat-label">Stock Mínimo</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-muted)', lineHeight: 1.2, marginTop: 4 }}>{equip.stockMin}</div>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <InfoRow label="Marca" value={equip.marca} />
                        <InfoRow label="Modelo" value={equip.modelo} mono />
                    </div>
                    <InfoRow label="Preço de Venda" value={`${equip.preco.toLocaleString('pt-PT')} Kz`} />
                    {confirmDel && (
                        <div style={{ padding: '10px 14px', background: 'var(--red-bg)', border: '1px solid #FFCDD2', borderRadius: 4, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.82rem', color: 'var(--red)', fontWeight: 600 }}>Confirmar eliminação permanente?</span>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="abtn abtn-secondary" type="button" onClick={() => setConfirmDel(false)}>Cancelar</button>
                                <button className="abtn abtn-danger" type="button" onClick={onDelete}>Eliminar</button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                    <button className="abtn abtn-danger" type="button" onClick={() => setConfirmDel(true)}><Trash2 size={12} /> Eliminar</button>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="abtn abtn-secondary" type="button" onClick={onClose}>Fechar</button>
                        <button className="abtn abtn-secondary" type="button" onClick={onAjuste}><ArrowUpDown size={12} /> Ajustar Stock</button>
                        <button className="abtn abtn-primary" type="button" onClick={onEdit}><Pencil size={12} /> Editar</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════
   MODAL — Ajuste de Stock
══════════════════════════════════════════ */
interface AjusteProps { equip: Equipamento; onClose: () => void; onSave: (dir: 'entrada' | 'saida', qty: number, nota: string) => void; }

const AjusteStockModal: React.FC<AjusteProps> = ({ equip, onClose, onSave }) => {
    const [dir, setDir] = useState<'entrada' | 'saida'>('entrada');
    const [qty, setQty] = useState('1');
    const [nota, setNota] = useState('');
    const [error, setError] = useState('');
    const stockColor = equip.stock === 0 ? 'var(--red)' : equip.stock <= equip.stockMin ? 'var(--orange)' : 'var(--green)';

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const n = parseInt(qty);
        if (isNaN(n) || n <= 0) { setError('Quantidade deve ser superior a 0'); return; }
        if (dir === 'saida' && n > equip.stock) { setError(`Stock insuficiente (disponível: ${equip.stock})`); return; }
        onSave(dir, n, nota);
    };

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 420 }}>
                <div className="modal-header">
                    <h3 className="modal-title">Ajuste de Stock</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <form onSubmit={handleSubmit} noValidate>
                    <div className="modal-body">
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: -8 }}>{equip.nome}</div>
                        <div className="form-group">
                            <label className="form-label req">Tipo de Movimento</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {(['entrada', 'saida'] as const).map(d => (
                                    <button key={d} type="button"
                                        className={`abtn${dir === d ? ' abtn-primary' : ' abtn-secondary'}`}
                                        style={{ flex: 1, justifyContent: 'center', gap: 6 }}
                                        onClick={() => setDir(d)}>
                                        {d === 'entrada' ? <ArrowDown size={13} /> : <ArrowUp size={13} />}
                                        {d === 'entrada' ? 'Entrada' : 'Saída'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ padding: '8px 12px', background: '#f8f9fa', border: '1px solid var(--border)', borderRadius: 3, fontSize: '0.82rem', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Stock actual:</span>
                            <strong style={{ color: stockColor }}>{equip.stock} unid.</strong>
                        </div>
                        <div className="form-group">
                            <label className="form-label req">Quantidade</label>
                            <input type="number" className={`form-input${error ? ' err' : ''}`}
                                value={qty} min={1} onChange={e => { setQty(e.target.value); setError(''); }} />
                            {error && <span className="form-error"><AlertCircle size={11} /> {error}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Notas / Motivo</label>
                            <textarea className="form-textarea" value={nota}
                                onChange={e => setNota(e.target.value)}
                                placeholder="Ex: Reposição de stock, saída por OS #1234..." />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="abtn abtn-primary">
                            {dir === 'entrada' ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                            Registar {dir === 'entrada' ? 'Entrada' : 'Saída'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════
   MODAL — Registar / Editar Máquina Instalada
══════════════════════════════════════════ */
type MaqForm = { clienteId: string; equipId: string; dataInstalacao: string; nrSerie: string; };
type MaqErrors = Partial<Record<'clienteId' | 'equipId' | 'dataInstalacao', string>>;
const BLANK_MAQ: MaqForm = { clienteId: '', equipId: '', dataInstalacao: '', nrSerie: '' };

interface MaqModalProps {
    initial: MaquinaInstalada | null;
    equips: Equipamento[];
    maquinas: MaquinaInstalada[];
    clientes: ClienteRef[];
    onClose: () => void;
    onSave: (f: MaqForm) => void;
}

const MaquinaModal: React.FC<MaqModalProps> = ({ initial, equips, maquinas, clientes, onClose, onSave }) => {
    const isEdit = Boolean(initial);
    const [form, setForm] = useState<MaqForm>(BLANK_MAQ);
    const [errors, setErrors] = useState<MaqErrors>({});

    /* Apenas máquinas com stock disponível */
    const maquinasCat = equips.filter(e => e.tipo === 'maquina' && (isEdit || e.stock > 0));

    useEffect(() => {
        setForm(initial
            ? { clienteId: String(initial.clienteId), equipId: initial.equipId, dataInstalacao: initial.dataInstalacao, nrSerie: initial.nrSerie }
            : { ...BLANK_MAQ });
        setErrors({});
    }, [initial]);

    /* Auto-gerar nrSerie quando modelo é seleccionado (apenas em criação) */
    useEffect(() => {
        if (isEdit || !form.equipId) return;
        const equip = equips.find(e => e.id === form.equipId);
        if (!equip) return;
        const year = TODAY.getFullYear();
        const count = maquinas.filter(m => m.modelo === equip.modelo).length + 1;
        const nr = `${equip.modelo}-${year}-${String(count).padStart(3, '0')}`;
        setForm(p => ({ ...p, nrSerie: nr }));
    }, [form.equipId, isEdit, equips, maquinas]);

    const validate = (): boolean => {
        const e: MaqErrors = {};
        if (!form.clienteId) e.clienteId = 'Obrigatório';
        if (!form.equipId) e.equipId = 'Obrigatório';
        if (!form.dataInstalacao) e.dataInstalacao = 'Obrigatório';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); if (validate()) onSave(form); };

    const equipSeleccionado = equips.find(e => e.id === form.equipId);

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 500 }}>
                <div className="modal-header">
                    <h3 className="modal-title">{isEdit ? `Editar — ${initial?.nrSerie}` : 'Registar Máquina Instalada'}</h3>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <form onSubmit={handleSubmit} noValidate>
                    <div className="modal-body">

                        {/* Cliente */}
                        <div className="form-group">
                            <label className="form-label req">Cliente</label>
                            <select className="form-select"
                                style={errors.clienteId ? { borderColor: 'var(--red)' } : undefined}
                                value={form.clienteId}
                                onChange={e => setForm(p => ({ ...p, clienteId: e.target.value }))}>
                                <option value="">Seleccionar cliente...</option>
                                {clientes.map(c => (
                                    <option key={c.id} value={c.id}>{c.codigo} — {c.nome}</option>
                                ))}
                            </select>
                            {errors.clienteId && <span className="form-error"><AlertCircle size={11} /> {errors.clienteId}</span>}
                        </div>

                        {/* Modelo */}
                        <div className="form-group">
                            <label className="form-label req">Modelo de Máquina</label>
                            <select className="form-select"
                                style={errors.equipId ? { borderColor: 'var(--red)' } : undefined}
                                value={form.equipId}
                                onChange={e => setForm(p => ({ ...p, equipId: e.target.value }))}>
                                <option value="">Seleccionar modelo...</option>
                                {maquinasCat.map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.nome} ({m.modelo}) — {m.stock} em stock
                                    </option>
                                ))}
                            </select>
                            {errors.equipId && <span className="form-error"><AlertCircle size={11} /> {errors.equipId}</span>}
                            {maquinasCat.length === 0 && !isEdit && (
                                <span className="form-hint" style={{ color: 'var(--red)' }}>Sem máquinas disponíveis em stock.</span>
                            )}
                        </div>

                        {/* Nº Série (auto-gerado) */}
                        <div className="form-group">
                            <label className="form-label">Nº de Série</label>
                            <div style={{
                                padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 3,
                                fontSize: '0.82rem', fontFamily: 'monospace', background: '#f8f9fa',
                                color: form.nrSerie ? 'var(--text-primary)' : 'var(--text-muted)',
                            }}>
                                {form.nrSerie || (form.equipId ? 'A gerar...' : 'Seleccione um modelo primeiro')}
                            </div>
                            <span className="form-hint">Gerado automaticamente pelo sistema.</span>
                        </div>

                        {/* Data de instalação */}
                        <div className="form-group">
                            <label className="form-label req">Data de Instalação</label>
                            <input type="date"
                                className={`form-input${errors.dataInstalacao ? ' err' : ''}`}
                                value={form.dataInstalacao}
                                onChange={e => setForm(p => ({ ...p, dataInstalacao: e.target.value }))} />
                            {errors.dataInstalacao && <span className="form-error"><AlertCircle size={11} /> {errors.dataInstalacao}</span>}
                        </div>

                        {/* Info: próxima manutenção */}
                        {form.dataInstalacao && (
                            <div style={{ padding: '8px 12px', background: '#f8f9fa', border: '1px solid var(--border)', borderRadius: 3, fontSize: '0.79rem', color: 'var(--text-muted)' }}>
                                Próxima manutenção preventiva: <strong style={{ color: 'var(--text-primary)' }}>
                                    {(() => {
                                        const d = new Date(form.dataInstalacao);
                                        d.setMonth(d.getMonth() + 6);
                                        return fmtDate(d.toISOString().slice(0, 10));
                                    })()}
                                </strong> (+6 meses)
                                {equipSeleccionado && !isEdit && (
                                    <span style={{ marginLeft: 8, color: 'var(--orange)' }}>
                                        · Stock restante após registo: {equipSeleccionado.stock - 1}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="abtn abtn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="abtn abtn-primary">
                            {isEdit ? 'Guardar Alterações' : 'Registar Máquina'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════
   MODAL — Detalhe + Histórico de Manutenções
══════════════════════════════════════════ */
interface MaqDetalheProps {
    maq: MaquinaInstalada; equips: Equipamento[];
    onClose: () => void; onEdit: () => void;
    onEstado: (e: EstadoMaquina) => void;
}

const MaquinaDetalhe: React.FC<MaqDetalheProps> = ({ maq, equips, onClose, onEdit, onEstado }) => {
    const dias = daysUntil(maq.dataProximaManut);
    const equip = equips.find(e => e.id === maq.equipId);
    const manutColor = dias < 0 ? 'var(--red)' : dias <= 30 ? 'var(--orange)' : 'var(--green)';
    const manutSufixo = dias < 0 ? `${Math.abs(dias)}d em atraso` : dias === 0 ? 'Hoje' : `em ${dias} dias`;

    /* Histórico em ordem cronológica inversa */
    const historico = [...maq.historico].reverse();

    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 560 }}>
                <div className="modal-header">
                    <div>
                        <h3 className="modal-title">{maq.id} — {maq.modelo}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                            <span className={`dot ${ESTADO_DOT[maq.estado]}`} />
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{ESTADO_LABEL[maq.estado]}</span>
                        </div>
                    </div>
                    <button className="modal-close" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body">
                    <InfoRow label="Cliente" value={maq.clienteNome} />
                    {equip && <InfoRow label="Equipamento" value={equip.nome} />}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <InfoRow label="Modelo" value={maq.modelo} />
                        <InfoRow label="Nº de Série" value={maq.nrSerie} mono />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <InfoRow label="Data de Instalação" value={fmtDate(maq.dataInstalacao)} />
                        <div className="form-group">
                            <label className="form-label">Próxima Manutenção</label>
                            <div style={{ padding: '5px 10px', border: `1px solid ${manutColor}`, borderRadius: 3, fontSize: '0.82rem', fontWeight: 700, color: manutColor }}>
                                {fmtDate(maq.dataProximaManut)} <span style={{ fontSize: '0.72rem', fontWeight: 400 }}>({manutSufixo})</span>
                            </div>
                        </div>
                    </div>

                    {/* Alterar estado */}
                    <div className="form-group">
                        <label className="form-label">Alterar Estado</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {(['ativa', 'com_problema', 'desativada'] as EstadoMaquina[]).map(est => (
                                <button key={est} type="button"
                                    className={`abtn${maq.estado === est ? ' abtn-primary' : ' abtn-secondary'}`}
                                    style={{ flex: 1, justifyContent: 'center', gap: 5, fontSize: '0.75rem' }}
                                    onClick={() => onEstado(est)}>
                                    <span className={`dot ${ESTADO_DOT[est]}`} />
                                    {ESTADO_LABEL[est]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Histórico de manutenções */}
                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <History size={12} /> Histórico de Intervenções ({maq.historico.length})
                        </label>
                        {historico.length === 0 ? (
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '10px 0' }}>Sem registos de intervenção.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 230, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 4, padding: 8 }}>
                                {historico.map(h => {
                                    const ht = HIST_TIPO[h.tipo];
                                    return (
                                        <div key={h.id} style={{
                                            display: 'flex', gap: 10, padding: '6px 8px',
                                            borderRadius: 3, alignItems: 'flex-start',
                                            background: h.estado === 'cancelada' ? '#fafafa' : '#fff',
                                            border: '1px solid var(--border-light)',
                                        }}>
                                            <div style={{ minWidth: 76, fontSize: '0.73rem', color: 'var(--text-muted)', paddingTop: 2, flexShrink: 0 }}>
                                                {fmtDate(h.data)}
                                            </div>
                                            <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: 10, fontWeight: 700, background: ht.bg, color: ht.color, flexShrink: 0 }}>
                                                {ht.label}
                                            </span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '0.8rem', lineHeight: 1.3 }}>{h.descricao}</div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{h.tecnico}</div>
                                            </div>
                                            {h.estado === 'cancelada' && (
                                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', flexShrink: 0 }}>Cancelada</span>
                                            )}
                                            {h.estado === 'concluida' && (
                                                <Check size={12} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 2 }} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="abtn abtn-secondary" type="button" onClick={onClose}>Fechar</button>
                    <button className="abtn abtn-primary" type="button" onClick={onEdit}><Pencil size={12} /> Editar</button>
                </div>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════ */
const StockPage: React.FC = () => {
    const [tab, setTab] = useState<'catalogo' | 'parque'>('catalogo');
    const [equips, setEquips] = useState<Equipamento[]>(INIT_EQUIP);
    const [maquinas, setMaquinas] = useState<MaquinaInstalada[]>(INIT_MAQUINAS);
    const [search, setSearch] = useState('');
    const [filterTipo, setFilterTipo] = useState('');
    const [toast, setToast] = useState('');

    const [equipModal, setEquipModal] = useState(false);
    const [equipTarget, setEquipTarget] = useState<Equipamento | null>(null);
    const [equipDetail, setEquipDetail] = useState<Equipamento | null>(null);
    const [ajusteTarget, setAjusteTarget] = useState<Equipamento | null>(null);
    const [maqModal, setMaqModal] = useState(false);
    const [maqTarget, setMaqTarget] = useState<MaquinaInstalada | null>(null);
    const [maqDetail, setMaqDetail] = useState<MaquinaInstalada | null>(null);

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    /* Equip CRUD */
    const openNewEquip = () => { setEquipTarget(null); setEquipModal(true); };
    const openEditEquip = (e: Equipamento) => { setEquipDetail(null); setEquipTarget(e); setEquipModal(true); };
    const openAjuste = (e: Equipamento) => { setEquipDetail(null); setAjusteTarget(e); };

    const handleSaveEquip = (f: EquipForm) => {
        if (equipTarget) {
            setEquips(prev => prev.map(e => e.id === equipTarget.id
                ? { ...e, nome: f.nome, tipo: f.tipo, marca: f.marca, modelo: f.modelo, stockMin: Number(f.stockMin), preco: Number(f.preco) }
                : e));
            showToast('Equipamento actualizado.');
        } else {
            const id = `EQ-${String(SEQ_EQUIP++).padStart(4, '0')}`;
            setEquips(prev => [{ id, nome: f.nome, tipo: f.tipo, marca: f.marca, modelo: f.modelo, stock: Math.max(0, Number(f.stockInicial) || 0), stockMin: Number(f.stockMin), preco: Number(f.preco), ativo: true }, ...prev]);
            showToast('Item adicionado ao catálogo.');
        }
        setEquipModal(false); setEquipTarget(null);
    };

    const handleDeleteEquip = (id: string) => {
        setEquips(prev => prev.filter(e => e.id !== id));
        setEquipDetail(null);
        showToast('Item eliminado do catálogo.');
    };

    const handleAjuste = (dir: 'entrada' | 'saida', qty: number) => {
        if (!ajusteTarget) return;
        setEquips(prev => prev.map(e => e.id === ajusteTarget.id
            ? { ...e, stock: dir === 'entrada' ? e.stock + qty : Math.max(0, e.stock - qty) }
            : e));
        showToast(`Stock ${dir === 'entrada' ? 'aumentado' : 'reduzido'} em ${qty} unidade(s).`);
        setAjusteTarget(null);
    };

    /* Maquina CRUD */
    const openNewMaq = () => { setMaqTarget(null); setMaqModal(true); };
    const openEditMaq = (m: MaquinaInstalada) => { setMaqDetail(null); setMaqTarget(m); setMaqModal(true); };

    const handleSaveMaq = (f: MaqForm) => {
        const equip = equips.find(e => e.id === f.equipId);
        const modelo = equip?.modelo ?? '';
        const cliente = CLIENTES_REF.find(c => c.id === Number(f.clienteId));
        const clienteNome = cliente?.nome ?? '';
        const d = new Date(f.dataInstalacao);
        d.setMonth(d.getMonth() + 6);
        const dataProximaManut = d.toISOString().slice(0, 10);

        if (maqTarget) {
            setMaquinas(prev => prev.map(m => m.id === maqTarget.id
                ? { ...m, clienteId: Number(f.clienteId), clienteNome, equipId: f.equipId, modelo, nrSerie: f.nrSerie, dataInstalacao: f.dataInstalacao, dataProximaManut }
                : m));
            showToast('Máquina actualizada.');
        } else {
            const id = `MI-${String(SEQ_MAQ++).padStart(4, '0')}`;
            /* Baixa de stock */
            setEquips(prev => prev.map(e => e.id === f.equipId ? { ...e, stock: Math.max(0, e.stock - 1) } : e));
            /* Cria registo com entrada de montagem no histórico */
            setMaquinas(prev => [{
                id, clienteId: Number(f.clienteId), clienteNome, equipId: f.equipId, modelo,
                nrSerie: f.nrSerie, dataInstalacao: f.dataInstalacao, dataProximaManut, estado: 'ativa',
                historico: [{
                    id: `H-${id}-1`, data: f.dataInstalacao, tipo: 'MONTAGEM' as const,
                    descricao: 'Instalação do equipamento', tecnico: '—', estado: 'concluida' as const,
                }],
            }, ...prev]);
            showToast('Máquina registada. Stock actualizado automaticamente.');
        }
        setMaqModal(false); setMaqTarget(null);
    };

    const handleEstado = (id: string, estado: EstadoMaquina) => {
        setMaquinas(prev => prev.map(m => m.id === id ? { ...m, estado } : m));
        setMaqDetail(prev => prev ? { ...prev, estado } : prev);
        showToast('Estado actualizado.');
    };

    /* Derived */
    const outStock    = equips.filter(i => i.stock === 0);
    const lowStock    = equips.filter(i => i.stock > 0 && i.stock <= i.stockMin);
    const overdueManut   = maquinas.filter(m => daysUntil(m.dataProximaManut) < 0);
    const upcomingManut  = maquinas.filter(m => { const d = daysUntil(m.dataProximaManut); return d >= 0 && d <= 30; });

    const filteredEquips = equips.filter(i => {
        const q = search.toLowerCase();
        return (!q || i.nome.toLowerCase().includes(q) || i.id.toLowerCase().includes(q) || i.modelo.toLowerCase().includes(q))
            && (!filterTipo || i.tipo === filterTipo);
    });

    const filteredMaquinas = maquinas.filter(m => {
        const q = search.toLowerCase();
        return !q || m.clienteNome.toLowerCase().includes(q) || m.nrSerie.toLowerCase().includes(q) || m.modelo.toLowerCase().includes(q);
    });

    const switchTab = (t: 'catalogo' | 'parque') => { setTab(t); setSearch(''); setFilterTipo(''); };

    return (
        <AppLayout>
            <ActionBar title="Stock & Catálogo" breadcrumb="AQUATEX SGI · Stock">
                <div className="actionbar-sep" />
                <button className={`abtn ${tab === 'catalogo' ? 'abtn-primary' : 'abtn-secondary'}`}
                    onClick={() => switchTab('catalogo')} type="button">
                    <Package size={13} /> Catálogo / Stock
                </button>
                <button className={`abtn ${tab === 'parque' ? 'abtn-primary' : 'abtn-secondary'}`}
                    onClick={() => switchTab('parque')} type="button">
                    <Wrench size={13} /> Parque de Máquinas
                </button>
                <div className="actionbar-spacer" />
                <button className="abtn abtn-primary" type="button"
                    onClick={tab === 'catalogo' ? openNewEquip : openNewMaq}>
                    <Plus size={13} /> {tab === 'catalogo' ? 'Novo Item' : 'Registar Máquina'}
                </button>
            </ActionBar>

            <div className="page-content">

                {tab === 'catalogo' && (outStock.length > 0 || lowStock.length > 0) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                        {outStock.length > 0 && (
                            <div style={{ padding: '8px 14px', background: 'var(--red-bg)', border: '1px solid #FFCDD2', borderRadius: 4, fontSize: '0.79rem', color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <AlertTriangle size={13} />
                                <strong>{outStock.length} item(ns) SEM STOCK:</strong>&nbsp;{outStock.map(i => i.nome).join(', ')}
                            </div>
                        )}
                        {lowStock.length > 0 && (
                            <div style={{ padding: '8px 14px', background: 'var(--orange-bg)', border: '1px solid #FFCC80', borderRadius: 4, fontSize: '0.79rem', color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <AlertTriangle size={13} />
                                {lowStock.length} item(ns) abaixo do stock mínimo
                            </div>
                        )}
                    </div>
                )}

                {tab === 'parque' && (overdueManut.length > 0 || upcomingManut.length > 0) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                        {overdueManut.length > 0 && (
                            <div style={{ padding: '8px 14px', background: 'var(--red-bg)', border: '1px solid #FFCDD2', borderRadius: 4, fontSize: '0.79rem', color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <AlertTriangle size={13} />
                                <strong>{overdueManut.length} manutenção(ões) em atraso:</strong>&nbsp;{overdueManut.map(m => `${m.id} (${m.clienteNome})`).join(', ')}
                            </div>
                        )}
                        {upcomingManut.length > 0 && (
                            <div style={{ padding: '8px 14px', background: 'var(--orange-bg)', border: '1px solid #FFCC80', borderRadius: 4, fontSize: '0.79rem', color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <AlertTriangle size={13} />
                                {upcomingManut.length} manutenção(ões) a vencer nos próximos 30 dias
                            </div>
                        )}
                    </div>
                )}

                {/* Stats */}
                <div className="stats-row">
                    {(tab === 'catalogo' ? [
                        { label: 'Total Referências',  value: equips.length,                                   cls: '' },
                        { label: 'Máquinas',           value: equips.filter(i => i.tipo === 'maquina').length, cls: 'blue' },
                        { label: 'Sem Stock',          value: outStock.length,                                 cls: outStock.length > 0 ? 'orange' : 'muted' },
                        { label: 'Stock Baixo',        value: lowStock.length,                                 cls: lowStock.length > 0 ? 'muted' : '' },
                    ] : [
                        { label: 'Máquinas Instaladas', value: maquinas.length,                                       cls: '' },
                        { label: 'Ativas',              value: maquinas.filter(m => m.estado === 'ativa').length,     cls: 'green' },
                        { label: 'Com Problema',        value: maquinas.filter(m => m.estado === 'com_problema').length, cls: 'orange' },
                        { label: 'Manutenção Urgente',  value: overdueManut.length + upcomingManut.length,             cls: overdueManut.length > 0 ? 'orange' : 'blue' },
                    ]).map(s => (
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
                        <input className="search-input"
                            placeholder={tab === 'catalogo' ? 'Pesquisar produto, código ou modelo...' : 'Pesquisar cliente, série ou modelo...'}
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    {tab === 'catalogo' && (
                        <select className="filter-select" value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
                            <option value="">Todos os Tipos</option>
                            <option value="maquina">Máquina</option>
                            <option value="filtro">Filtro</option>
                            <option value="filtro_maquina">Filtro NT</option>
                            <option value="peca">Peça</option>
                        </select>
                    )}
                    {(search || filterTipo) && (
                        <button className="abtn abtn-secondary" type="button" onClick={() => { setSearch(''); setFilterTipo(''); }}>
                            <Filter size={12} /> Limpar
                        </button>
                    )}
                </div>

                {/* ── CATÁLOGO TABLE ── */}
                {tab === 'catalogo' && (
                    <div className="table-container">
                        <div className="table-scroll">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 20 }} />
                                        <th>Código</th><th>Nome</th><th>Tipo</th>
                                        <th>Marca</th><th>Modelo</th>
                                        <th style={{ textAlign: 'center' }}>Stock</th>
                                        <th style={{ textAlign: 'center' }}>Mínimo</th>
                                        <th style={{ textAlign: 'right' }}>Preço (Kz)</th>
                                        <th style={{ width: 100 }} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredEquips.length === 0 && (
                                        <tr><td colSpan={10}><div className="empty-state">Nenhum item encontrado.</div></td></tr>
                                    )}
                                    {filteredEquips.map(i => (
                                        <tr key={i.id} style={{ background: i.stock === 0 ? 'var(--red-bg)' : i.stock <= i.stockMin ? 'var(--orange-bg)' : undefined }}>
                                            <td style={{ paddingLeft: 10 }}>
                                                <span className={`dot ${i.stock === 0 ? 'dot-red' : i.stock <= i.stockMin ? 'dot-orange' : 'dot-green'}`} />
                                            </td>
                                            <td><span className="td-link" onClick={() => setEquipDetail(i)}>{i.id}</span></td>
                                            <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{i.nome}</td>
                                            <td><span className={TIPO_BADGE[i.tipo]}>{TIPO_LABEL[i.tipo]}</span></td>
                                            <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{i.marca}</td>
                                            <td style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{i.modelo}</td>
                                            <td style={{ textAlign: 'center', fontWeight: 700, color: i.stock === 0 ? 'var(--red)' : i.stock <= i.stockMin ? 'var(--orange)' : 'var(--green)' }}>{i.stock}</td>
                                            <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{i.stockMin}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{i.preco.toLocaleString('pt-PT')}</td>
                                            <td>
                                                <div className="row-actions">
                                                    <button className="icon-btn" title="Ver detalhe" onClick={() => setEquipDetail(i)}><Eye size={12} /></button>
                                                    <button className="icon-btn" title="Editar" onClick={() => openEditEquip(i)}><Pencil size={12} /></button>
                                                    <button className="icon-btn" title="Ajustar Stock" onClick={() => openAjuste(i)}><ArrowUpDown size={12} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="table-count">{filteredEquips.length} referências</div>
                    </div>
                )}

                {/* ── PARQUE TABLE ── */}
                {tab === 'parque' && (
                    <div className="table-container">
                        <div className="table-scroll">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 20 }} />
                                        <th>ID</th><th>Cliente</th><th>Modelo</th>
                                        <th>Nº Série</th><th>Instalação</th>
                                        <th>Próx. Manutenção</th>
                                        <th style={{ textAlign: 'center' }}>Interv.</th>
                                        <th>Estado</th>
                                        <th style={{ width: 70 }} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMaquinas.length === 0 && (
                                        <tr><td colSpan={10}><div className="empty-state">Nenhuma máquina encontrada.</div></td></tr>
                                    )}
                                    {filteredMaquinas.map(m => {
                                        const dias = daysUntil(m.dataProximaManut);
                                        const manutColor = dias < 0 ? 'var(--red)' : dias <= 30 ? 'var(--orange)' : 'var(--text-primary)';
                                        return (
                                            <tr key={m.id}>
                                                <td style={{ paddingLeft: 10 }}><span className={`dot ${ESTADO_DOT[m.estado]}`} /></td>
                                                <td><span className="td-link" onClick={() => setMaqDetail(m)}>{m.id}</span></td>
                                                <td style={{ fontWeight: 600 }}>{m.clienteNome}</td>
                                                <td style={{ fontSize: '0.78rem' }}>{m.modelo}</td>
                                                <td style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{m.nrSerie}</td>
                                                <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{fmtDate(m.dataInstalacao)}</td>
                                                <td style={{ fontSize: '0.78rem', fontWeight: 600, color: manutColor }}>
                                                    {fmtDate(m.dataProximaManut)}
                                                    {dias < 0 && <span style={{ fontSize: '0.7rem', fontWeight: 400, marginLeft: 4 }}>({Math.abs(dias)}d atraso)</span>}
                                                    {dias >= 0 && dias <= 30 && <span style={{ fontSize: '0.7rem', fontWeight: 400, marginLeft: 4 }}>({dias}d)</span>}
                                                </td>
                                                <td style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{m.historico.length}</td>
                                                <td>
                                                    <div className="status-dot">
                                                        <span className={`dot ${ESTADO_DOT[m.estado]}`} />
                                                        <span style={{ fontSize: '0.78rem' }}>{ESTADO_LABEL[m.estado]}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="row-actions">
                                                        <button className="icon-btn" title="Ver detalhe / histórico" onClick={() => setMaqDetail(m)}><Eye size={12} /></button>
                                                        <button className="icon-btn" title="Editar" onClick={() => openEditMaq(m)}><Pencil size={12} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="table-count">{filteredMaquinas.length} máquinas instaladas</div>
                    </div>
                )}
            </div>

            {equipModal && (
                <EquipamentoModal initial={equipTarget}
                    onClose={() => { setEquipModal(false); setEquipTarget(null); }}
                    onSave={handleSaveEquip} />
            )}
            {equipDetail && (
                <EquipDetalhe equip={equipDetail}
                    onClose={() => setEquipDetail(null)}
                    onEdit={() => openEditEquip(equipDetail)}
                    onAjuste={() => openAjuste(equipDetail)}
                    onDelete={() => handleDeleteEquip(equipDetail.id)} />
            )}
            {ajusteTarget && (
                <AjusteStockModal equip={ajusteTarget}
                    onClose={() => setAjusteTarget(null)}
                    onSave={handleAjuste} />
            )}
            {maqModal && (
                <MaquinaModal initial={maqTarget} equips={equips} maquinas={maquinas} clientes={CLIENTES_REF}
                    onClose={() => { setMaqModal(false); setMaqTarget(null); }}
                    onSave={handleSaveMaq} />
            )}
            {maqDetail && (
                <MaquinaDetalhe maq={maqDetail} equips={equips}
                    onClose={() => setMaqDetail(null)}
                    onEdit={() => openEditMaq(maqDetail)}
                    onEstado={est => handleEstado(maqDetail.id, est)} />
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
