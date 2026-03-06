import React from 'react';
import { Bell, Menu } from 'lucide-react';

interface TopBarProps {
    title: string;
    breadcrumb?: string;
    onMenuToggle?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ title, breadcrumb, onMenuToggle }) => {
    return (
        <header className="topbar">
            <div className="topbar-left">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Mobile menu toggle */}
                    <button
                        onClick={onMenuToggle}
                        className="btn btn-ghost btn-icon"
                        style={{ display: 'none' }}
                        id="menu-toggle"
                        aria-label="Abrir menu"
                    >
                        <Menu size={18} />
                    </button>
                    <div>
                        <div className="topbar-title">{title}</div>
                        {breadcrumb && (
                            <div className="topbar-breadcrumb">AQUATEX SGI · {breadcrumb}</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="topbar-right">
                {/* Notifications */}
                <button className="topbar-badge" aria-label="Notificações" title="Notificações">
                    <Bell size={16} strokeWidth={1.75} />
                    <span className="topbar-badge-dot" aria-hidden="true" />
                </button>
            </div>
        </header>
    );
};

export default TopBar;
