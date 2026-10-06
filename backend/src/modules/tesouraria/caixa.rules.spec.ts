import { apuramento, resumoSessao, validarSaida, valorSugerido } from './caixa.rules';

/** #167 — regras puras da gestão de caixa. */
describe('caixa.rules', () => {
    it('valor sugerido = contado no fecho anterior; 0 na primeira abertura', () => {
        expect(valorSugerido(null)).toBe(0);
        expect(valorSugerido(undefined)).toBe(0);
        expect(valorSugerido({ valorContado: '12500.50' })).toBe(12500.5);
        expect(valorSugerido({ valorContado: null })).toBe(0);
    });

    it('saldo teórico = abertura + entradas − saídas (valores com sinal, em string ou número)', () => {
        expect(resumoSessao('10000.00', ['50000.00', -2500, '0.10', '-0.20'])).toEqual({
            abertura: 10000, entradas: 50000.1, saidas: 2500.2, saldoTeorico: 57499.9,
        });
        expect(resumoSessao(0, [])).toEqual({ abertura: 0, entradas: 0, saidas: 0, saldoTeorico: 0 });
    });

    it('apuramento: sobra, quebra ou sem diferença (arredondado a cêntimos)', () => {
        expect(apuramento(57499.9, 57500)).toEqual({ diferenca: 0.1, acerto: 'SOBRA' });
        expect(apuramento(57499.9, 57000)).toEqual({ diferenca: -499.9, acerto: 'QUEBRA' });
        expect(apuramento(0.1 + 0.2, 0.3)).toEqual({ diferenca: 0, acerto: null });
    });

    it('saída: tem de ser positiva e não pode exceder o saldo teórico', () => {
        expect(validarSaida(100, 100)).toBeNull();
        expect(validarSaida(0, 100)).toMatch(/superior a zero/);
        expect(validarSaida(-5, 100)).toMatch(/superior a zero/);
        expect(validarSaida(100.01, 100)).toMatch(/excede o saldo da caixa \(100\)/);
    });
});
