import React from 'react';

/**
 * #48 — Estado vazio consistente para listagens: ícone + título + (opcional)
 * descrição e botão de ação (CTA). Pode ser colocado dentro de uma célula de
 * tabela (`<td colSpan>`) ou solto num container.
 */
export interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: { label: string; onClick: () => void; icon?: React.ReactNode };
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
    <div className="empty-state empty-state--rich">
        {icon && <div className="empty-state__icon">{icon}</div>}
        <div className="empty-state__title">{title}</div>
        {description && <div className="empty-state__desc">{description}</div>}
        {action && (
            <button type="button" className="abtn abtn-primary empty-state__cta" onClick={action.onClick}>
                {action.icon}{action.label}
            </button>
        )}
    </div>
);

export default EmptyState;
