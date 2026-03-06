import React from 'react';

interface ActionBarProps {
    title: string;
    breadcrumb?: string;
    children?: React.ReactNode;
}

/**
 * ActionBar — white sub-header below TopNav.
 * Shows page title (in caps style) and action buttons.
 */
const ActionBar: React.FC<ActionBarProps> = ({ title, breadcrumb, children }) => {
    return (
        <div className="actionbar">
            <span className="actionbar-title" title={breadcrumb || title}>
                {title}
            </span>
            {children}
        </div>
    );
};

export default ActionBar;
