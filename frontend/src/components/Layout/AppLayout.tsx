import React from 'react';
import TopNav from './TopNav';

interface AppLayoutProps {
    children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
    return (
        <div className="app-layout">
            {/* #45 — salto de teclado para o conteúdo principal */}
            <a href="#main-content" className="skip-link">Saltar para o conteúdo</a>
            <TopNav />
            <main id="main-content" className="app-body" tabIndex={-1}>
                {children}
            </main>
        </div>
    );
};

export default AppLayout;
