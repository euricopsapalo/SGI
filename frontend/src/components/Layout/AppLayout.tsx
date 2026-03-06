import React from 'react';
import TopNav from './TopNav';

interface AppLayoutProps {
    children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
    return (
        <div className="app-layout">
            <TopNav />
            <div className="app-body">
                {children}
            </div>
        </div>
    );
};

export default AppLayout;
