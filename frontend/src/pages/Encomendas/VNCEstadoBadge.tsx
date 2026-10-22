import React from 'react';
import { FaturaFornecedor } from '../../contexts/GlobalContext';

/** #223 — extraído de EncomendaPage.tsx (divisão em componentes, sem alterações de comportamento). */

/* ══ VNC Estado Badge ═══════════════════════════════════════ */
export const VNC_ESTADO_COLORS: Record<string, { bg: string; color: string }> = {
    Rascunho:         { bg: '#f3f4f6', color: '#374151' },
    AguardaAprovacao: { bg: '#fefce8', color: '#b45309' },
    Validado:         { bg: '#dcfce7', color: '#15803d' },
};
export const VNC_TRANSITIONS: Record<string, { label: string; next: string } | null> = {
    Rascunho:         { label: 'Enviar p/ Aprovação', next: 'AguardaAprovacao' },
    AguardaAprovacao: { label: 'Validar',             next: 'Validado' },
    Validado:         null,
};
export interface VNCEstadoBadgeProps { fatura: FaturaFornecedor; onTransition: (novoEstado: string) => void; }
export const VNCEstadoBadge: React.FC<VNCEstadoBadgeProps> = ({ fatura, onTransition }) => {
    const estado  = fatura.estadoDocumento;
    const style   = VNC_ESTADO_COLORS[estado] ?? { bg: '#f3f4f6', color: '#374151' };
    const action  = VNC_TRANSITIONS[estado];
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, borderRadius: 10, padding: '2px 8px', background: style.bg, color: style.color, whiteSpace: 'nowrap' }}>
                {estado === 'AguardaAprovacao' ? 'Aguarda Apr.' : estado}
            </span>
            {action && (
                <button
                    className="abtn abtn-ghost"
                    style={{ fontSize: '0.68rem', padding: '1px 6px', height: 22 }}
                    onClick={() => onTransition(action.next)}
                >
                    {action.label}
                </button>
            )}
        </div>
    );
};
