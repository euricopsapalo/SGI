import { diasAtraso, MovimentoLiquidavel, saldoCorrido, termoNumeroDocumento, validarLinhasLiquidacao, valorPorModo } from './tesouraria.rules';

/** #166/#174 — Regras puras de tesouraria e conta corrente. */
describe('tesouraria.rules', () => {
    const mov = (over: Partial<MovimentoLiquidavel> = {}): MovimentoLiquidavel => ({
        id: 1, clienteId: 3, ccTipoId: 1, ccEstadoId: 1, natureza: 'D', valorPendente: 114000, modoPagamentoId: 2, ...over,
    });
    const ctx = { clienteId: 3, ccTipoId: 1, ccEstadoId: 1 };

    describe('validarLinhasLiquidacao', () => {
        const movs = new Map([
            [1, mov()],
            [2, mov({ id: 2, clienteId: 9 })],
            [3, mov({ id: 3, ccEstadoId: 5 })],
            [4, mov({ id: 4, natureza: 'C' })],
        ]);

        it('aceita pagamento total, parcial e com desconto até ao pendente', () => {
            expect(validarLinhasLiquidacao([{ movimentoCcId: 1, valorPago: 114000 }], movs, ctx)).toEqual({});
            expect(validarLinhasLiquidacao([{ movimentoCcId: 1, valorPago: 50000 }], movs, ctx)).toEqual({});
            expect(validarLinhasLiquidacao([{ movimentoCcId: 1, valorPago: 100000, desconto: 14000 }], movs, ctx)).toEqual({});
        });

        it('recusa exceder o pendente, valor nulo e negativo', () => {
            expect(validarLinhasLiquidacao([{ movimentoCcId: 1, valorPago: 100000, desconto: 14000.01 }], movs, ctx)['linhas.0.valorPago']).toMatch(/excede/);
            expect(validarLinhasLiquidacao([{ movimentoCcId: 1, valorPago: 0 }], movs, ctx)['linhas.0.valorPago']).toMatch(/Indique/);
            expect(validarLinhasLiquidacao([{ movimentoCcId: 1, valorPago: -5 }], movs, ctx)['linhas.0.valorPago']).toMatch(/Indique/);
        });

        it('recusa pendente inexistente, de outro cliente, de outro estado, a crédito ou repetido', () => {
            const e = validarLinhasLiquidacao([
                { movimentoCcId: 99, valorPago: 1 }, { movimentoCcId: 2, valorPago: 1 }, { movimentoCcId: 3, valorPago: 1 },
                { movimentoCcId: 4, valorPago: 1 }, { movimentoCcId: 1, valorPago: 1 }, { movimentoCcId: 1, valorPago: 1 },
            ], movs, ctx);
            expect(e['linhas.0.movimentoCcId']).toMatch(/não encontrado/);
            expect(e['linhas.1.movimentoCcId']).toMatch(/outro cliente/);
            expect(e['linhas.2.movimentoCcId']).toMatch(/conta corrente\/estado/);
            expect(e['linhas.3.movimentoCcId']).toMatch(/débito/);
            expect(e['linhas.4.movimentoCcId']).toBeUndefined();
            expect(e['linhas.5.movimentoCcId']).toMatch(/repetido/);
        });
    });

    it('valorPorModo soma o valor pago (sem desconto) por modo de pagamento', () => {
        const movs = new Map([[1, mov()], [2, mov({ id: 2, modoPagamentoId: null })], [3, mov({ id: 3 })]]);
        const r = valorPorModo([
            { movimentoCcId: 1, valorPago: 100, desconto: 10 }, { movimentoCcId: 2, valorPago: 50 }, { movimentoCcId: 3, valorPago: 0.1 },
        ], movs);
        expect([...r.entries()]).toEqual([[2, 100.1], [null, 50]]);
    });

    it('diasAtraso conta os dias depois do vencimento', () => {
        expect(diasAtraso('2026-01-01', '2026-01-31')).toBe(30);
        expect(diasAtraso('2026-02-01', '2026-01-31')).toBe(0);
        expect(diasAtraso('2026-01-31', '2026-01-31')).toBe(0);
    });

    it('termoNumeroDocumento: texto livre e, se só dígitos, também o número exacto', () => {
        expect(termoNumeroDocumento(' FT 2026/1 ')).toEqual({ texto: 'FT 2026/1', numero: null });
        expect(termoNumeroDocumento('12')).toEqual({ texto: '12', numero: 12 });
        expect(termoNumeroDocumento('  ')).toBeNull();
        expect(termoNumeroDocumento(undefined)).toBeNull();
    });

    it('saldoCorrido acumula débito − crédito a partir do saldo anterior', () => {
        const l = (debito: number, credito: number) => ({ data: '2026-01-01', documento: 'X', debito, credito, desconto: 0 });
        expect(saldoCorrido([l(114000, 0), l(0, 50000), l(0, 64000)]).map((x) => x.saldo)).toEqual([114000, 64000, 0]);
        expect(saldoCorrido([l(0, 10)], 100)[0].saldo).toBe(90);
    });
});
