import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Wrench, Package, CalendarDays,
  FileText, BarChart3, Settings, LogOut, Truck, MapPin,
  ClipboardList, ShoppingCart, type LucideIcon,
} from 'lucide-react';
import AquatexLogo from '../AquatexLogo';

interface NavItemDef { to: string; icon: LucideIcon; label: string; }

interface NavSection { title: string; items: NavItemDef[]; }

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Principal',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    title: 'Entidades',
    items: [
      { to: '/clientes',     icon: Users,         label: 'Clientes'     },
      { to: '/tecnicos',     icon: Wrench,         label: 'Técnicos'     },
      { to: '/fornecedores', icon: Truck,           label: 'Fornecedores' },
    ],
  },
  {
    title: 'Equipamentos',
    items: [
      { to: '/parque', icon: MapPin,        label: 'Parque'               },
      { to: '/planos', icon: ClipboardList, label: 'Planos de Manutenção' },
    ],
  },
  {
    title: 'Operações',
    items: [
      { to: '/ordens', icon: Wrench,       label: 'Ordens de Trabalho' },
      { to: '/agenda', icon: CalendarDays, label: 'Agenda'             },
    ],
  },
  {
    title: 'Comercial',
    items: [
      { to: '/encomendas', icon: ShoppingCart, label: 'Compras'    },
      { to: '/stock',      icon: Package,      label: 'Inventário' },
      { to: '/faturacao',  icon: FileText,     label: 'Faturação'  },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { to: '/utilizadores',  icon: Users,     label: 'Utilizadores'  },
      { to: '/relatorios',    icon: BarChart3, label: 'Relatórios'    },
      { to: '/configuracoes', icon: Settings,  label: 'Configurações' },
    ],
  },
];

interface SidebarProps { isOpen?: boolean; }

const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
  const currentUser = { name: 'Eurico Sapalo', role: 'Administrador', initials: 'ES' };

  return (
    <aside className={`sidebar${isOpen ? ' open' : ''}`}>
      <div className="sidebar-logo">
        <AquatexLogo height={30} />
        <span className="sidebar-logo-text">SGI</span>
      </div>

      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((section) => (
          <React.Fragment key={section.title}>
            <div className="sidebar-section-label">{section.title}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <item.icon size={16} strokeWidth={1.75} style={{ flexShrink: 0, width: 17, height: 17 }} />
                <span className="nav-item-label">{item.label}</span>
              </NavLink>
            ))}
          </React.Fragment>
        ))}
      </nav>

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
