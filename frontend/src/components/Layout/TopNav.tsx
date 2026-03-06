import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard, Users, Wrench, Package,
    CalendarDays, FileText, BarChart3, Settings, Bell,
    type LucideIcon,
} from 'lucide-react';
import logo from '../../assets/aquatex-logo.png';

interface NavItem { to: string; icon: LucideIcon; label: string; }

const mainItems: NavItem[] = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Início' },
    { to: '/clientes', icon: Users, label: 'Clientes' },
    { to: '/ordens', icon: Wrench, label: 'Ordens' },
    { to: '/stock', icon: Package, label: 'Stock' },
    { to: '/agenda', icon: CalendarDays, label: 'Agenda' },
    { to: '/faturacao', icon: FileText, label: 'Faturação' },
    { to: '/relatorios', icon: BarChart3, label: 'Relatórios' },
];

const adminItems: NavItem[] = [
    { to: '/utilizadores', icon: Users, label: 'Utilizadores' },
    { to: '/configuracoes', icon: Settings, label: 'Config.' },
];

const TopNav: React.FC = () => {
    const user = { name: 'Eurico Sapalo', role: 'Administrador' };

    return (
        <nav className="topnav" role="navigation" aria-label="Navegação principal">
            {/* Logo */}
            <div className="topnav-logo">
                <img src={logo} alt="AQUATEX" />
                <span className="topnav-logo-sub">SGI</span>
            </div>

            {/* Main modules */}
            <div className="topnav-modules">
                {mainItems.map(item => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) => `topnav-item${isActive ? ' active' : ''}`}
                        title={item.label}
                    >
                        <item.icon size={18} strokeWidth={1.75} />
                        {item.label}
                    </NavLink>
                ))}

                {/* Separator */}
                <div className="topnav-divider" aria-hidden="true" />

                {/* Admin modules */}
                {adminItems.map(item => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) => `topnav-item${isActive ? ' active' : ''}`}
                        title={item.label}
                    >
                        <item.icon size={18} strokeWidth={1.75} />
                        {item.label}
                    </NavLink>
                ))}
            </div>

            {/* Right side */}
            <div className="topnav-right">
                <div className="topnav-user">
                    <span className="topnav-user-name">{user.name}</span>
                    <span className="topnav-user-role">{user.role}</span>
                </div>
                <button className="topnav-icon-btn" aria-label="Notificações" title="Notificações">
                    <Bell size={16} strokeWidth={1.75} />
                </button>
                <NavLink
                    to="/configuracoes"
                    className="topnav-icon-btn"
                    aria-label="Configurações"
                    title="Configurações"
                >
                    <Settings size={16} strokeWidth={1.75} />
                </NavLink>
            </div>
        </nav>
    );
};

export default TopNav;
