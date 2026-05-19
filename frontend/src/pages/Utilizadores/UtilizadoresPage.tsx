import React, { useState, useRef, useEffect, useCallback } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import UtilizadorModal from './UtilizadorModal';
import { useGlobal } from '../../contexts/GlobalContext';
import api from '../../services/api';
import {
    Search, Plus, Filter, Pencil, Trash2,
    ToggleLeft, ToggleRight, MoreVertical, Check,
} from 'lucide-react';


/* ── Role mappings ── */
const PERFIL_TO_ROLE: Record<string, string> = {
    'Administrador':           'admin',
    'Coordenador':             'coordenador',
    'Técnico Suporte':         'suporte',
    'Técnico Campo':           'campo',
    'Vendedor':                'vendedor',
};
const ROLE_TO_PERFIL: Record<string, Utilizador['perfil']> = {
    'admin':       'Administrador',
    'coordenador': 'Coordenador',
    'suporte':     'Técnico Suporte',
    'campo':       'Técnico Campo',
    'vendedor':    'Vendedor',
};

/* ── Types ── */
export interface Utilizador {
    id: number;
    nome: string;
    email: string;
    telefone: string;
    perfil: 'Administrador' | 'Coordenador' | 'Técnico Suporte' | 'Técnico Campo' | 'Vendedor';
    ativo: boolean;
    ultimoAcesso: string;
    iniciais: string;
    tecnicoId?: string;
    tecnicoNome?: string;
}

const normUser = (u: any): Utilizador => ({
    id: u.id,
    nome: u.nome ?? '',
    email: u.email ?? '',
    telefone: u.telefone ?? '',
    perfil: ROLE_TO_PERFIL[u.role] ?? 'Técnico Suporte',
    ativo: u.ativo ?? true,
    ultimoAcesso: '—',
    iniciais: (u.nome ?? '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
    tecnicoId: u.tecnicoId,
    tecnicoNome: u.tecnicoNome,
});

const PERF_BADGE: Record<string, string> = {
    'Administrador':    'tbadge tbadge-admin',
    'Coordenador':      'tbadge tbadge-suporte',
    'Técnico Suporte':  'tbadge tbadge-suporte',
    'Técnico Campo':    'tbadge tbadge-campo',
    'Vendedor':         'tbadge tbadge-vendedor',
};

/* ── Row dropdown ── */
interface RowMenuProps {
    user: Utilizador;
    onEdit: () => void;
    onToggle: () => void;
    onDelete: () => void;
}

const RowMenu: React.FC<RowMenuProps> = ({ user, onEdit, onToggle, onDelete }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        if (open) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <div style={{ position: 'relative' }} ref={ref}>
            <button className="icon-btn" onClick={() => setOpen(p => !p)} title="Ações" type="button">
                <MoreVertical size={13} />
            </button>
            {open && (
                <div className="dropdown-menu">
                    <button className="dropdown-item" onClick={() => { onEdit(); setOpen(false); }}>
                        <Pencil size={13} /> Editar
                    </button>
                    <button className="dropdown-item" onClick={() => { onToggle(); setOpen(false); }}>
                        {user.ativo ? <><ToggleLeft size={13} /> Desativar</> : <><ToggleRight size={13} /> Ativar</>}
                    </button>
                    <div className="dropdown-divider" />
                    <button className="dropdown-item danger" onClick={() => { onDelete(); setOpen(false); }}>
                        <Trash2 size={13} /> Eliminar
                    </button>
                </div>
            )}
        </div>
    );
};

/* ════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════ */
const UtilizadoresPage: React.FC = () => {
    const { tecnicos } = useGlobal();
    const [users, setUsers] = useState<Utilizador[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterPerfil, setFilterPerfil] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editUser, setEditUser] = useState<Utilizador | null>(null);
    const [toast, setToast] = useState('');

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 3000);
    };

    const loadUsers = useCallback(async () => {
        try {
            const { data } = await api.get(`/users`);
            setUsers(data.map(normUser));
        } catch (e) {
            console.error('Erro ao carregar utilizadores', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadUsers(); }, [loadUsers]);

    /* Filter */
    const filtered = users.filter(u => {
        const q = search.toLowerCase();
        const matchQ = !q || u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
        const matchP = !filterPerfil || u.perfil === filterPerfil;
        const matchS = !filterStatus
            || (filterStatus === 'ativo' && u.ativo)
            || (filterStatus === 'inativo' && !u.ativo);
        return matchQ && matchP && matchS;
    });

    const handleSave = async (data: Omit<Utilizador, 'id' | 'ultimoAcesso' | 'iniciais'> & { password?: string }) => {
        const payload: any = {
            nome: data.nome,
            email: data.email,
            role: PERFIL_TO_ROLE[data.perfil] ?? 'suporte',
            ativo: data.ativo,
        };
        if (data.password) payload.password = data.password;

        try {
            if (editUser) {
                await api.put(`/users/${editUser.id}`, payload);
                showToast('Utilizador atualizado com sucesso.');
            } else {
                await api.post(`/users`, payload);
                showToast('Utilizador criado com sucesso.');
            }
            await loadUsers();
        } catch (e) {
            console.error('Erro ao guardar utilizador', e);
            showToast('Erro ao guardar utilizador.');
        }
        setModalOpen(false);
        setEditUser(null);
    };

    const handleToggle = async (id: number) => {
        const u = users.find(x => x.id === id);
        if (!u) return;
        try {
            await api.put(`/users/${id}/${u.ativo ? 'deactivate' : 'activate'}`);
            setUsers(prev => prev.map(x => x.id === id ? { ...x, ativo: !x.ativo } : x));
            showToast('Estado do utilizador atualizado.');
        } catch (e) {
            console.error('Erro ao alterar estado', e);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Eliminar este utilizador?')) return;
        try {
            await api.delete(`/users/${id}`);
            setUsers(prev => prev.filter(u => u.id !== id));
            showToast('Utilizador eliminado.');
        } catch (e) {
            console.error('Erro ao eliminar utilizador', e);
            showToast('Erro ao eliminar utilizador.');
        }
    };

    const ativos   = users.filter(u => u.ativo).length;
    const campo    = users.filter(u => u.perfil === 'Técnico Campo').length;
    const inativos = users.filter(u => !u.ativo).length;

    return (
        <AppLayout>
            {/* Action bar */}
            <ActionBar title="Gestão de Utilizadores" breadcrumb="AQUATEX SGI · Administração · Utilizadores">
                <div className="actionbar-spacer" />
                <button
                    id="btn-novo-utilizador"
                    className="abtn abtn-primary"
                    onClick={() => { setEditUser(null); setModalOpen(true); }}
                    type="button"
                >
                    <Plus size={13} /> Novo Utilizador
                </button>
                <div className="actionbar-sep" />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {filtered.length} de {users.length} registos
                </span>
            </ActionBar>

            <div className="page-content">
                {/* Stats */}
                <div className="stats-row">
                    <div className="stat-card">
                        <span className="stat-label">Total</span>
                        <span className="stat-value">{users.length}</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Ativos</span>
                        <span className="stat-value blue">{ativos}</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Técnicos Campo</span>
                        <span className="stat-value green">{campo}</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Inativos</span>
                        <span className="stat-value muted">{inativos}</span>
                    </div>
                </div>

                {/* Filters */}
                <div className="filters-bar">
                    <div className="search-wrap">
                        <Search className="search-icon" />
                        <input
                            className="search-input"
                            placeholder="Pesquisar por nome ou email..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <select className="filter-select" value={filterPerfil} onChange={e => setFilterPerfil(e.target.value)}>
                        <option value="">Todos os Perfis</option>
                        <option value="Administrador">Administrador</option>
                        <option value="Técnico Suporte">Técnico Suporte</option>
                        <option value="Técnico Campo">Técnico Campo</option>
                        <option value="Vendedor">Vendedor</option>
                    </select>
                    <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="">Todos os Estados</option>
                        <option value="ativo">Ativo</option>
                        <option value="inativo">Inativo</option>
                    </select>
                    {(search || filterPerfil || filterStatus) && (
                        <button
                            className="abtn abtn-secondary"
                            onClick={() => { setSearch(''); setFilterPerfil(''); setFilterStatus(''); }}
                            type="button"
                        >
                            <Filter size={12} /> Limpar
                        </button>
                    )}
                </div>

                {/* Table */}
                <div className="table-container">
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 28 }} />
                                    <th>Código</th>
                                    <th>Utilizador</th>
                                    <th>Perfil</th>
                                    <th>Estado</th>
                                    <th>Email</th>
                                    <th>Telefone</th>
                                    <th>Último Acesso</th>
                                    <th style={{ width: 60 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {loading && (
                                    <tr><td colSpan={9}><div className="empty-state">A carregar...</div></td></tr>
                                )}
                                {!loading && filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={9}>
                                            <div className="empty-state">Nenhum utilizador encontrado.</div>
                                        </td>
                                    </tr>
                                )}
                                {filtered.map(u => (
                                    <tr key={u.id}>
                                        <td style={{ textAlign: 'center', paddingLeft: 8 }}>
                                            <span className={`dot ${u.ativo ? 'dot-green' : 'dot-gray'}`} title={u.ativo ? 'Ativo' : 'Inativo'} />
                                        </td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
                                            UT-{String(u.id).padStart(4, '0')}
                                        </td>
                                        <td>
                                            <div className="user-cell">
                                                <div className="user-avatar" style={{ background: u.ativo ? 'var(--blue)' : 'var(--border-dark)' }}>
                                                    {u.iniciais}
                                                </div>
                                                <div>
                                                    <div className="user-name">{u.nome}</div>
                                                    {u.tecnicoNome && (
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                            ↳ {u.tecnicoNome}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={PERF_BADGE[u.perfil]}>{u.perfil}</span>
                                        </td>
                                        <td>
                                            <div className="status-dot">
                                                <span className={`dot ${u.ativo ? 'dot-green' : 'dot-gray'}`} />
                                                {u.ativo ? 'Ativo' : 'Inativo'}
                                            </div>
                                        </td>
                                        <td>
                                            <span className="td-link">{u.email}</span>
                                        </td>
                                        <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{u.telefone}</td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{u.ultimoAcesso}</td>
                                        <td>
                                            <div className="row-actions">
                                                <button
                                                    className="icon-btn"
                                                    title="Editar"
                                                    onClick={() => { setEditUser(u); setModalOpen(true); }}
                                                    type="button"
                                                >
                                                    <Pencil size={12} />
                                                </button>
                                                <RowMenu
                                                    user={u}
                                                    onEdit={() => { setEditUser(u); setModalOpen(true); }}
                                                    onToggle={() => handleToggle(u.id)}
                                                    onDelete={() => handleDelete(u.id)}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="table-count">
                        {filtered.length} registo(s) encontrado(s)
                    </div>
                </div>
            </div>

            {/* Modal */}
            {modalOpen && (
                <UtilizadorModal
                    initial={editUser}
                    tecnicos={tecnicos}
                    onClose={() => { setModalOpen(false); setEditUser(null); }}
                    onSave={handleSave}
                />
            )}

            {/* Toast */}
            {toast && (
                <div className="toast" role="status">
                    <Check size={14} strokeWidth={2.5} style={{ color: 'var(--green)' }} />
                    <span>{toast}</span>
                </div>
            )}
        </AppLayout>
    );
};

export default UtilizadoresPage;
