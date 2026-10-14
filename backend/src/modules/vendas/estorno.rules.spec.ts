import { abaterPendente, qtdEstornavel, totalmenteEstornado, validarLinhasEstorno } from './estorno.rules';
import { estadoFaturacao, EstadoFaturacao } from './vendas.rules';

/** #169 — regras puras do estorno (v11 §5.3). */
describe('estorno.rules', () => {
    const origem = new Map([
        [1, { id: 1, quantidade: '2.000', qtdEstornada: '0' }],
        [2, { id: 2, quantidade: '1.000', qtdEstornada: '1.000' }],
        [3, { id: 3, quantidade: '1.500', qtdEstornada: '0.500' }],
    ]);
    const motivos = new Set([10]);

    it('qtdEstornavel = quantidade − já estornada (3 casas)', () => {
        expect(qtdEstornavel(origem.get(1)!)).toBe(2);
        expect(qtdEstornavel(origem.get(2)!)).toBe(0);
        expect(qtdEstornavel(origem.get(3)!)).toBe(1);
    });

    it('aceita estorno parcial e total dentro do que falta estornar', () => {
        expect(validarLinhasEstorno([
            { linhaId: 1, quantidade: 1, motivoEstornoId: 10 },
            { linhaId: 3, quantidade: 1, motivoEstornoId: 10 },
        ], origem, motivos)).toEqual({});
    });

    it('estorno acima do faturado / linha já estornada → erro na quantidade', () => {
        expect(validarLinhasEstorno([{ linhaId: 1, quantidade: 3, motivoEstornoId: 10 }], origem, motivos))
            .toEqual({ 'linhas.0.quantidade': 'A quantidade excede a ainda por estornar (2)' });
        expect(validarLinhasEstorno([{ linhaId: 2, quantidade: 1, motivoEstornoId: 10 }], origem, motivos))
            .toEqual({ 'linhas.0.quantidade': 'A linha já foi totalmente estornada' });
        expect(validarLinhasEstorno([{ linhaId: 1, quantidade: 0, motivoEstornoId: 10 }], origem, motivos))
            .toHaveProperty(['linhas.0.quantidade']);
    });

    it('linha de outro documento, repetida ou sem motivo válido', () => {
        const e = validarLinhasEstorno([
            { linhaId: 99, quantidade: 1, motivoEstornoId: 10 },
            { linhaId: 1, quantidade: 1, motivoEstornoId: 77 },
            { linhaId: 1, quantidade: 1, motivoEstornoId: 10 },
        ], origem, motivos);
        expect(e).toEqual({
            'linhas.0.linhaId': 'A linha não pertence ao documento a estornar',
            'linhas.1.motivoEstornoId': 'Indique um motivo de estorno válido',
            'linhas.2.linhaId': 'Linha repetida no estorno',
        });
    });

    it('totalmenteEstornado só quando todas as linhas estão esgotadas', () => {
        expect(totalmenteEstornado([origem.get(1)!, origem.get(2)!])).toBe(false);
        expect(totalmenteEstornado([origem.get(2)!])).toBe(true);
        expect(totalmenteEstornado([])).toBe(false);
    });

    it('abaterPendente: abate até ao pendente; o resto fica no estorno (saldo a favor)', () => {
        expect(abaterPendente(114000, 34200)).toEqual({ abatido: 34200, pendenteOrigem: 79800, pendenteEstorno: 0 });
        expect(abaterPendente(10000, 34200)).toEqual({ abatido: 10000, pendenteOrigem: 0, pendenteEstorno: 24200 });
        expect(abaterPendente(0, 34200)).toEqual({ abatido: 0, pendenteOrigem: 0, pendenteEstorno: 34200 });
    });

    it('estadoFaturacao: documento totalmente estornado → Estornada', () => {
        expect(estadoFaturacao(5, { valorOriginal: 100, valorPendente: 0 }, true)).toBe(EstadoFaturacao.ESTORNADA);
        expect(estadoFaturacao(null, null, true)).toBe(EstadoFaturacao.NAO_FATURADA);
    });
});
