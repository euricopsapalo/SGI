import React from 'react';

/**
 * #48 — Placeholder animado (shimmer) para tabelas durante o carregamento.
 * Renderiza `rows` linhas × `cols` colunas de barras. Colocar dentro de `<tbody>`.
 */
export interface TableSkeletonProps {
    rows?: number;
    cols: number;
}

const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, cols }) => (
    <>
        {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="skeleton-row" aria-hidden="true">
                {Array.from({ length: cols }).map((__, c) => (
                    <td key={c}>
                        <span className="skeleton-bar" style={{ width: `${60 + ((r + c) % 4) * 10}%` }} />
                    </td>
                ))}
            </tr>
        ))}
    </>
);

export default TableSkeleton;
