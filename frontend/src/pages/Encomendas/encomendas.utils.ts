import { Encomenda, EncomendaLinha, EncomendaEstado, EmpresaConfig } from '../../contexts/GlobalContext';

/** #223 — extraído de EncomendaPage.tsx (divisão em componentes, sem alterações de comportamento). */

/* ══ Helpers ════════════════════════════════════════════════ */
export const linhaTotal = (l: EncomendaLinha) =>
    l.qtdEncomendada * l.custoUnit * (1 - l.desconto / 100);
export const encTotal = (e: Encomenda) => e.linhas.reduce((s, l) => s + linhaTotal(l), 0);

/** Cria helpers de formatação derivados da configuração da empresa (para funções de impressão fora do React). */
export function makePrintFmt(empresa: EmpresaConfig, simbolo?: string) {
    const casas = empresa.casasDecimais ?? 2;
    const simb  = simbolo ?? empresa.moeda ?? '';
    const fmt      = (n: number) => n.toLocaleString('pt-PT', { minimumFractionDigits: casas, maximumFractionDigits: casas });
    const fmtMoney = (n: number, moeda?: string) => `${fmt(n)} ${moeda ? moeda : simb}`;
    const fmtDate  = (s?: string): string => {
        if (!s) return '—';
        const d = new Date(s);
        if (isNaN(d.getTime())) return '—';
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = String(d.getFullYear());
        const f = empresa.formatoData ?? 'DD/MM/YYYY';
        if (f === 'YYYY-MM-DD') return `${yyyy}-${mm}-${dd}`;
        if (f === 'MM/DD/YYYY') return `${mm}/${dd}/${yyyy}`;
        return `${dd}/${mm}/${yyyy}`;
    };
    return { fmt, fmtMoney, fmtDate };
}

export const ESTADO_STYLE: Record<EncomendaEstado, { cls: string; label: string }> = {
    Aberta:    { cls: 'tbadge tbadge-campo',    label: 'Aberta' },
    Aprovada:  { cls: 'tbadge tbadge-active',   label: 'Aprovada' },
    Parcial:   { cls: 'tbadge tbadge-suporte',  label: 'Parcial' },
    Recebida:  { cls: 'tbadge tbadge-admin',    label: 'Recebida' },
    Cancelada: { cls: 'tbadge tbadge-vendedor', label: 'Cancelada' },
    Faturada:  { cls: 'tbadge tbadge-vendedor', label: 'Faturada' },
};
