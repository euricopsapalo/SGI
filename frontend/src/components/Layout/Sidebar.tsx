import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Wrench,
  Package,
  CalendarDays,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import logo from '../../assets/aquatex-logo.png';

interface NavItemDef {
  to: string;
  icon: LucideIcon;
  label: string;
}

const mainNav: NavItemDef[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/ordens', icon: Wrench, label: 'Ordens de Serviço' },
  { to: '/stock', icon: Package, label: 'Stock & Catálogo' },
  { to: '/agenda', icon: CalendarDays, label: 'Agenda' },
  { to: '/faturacao', icon: FileText, label: 'Faturação' },
  { to: '/relatorios', icon: BarChart3, label: 'Relatórios' },
];

const adminNav: NavItemDef[] = [
  { to: '/utilizadores', icon: Users, label: 'Utilizadores' },
  { to: '/configuracoes', icon: Settings, label: 'Configurações' },
];

interface SidebarProps {
  isOpen?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
  // Mock current user
  const currentUser = { name: 'Eurico Sapalo', role: 'Administrador', initials: 'ES' };

  return (
    <aside className={`sidebar${isOpen ? ' open' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <img src={logo} alt="AQUATEX" />
        <span className="sidebar-logo-text">SGI</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Principal</div>
        {mainNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <item.icon size={17} strokeWidth={1.75} style={{ flexShrink: 0, width: 18, height: 18 }} />
            <span className="nav-item-label">{item.label}</span>
          </NavLink>
        ))}

        <div className="sidebar-section-label" style={{ marginTop: 16 }}>
          Administração
        </div>
        {adminNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <item.icon size={17} strokeWidth={1.75} style={{ flexShrink: 0, width: 18, height: 18 }} />
            <span className="nav-item-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="user-avatar-sm">{currentUser.initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{currentUser.name}</div>
            <div className="sidebar-user-role">{currentUser.role}</div>
          </div>
          <LogOut size={15} strokeWidth={1.75} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
