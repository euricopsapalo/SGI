import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Users, Wrench, Package,
    CalendarDays, FileText, BarChart3, Settings, Bell,
    Truck, MapPin, ClipboardList, ShoppingCart, ChevronDown,
    LogOut, ScrollText, RefreshCw, UserCog, Menu, X, Receipt,
    type LucideIcon,
} from 'lucide-react';
import AquatexLogo from '../AquatexLogo';
import { useGlobal } from '../../contexts/GlobalContext';

interface NavItem { to: string; icon: LucideIcon; label: string; }

interface NavGroup {
    label: string;
    icon: LucideIcon;
    items: NavItem[];
    direct?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
    {
        label: 'Início', icon: LayoutDashboard, direct: true,
        items: [{ to: '/dashboard', icon: LayoutDashboard, label: 'Início' }],
    },
    {
        label: 'Entidades', icon: Users,
        items: [
            { to: '/clientes',     icon: Users, label: 'Clientes'     },
            { to: '/fornecedores', icon: Truck, label: 'Fornecedores' },
        ],
    },
    {
        label: 'Equipamentos', icon: MapPin,
        items: [
            { to: '/parque', icon: MapPin,        label: 'Parque'               },
            { to: '/planos', icon: ClipboardList, label: 'Planos de Manutenção' },
        ],
    },
    {
        label: 'Operações', icon: ClipboardList,
        items: [
            { to: '/ordens',    icon: Wrench,       label: 'Ordens de Trabalho' },
            { to: '/agenda',    icon: CalendarDays, label: 'Agenda'             },
            { to: '/tecnicos',  icon: UserCog,      label: 'Técnicos'           },
        ],
    },
    {
        label: 'Comercial', icon: ShoppingCart,
        items: [
            { to: '/compras', icon: ShoppingCart, label: 'Compras'    },
            { to: '/stock',      icon: Package,      label: 'Inventário' },
            { to: '/vendas',     icon: Receipt,      label: 'Vendas'     },
            { to: '/faturacao',  icon: FileText,     label: 'Faturação (anterior)' },
        ],
    },
    {
        label: 'Gestão', icon: Settings,
        items: [
            { to: '/utilizadores',  icon: Users,       label: 'Utilizadores'   },
            { to: '/relatorios',    icon: BarChart3,   label: 'Relatórios'     },
            { to: '/logs',          icon: ScrollText,  label: 'Logs do Sistema' },
            { to: '/configuracoes', icon: Settings,    label: 'Configurações'  },
        ],
    },
];

/* ── Dropdown Menu ── */
const DropdownGroup: React.FC<{ group: NavGroup }> = ({ group }) => {
    const [open, setOpen] = useState(false);
    const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
    const wrapRef = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleToggle = () => {
        if (!open && btnRef.current) {
            const r = btnRef.current.getBoundingClientRect();
            setDropPos({ top: r.bottom + 2, left: r.left });
        }
        setOpen(p => !p);
    };

    const isGroupActive = group.items.some(i => window.location.pathname.startsWith(i.to));
    const GroupIcon = group.icon;

    return (
        <div ref={wrapRef} style={{ position: 'relative', display: 'flex', alignSelf: 'stretch' }}>
            <button
                ref={btnRef}
                type="button"
                onClick={handleToggle}
                className={`topnav-item${isGroupActive ? ' active' : ''}`}
                style={{ border: 'none', background: 'none', height: '100%' }}
            >
                <GroupIcon size={17} strokeWidth={1.75} />
                <span className="topnav-item-label">
                    {group.label}
                    <ChevronDown
                        size={8}
                        strokeWidth={2.5}
                        style={{
                            transition: 'transform 0.15s',
                            transform: open ? 'rotate(180deg)' : 'none',
                            opacity: 0.65,
                        }}
                    />
                </span>
            </button>

            {open && (
                /* position: fixed escapes any overflow container (including scroll wrappers) */
                <div style={{
                    position: 'fixed', top: dropPos.top, left: dropPos.left, zIndex: 1000,
                    background: 'var(--panel-bg, #fff)', border: '1px solid var(--border)',
                    borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                    minWidth: 200, padding: '4px 0',
                }}>
                    <div style={{
                        padding: '4px 14px 6px', fontSize: '0.68rem', fontWeight: 700,
                        color: 'var(--text-muted)', textTransform: 'uppercase',
                        letterSpacing: '0.06em', borderBottom: '1px solid var(--border)', marginBottom: 4,
                    }}>
                        {group.label}
                    </div>
                    {group.items.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => setOpen(false)}
                            style={({ isActive }) => ({
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '7px 14px', fontSize: '0.82rem', textDecoration: 'none',
                                color: isActive ? 'var(--blue)' : 'var(--text-primary)',
                                background: isActive ? 'var(--blue-light, #EFF6FF)' : 'none',
                                fontWeight: isActive ? 600 : 400,
                            })}
                        >
                            <item.icon size={14} strokeWidth={1.75} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
                            {item.label}
                        </NavLink>
                    ))}
                </div>
            )}
        </div>
    );
};

/* ── TopNav ── */
const TECNICO_CAMPO_GROUPS = new Set(['Início', 'Operações']);

const TopNav: React.FC = () => {
    const { currentUser, logout, addLog, reloadData } = useGlobal();
    const navigate = useNavigate();
    const location = useLocation();
    const [reloading, setReloading] = useState(false);
    // #44 — menu móvel (hambúrguer) para tablet/telemóvel (< 1024px)
    const [menuOpen, setMenuOpen] = useState(false);
    const isTecnicoCampo = currentUser?.role === 'Técnico de Campo';

    // Fecha o menu móvel ao mudar de rota
    useEffect(() => { setMenuOpen(false); }, [location.pathname]);

    const handleReload = async () => {
        setReloading(true);
        await reloadData();
        setReloading(false);
    };
    const visibleGroups = isTecnicoCampo
        ? NAV_GROUPS.filter(g => TECNICO_CAMPO_GROUPS.has(g.label))
        : NAV_GROUPS;

    const handleLogout = () => {
        addLog({ usuario: currentUser?.email ?? 'sistema', modulo: 'Autenticação', acao: 'Logout', detalhes: `Utilizador: ${currentUser?.nome ?? ''}`, tipo: 'info' });
        logout();
        navigate('/login');
    };

    return (
        <nav className="topnav" role="navigation" aria-label="Navegação principal">
            {/* Hambúrguer — só visível < 1024px (#44) */}
            <button
                type="button"
                className="topnav-burger"
                aria-label={menuOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
                aria-expanded={menuOpen}
                aria-controls="topnav-mobile-drawer"
                onClick={() => setMenuOpen(o => !o)}
            >
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* Logo */}
            <div className="topnav-logo">
                <AquatexLogo height={30} />
                <span className="topnav-logo-sub">SGI</span>
            </div>

            {/* Modules (desktop) */}
            <div className="topnav-modules">
                {visibleGroups.map(group => {
                    if (group.direct) {
                        const DirectItem = group.items[0];
                        const Icon = DirectItem.icon;
                        return (
                            <NavLink
                                key={DirectItem.to}
                                to={DirectItem.to}
                                className={({ isActive }) => `topnav-item${isActive ? ' active' : ''}`}
                            >
                                <Icon size={17} strokeWidth={1.75} />
                                <span className="topnav-item-label">{group.label}</span>
                            </NavLink>
                        );
                    }
                    return <DropdownGroup key={group.label} group={group} />;
                })}
            </div>

            {/* Right side */}
            <div className="topnav-right">
                {currentUser && (
                    <div className="topnav-user">
                        <span className="topnav-user-name">{currentUser.nome}</span>
                        <span className="topnav-user-role">{currentUser.role}</span>
                    </div>
                )}
                <button
                    className="topnav-icon-btn"
                    aria-label="Recarregar dados"
                    title="Recarregar dados"
                    onClick={handleReload}
                    disabled={reloading}
                    style={{ opacity: reloading ? 0.5 : 1 }}
                >
                    <RefreshCw size={16} strokeWidth={1.75} style={{ animation: reloading ? 'spin 1s linear infinite' : 'none' }} />
                </button>
                <button className="topnav-icon-btn" aria-label="Notificações" title="Notificações">
                    <Bell size={16} strokeWidth={1.75} />
                </button>
                {!isTecnicoCampo && (
                    <NavLink
                        to="/configuracoes"
                        className="topnav-icon-btn"
                        aria-label="Configurações"
                        title="Configurações"
                    >
                        <Settings size={16} strokeWidth={1.75} />
                    </NavLink>
                )}
                <button
                    className="topnav-icon-btn"
                    aria-label="Terminar sessão"
                    title="Terminar sessão"
                    onClick={handleLogout}
                    style={{ color: 'var(--red, #dc2626)' }}
                >
                    <LogOut size={16} strokeWidth={1.75} />
                </button>
            </div>

            {/* Drawer de navegação móvel (#44) — só < 1024px via CSS */}
            {menuOpen && (
                <div className="topnav-drawer-overlay" onClick={() => setMenuOpen(false)}>
                    <div
                        id="topnav-mobile-drawer"
                        className="topnav-drawer"
                        onClick={e => e.stopPropagation()}
                    >
                        {currentUser && (
                            <div className="topnav-drawer-user">
                                <span className="topnav-drawer-user__name">{currentUser.nome}</span>
                                <span className="topnav-drawer-user__role">{currentUser.role}</span>
                            </div>
                        )}
                        {visibleGroups.map(group => (
                            <div key={group.label} className="topnav-drawer-group">
                                <div className="topnav-drawer-group__label">{group.label}</div>
                                {group.items.map(item => (
                                    <NavLink
                                        key={item.to}
                                        to={item.to}
                                        className={({ isActive }) => `topnav-drawer-item${isActive ? ' active' : ''}`}
                                    >
                                        <item.icon size={16} strokeWidth={1.75} />
                                        {item.label}
                                    </NavLink>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </nav>
    );
};

export default TopNav;
