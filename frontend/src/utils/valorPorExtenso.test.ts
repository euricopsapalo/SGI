import { inteiroPorExtenso, valorPorExtenso } from './valorPorExtenso';

/** #178 — valor por extenso das faturas e recibos. */
describe('valorPorExtenso', () => {
    it.each([
        [0, 'zero'], [1, 'um'], [15, 'quinze'], [16, 'dezasseis'], [21, 'vinte e um'], [100, 'cem'], [101, 'cento e um'],
        [110, 'cento e dez'], [999, 'novecentos e noventa e nove'], [1000, 'mil'], [1001, 'mil e um'], [1100, 'mil e cem'],
        [1101, 'mil, cento e um'], [2000, 'dois mil'], [106951, 'cento e seis mil, novecentos e cinquenta e um'],
        [1000000, 'um milhão'], [2000500, 'dois milhões e quinhentos'], [1234567, 'um milhão, duzentos e trinta e quatro mil, quinhentos e sessenta e sete'],
    ])('inteiro %d → %s', (n, esperado) => {
        expect(inteiroPorExtenso(n)).toBe(esperado);
    });

    it('fatura modelo: 106 951,87', () => {
        expect(valorPorExtenso(106951.87)).toBe('Cento e seis mil, novecentos e cinquenta e um Kwanzas e oitenta e sete Cêntimos');
    });

    it('singular, só cêntimos, zero e milhões redondos', () => {
        expect(valorPorExtenso(1)).toBe('Um Kwanza');
        expect(valorPorExtenso(1.01)).toBe('Um Kwanza e um Cêntimo');
        expect(valorPorExtenso(0.5)).toBe('Cinquenta Cêntimos');
        expect(valorPorExtenso(0)).toBe('Zero Kwanzas');
        expect(valorPorExtenso(2000000)).toBe('Dois milhões de Kwanzas');
        expect(valorPorExtenso(114000)).toBe('Cento e catorze mil Kwanzas');
    });

    it('arredonda aos cêntimos (sem erros de vírgula flutuante)', () => {
        expect(valorPorExtenso(0.1 + 0.2)).toBe('Trinta Cêntimos');
        expect(valorPorExtenso(2841.3)).toBe('Dois mil, oitocentos e quarenta e um Kwanzas e trinta Cêntimos');
    });
});
