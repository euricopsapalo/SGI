import { calcularTotais, paraDataHoraLocal } from './vendas';

/** #165 — pré-visualização dos totais no editor (mesmo cálculo do backend). */
describe('vendas — totais do rascunho', () => {
    const l = (over: Partial<{ quantidade: number; precoUnitario: number; desconto: number; taxaIva: number }> = {}) =>
        ({ quantidade: 1, precoUnitario: 1000, desconto: 0, taxaIva: 14, ...over });

    it('e2e §7.4: 2 × 30 000 + 1 × 40 000 com IVA 14 % → 114 000', () => {
        expect(calcularTotais([l({ quantidade: 2, precoUnitario: 30000 }), l({ precoUnitario: 40000 })]))
            .toEqual({ linhas: [60000, 40000], subtotal: 100000, desconto: 0, valorIva: 14000, total: 114000 });
    });

    it('desconto de linha e global reduzem a base do IVA', () => {
        const t = calcularTotais([l({ precoUnitario: 1000 }), l({ precoUnitario: 1000, taxaIva: 0 })], 10);
        expect(t).toMatchObject({ subtotal: 2000, desconto: 200, valorIva: 126, total: 1926 });
        expect(calcularTotais([l({ quantidade: 2, precoUnitario: 500, desconto: 10 })]).total).toBe(1026);
    });

    it('paraDataHoraLocal formata para datetime-local', () => {
        expect(paraDataHoraLocal(new Date(2026, 0, 5, 9, 7))).toBe('2026-01-05T09:07');
    });
});
