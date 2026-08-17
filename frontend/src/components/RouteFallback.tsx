import React from 'react';

/**
 * #42 — Fallback do `Suspense` enquanto o chunk de uma rota (React.lazy)
 * carrega. Spinner centrado, discreto, alinhado com a paleta AQUATEX.
 */
const RouteFallback: React.FC = () => (
    <div className="route-fallback" role="status" aria-live="polite">
        <span className="route-fallback__spinner" aria-hidden="true" />
        <span className="route-fallback__text">A carregar…</span>
    </div>
);

export default RouteFallback;
