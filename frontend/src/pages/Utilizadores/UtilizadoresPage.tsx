import React, { useState, useRef, useEffect } from 'react';
import AppLayout from '../../components/Layout/AppLayout';
import ActionBar from '../../components/Layout/ActionBar';
import UtilizadorModal from './UtilizadorModal';
import { useGlobal } from '../../contexts/GlobalContext';
import {
    Search, Plus, Filter, Pencil, Trash2,
    ToggleLeft, ToggleRight, MoreVertical, Check,
} from 'lucide-react';

/* ── Types ── */
export interface Utilizador {
    id: number;
    nome: string;
    email: string;
    telefone: string;
    perfil: 'Administrador' | 'Técnico Suporte' | 'Técnico Campo' | 'Vendedor';
    ativo: boolean;
    ultimoAcesso: string;
    iniciais: string;
    tecnicoId?: string;
    tecnicoNome?: string;
}

/* ── Mock data ── */
const MOCK: Utilizador[] = [
    { id: 1, nome: 'Ana Ferreira', email: 'ana.ferreira@aquatex.ao', telefone: '+244 923 111 111', perfil: 'Administrador', ativo: true, ultimoAcesso: '06/03/2026 08:12', iniciais: 'AF' },
    { id: 2, nome: 'Bruno Cunha', email: 'bruno.cunha@aquatex.ao', telefone: '+244 912 222 222', perfil: 'Técnico Campo', ativo: true, ultimoAcesso: '06/03/2026 07:50', iniciais: 'BC', tecnicoId: 'TEC-002', tecnicoNome: 'Gabriel Teixeira' },
    { id: 3, nome: 'Carla Mendes', email: 'carla.mendes@aquatex.ao', telefone: '+244 934 333 333', perfil: 'Técnico Suporte', ativo: true, ultimoAcesso: '05/03/2026 16:45', iniciais: 'CM' },
    { id: 4, nome: 'Daniel Nkosi', email: 'daniel.nkosi@aquatex.ao', telefone: '+244 944 444 444', perfil: 'Vendedor', ativo: true, ultimoAcesso: '04/03/2026 11:30', iniciais: 'DN' },
    { id: 5, nome: 'Eurico Sapalo', email: 'eurico.sapalo@aquatex.ao', telefone: '+244 926 555 555', perfil: 'Administrador', ativo: true, ultimoAcesso: '06/03/2026 09:01', iniciais: 'ES' },
    { id: 6, nome: 'Fátima Rodrigues', email: 'fatima.rodrigues@aquatex.ao', telefone: '+244 915 666 666', perfil: 'Técnico Campo', ativo: true, ultimoAcesso: '05/03/2026 14:22', iniciais: 'FR', tecnicoId: 'TEC-005', tecnicoNome: 'Carla Mendes' },
    { id: 7, nome: 'Gabriel Teixeira', email: 'gabriel.teixeira@aquatex.ao', telefone: '+244 932 777 777', perfil: 'Técnico Campo', ativo: false, ultimoAcesso: '01/03/2026 09:00', iniciais: 'GT', tecnicoId: 'TEC-003', tecnicoNome: 'Pedro Neto' },
    { id: 8, nome: 'Helena Campos', email: 'helena.campos@aquatex.ao', telefone: '+244 942 888 888', perfil: 'Técnico Suporte', ativo: true, ultimoAcesso: '06/03/2026 08:55', iniciais: 'HC' },
    { id: 9, nome: 'Ivan Lopes', email: 'ivan.lopes@aquatex.ao', telefone: '+244 927 999 999', perfil: 'Vendedor', ativo: false, ultimoAcesso: '28/02/2026 17:30', iniciais: 'IL' },
    { id: 10, nome: 'Joana Tavares', email: 'joana.tavares@aquatex.ao', telefone: '+244 912 000 000', perfil: 'Técnico Campo', ativo: true, ultimoAcesso: '06/03/2026 07:15', iniciais: 'JT', tecnicoId: 'TEC-006', tecnicoNome: 'Sofia Gomes' },
];

const PERF_BADGE: Record<string, string> = {
    'Administrador': 'tbadge tbadge-admin',
    'Técnico Suporte': 'tbadge tbadge-suporte',
    'Técnico Campo': 'tbadge tbadge-campo',
    'Vendedor': 'tbadge tbadge-vendedor',
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
    const [users, setUsers] = useState<Utilizador[]>(MOCK);
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

    const handleSave = (data: Omit<Utilizador, 'id' | 'ultimoAcesso' | 'iniciais'>) => {
        const iniciais = (data.tecnicoNome ?? data.nome).split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
        if (editUser) {
            setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...data, iniciais } : u));
            showToast('Utilizador atualizado com sucesso.');
        } else {
            const novo: Utilizador = {
                ...data, iniciais,
                id: Date.now(),
                ultimoAcesso: 'Nunca',
            };
            setUsers(prev => [novo, ...prev]);
            showToast('Utilizador criado com sucesso.');
        }
        setModalOpen(false);
        setEditUser(null);
    };

    const handleToggle = (id: number) => {
        setUsers(prev => prev.map(u => u.id === id ? { ...u, ativo: !u.ativo } : u));
        showToast('Estado do utilizador atualizado.');
    };

    const handleDelete = (id: number) => {
        if (!window.confirm('Eliminar este utilizador?')) return;
        setUsers(prev => prev.filter(u => u.id !== id));
        showToast('Utilizador eliminado.');
    };

    const ativos = users.filter(u => u.ativo).length;
    const campo = users.filter(u => u.perfil === 'Técnico Campo').length;
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
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={9}>
                                            <div className="empty-state">Nenhum utilizador encontrado.</div>
                                        </td>
                                    </tr>
                                )}
                                {filtered.map((u, idx) => (
                                    <tr key={u.id}>
                                        {/* status dot col */}
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
