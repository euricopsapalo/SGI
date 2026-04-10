import { calcNextDate } from './ordens-trabalho.service';

describe('calcNextDate', () => {
    const base = '2024-01-15';

    it('Mensal: adiciona 1 mês', () => {
        expect(calcNextDate(base, 'Mensal')).toBe('2024-02-15');
    });

    it('Trimestral: adiciona 3 meses', () => {
        expect(calcNextDate(base, 'Trimestral')).toBe('2024-04-15');
    });

    it('Semestral: adiciona 6 meses', () => {
        expect(calcNextDate(base, 'Semestral')).toBe('2024-07-15');
    });

    it('Anual: adiciona 1 ano', () => {
        expect(calcNextDate(base, 'Anual')).toBe('2025-01-15');
    });

    it('Default (valor desconhecido): adiciona 1 mês', () => {
        expect(calcNextDate(base, 'Desconhecido')).toBe('2024-02-15');
    });
});
