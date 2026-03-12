import React from 'react';

/**
 * SGI — Logo vectorial AQUATEX
 *
 * Conceito: gota de água (AQUATEX / purificação) com visto branco
 * no interior (intervenção concluída). Cor primária #0D6EBF.
 *
 * Props:
 *   height  — altura em px (width é proporcional, ~0.7×)
 *   variant — 'color' (azul, para fundos escuros/brancos) | 'white' (tudo branco, para fundos coloridos)
 */
interface AquatexLogoProps {
    height?: number;
    variant?: 'color' | 'white';
    style?: React.CSSProperties;
}

const AquatexLogo: React.FC<AquatexLogoProps> = ({
    height = 40,
    variant = 'color',
    style,
}) => {
    const w = Math.round(height * 0.72);

    const dropFill   = variant === 'white' ? 'rgba(255,255,255,0.92)' : '#0D6EBF';
    const waveFill   = variant === 'white' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.16)';
    const checkColor = variant === 'white' ? '#0D6EBF'                : 'white';

    return (
        <svg
            viewBox="0 0 40 50"
            width={w}
            height={height}
            xmlns="http://www.w3.org/2000/svg"
            style={{ display: 'block', flexShrink: 0, ...style }}
            aria-label="SGI — AQUATEX"
        >
            {/* Gota de água */}
            <path
                d="M20 2 C20 2 5 19 5 31 C5 40.9 11.7 49 20 49 C28.3 49 35 40.9 35 31 C35 19 20 2 20 2Z"
                fill={dropFill}
            />

            {/* Onda na base da gota (reflexo) */}
            <path
                d="M5 37 Q9.5 32.5 14.5 37 Q19.5 41.5 24.5 37 Q29.5 32.5 34 37 L34 49 L6 49Z"
                fill={waveFill}
            />

            {/* Visto — intervenção concluída */}
            <polyline
                points="12,32 17,38.5 29,24"
                fill="none"
                stroke={checkColor}
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.95"
            />
        </svg>
    );
};

export default AquatexLogo;
