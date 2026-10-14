import React from 'react';
import { X } from 'lucide-react';
import { useModalA11y } from '../../components/useModalA11y';
import type { TipoArtigo } from '../../contexts/GlobalContext';

/** #165/#166 — peças partilhadas pelos separadores de Vendas. */

export const muted: React.CSSProperties = { fontSize: '0.74rem', color: 'var(--text-muted)' };
export const mono: React.CSSProperties = { fontFamily: 'monospace', fontSize: '0.78rem' };
export const num: React.CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

export const Modal: React.FC<{ titulo: string; largura?: number; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }> = ({ titulo, largura = 860, onClose, children, footer }) => {
    const ref = useModalA11y(onClose);
    return (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: largura, width: '100%' }} ref={ref} role="dialog" aria-modal="true" aria-label={titulo} tabIndex={-1}>
                <div className="modal-header">
                    <h3 className="modal-title">{titulo}</h3>
                    <button className="modal-close" aria-label="Fechar" type="button" onClick={onClose}><X size={13} /></button>
                </div>
                <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>{children}</div>
                <div className="modal-footer">{footer}</div>
            </div>
        </div>
    );
};

/** #195 — etiqueta de linha de Serviço (e sujeita a retenção na fonte); nada para Produtos. */
export const EtiquetaTipo: React.FC<{ tipo?: TipoArtigo; retencao?: boolean }> = ({ tipo, retencao }) => (tipo === 'SERVICO' ? (
    <span title={retencao ? 'Serviço sujeito a retenção na fonte' : 'Serviço'} style={{ marginLeft: 6, fontSize: '0.66rem', fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'var(--blue-light,#EFF6FF)', color: 'var(--blue)', whiteSpace: 'nowrap' }}>
        Serviço{retencao ? ' · Ret.' : ''}
    </span>
) : null);

/** Motivo de rejeição de um `adiado` quando a operação não chegou a acontecer (não é um erro a mostrar). */
export const CANCELADO = Symbol('cancelado');

/** Promessa resolvida por fora — usada para abrir a janela de impressão no clique e preenchê-la depois de gravar. */
export function adiado() {
    let resolver!: () => void;
    let rejeitar!: (motivo: unknown) => void;
    const promise = new Promise<void>((res, rej) => { resolver = res; rejeitar = rej; });
    promise.catch(() => undefined); // evita "unhandled rejection" quando ninguém está à espera
    return { promise, resolver, rejeitar };
}

/** Data-hora de um instante em hora local (pt-PT). */
export const fmtDataHora = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('pt-PT') : '—');
