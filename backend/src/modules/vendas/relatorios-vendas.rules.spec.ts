import {
    contasReceber, diasAtraso, DocRelatorio, escalao, ivaPorTaxa, porCliente, porOt, porPeriodo, sinal, totaisPeriodo,
} from './relatorios-vendas.rules';

/** #170 — agregações dos relatórios de vendas. */
const doc = (p: Partial<DocRelatorio>): DocRelatorio => ({
    id: 1, numeroDocumento: 'FT 2026/1', codigo: 'FT', natureza: 'A_RECEBER', data: '2026-01-10',
    clienteId: 1, clienteNome: 'Alfa', clienteNif: '500', otId: 10, otNumero: 'OT-000010',
    subtotal: 1000, desconto: 0, valorIva: 140, total: 1140, ...p,
});

describe('relatorios-vendas.rules', () => {
    const docs = [
        doc({}),
        doc({ id: 2, numeroDocumento: 'FR 2026/1', codigo: 'FR', data: '2026-02-03', clienteId: 2, clienteNome: 'Beta', otId: 11, otNumero: 'OT-000011', valorIva: 0, total: 500 }),
        doc({ id: 3, numeroDocumento: 'NC 2026/1', codigo: 'NC', natureza: 'A_PAGAR', data: '2026-02-20', valorIva: 14, total: 114 }),
    ];

    it('sinal: NC abate, restantes somam', () => {
        expect(sinal('A_PAGAR')).toBe(-1);
        expect(sinal('A_RECEBER')).toBe(1);
        expect(sinal(null)).toBe(1);
    });

    it('porPeriodo agrupa por mês e separa faturado de créditos', () => {
        expect(porPeriodo(docs)).toEqual([
            { mes: '2026-01', documentos: 1, faturado: 1140, creditos: 0, iva: 140, liquido: 1140 },
            { mes: '2026-02', documentos: 2, faturado: 500, creditos: 114, iva: -14, liquido: 386 },
        ]);
    });

    it('porCliente ordena pelo líquido', () => {
        expect(porCliente(docs).map((c) => [c.nome, c.documentos, c.liquido])).toEqual([['Alfa', 2, 1026], ['Beta', 1, 500]]);
    });

    it('porOt junta os documentos de cada OT', () => {
        expect(porOt(docs)).toEqual([
            expect.objectContaining({ otNumero: 'OT-000011', numeros: ['FR 2026/1'], liquido: 500 }),
            expect.objectContaining({ otNumero: 'OT-000010', numeros: ['FT 2026/1', 'NC 2026/1'], faturado: 1140, creditos: 114, liquido: 1026 }),
        ]);
    });

    it('totaisPeriodo soma tudo', () => {
        expect(totaisPeriodo(docs)).toEqual({ documentos: 3, faturado: 1640, creditos: 114, iva: 126, liquido: 1526 });
    });

    it('ivaPorTaxa aplica o desconto global e abate as NC', () => {
        expect(ivaPorTaxa([
            { natureza: 'A_RECEBER', codigoIva: 'NOR', taxaIva: 14, totalLiquido: 1000, descontoGlobal: 10 },
            { natureza: 'A_PAGAR', codigoIva: 'NOR', taxaIva: 14, totalLiquido: 100, descontoGlobal: 0 },
            { natureza: 'A_RECEBER', codigoIva: 'ISE', taxaIva: 0, totalLiquido: 50, descontoGlobal: 0 },
        ])).toEqual([
            { codigoIva: 'NOR', taxa: 14, incidencia: 800, valor: 112 },
            { codigoIva: 'ISE', taxa: 0, incidencia: 50, valor: 0 },
        ]);
    });

    it('diasAtraso e escalões', () => {
        expect(diasAtraso('2026-01-01', '2026-01-31')).toBe(30);
        expect(diasAtraso('2026-02-01', '2026-01-31')).toBe(-1);
        expect([0, 1, 30, 31, 60, 61, 90, 91].map(escalao))
            .toEqual(['naoVencido', 'ate30', 'ate30', 'ate60', 'ate60', 'ate90', 'ate90', 'mais90']);
    });

    it('contasReceber distribui por antiguidade e abate o saldo a favor', () => {
        const r = contasReceber([
            { clienteId: 1, clienteNome: 'Alfa', clienteNif: '500', natureza: 'D', dataVencimento: '2026-03-10', valorPendente: 100 },
            { clienteId: 1, clienteNome: 'Alfa', clienteNif: '500', natureza: 'D', dataVencimento: '2025-11-01', valorPendente: 200 },
            { clienteId: 1, clienteNome: 'Alfa', clienteNif: '500', natureza: 'C', dataVencimento: '2026-01-01', valorPendente: 50 },
            { clienteId: 2, clienteNome: 'Beta', clienteNif: null, natureza: 'D', dataVencimento: '2026-02-20', valorPendente: 40 },
            { clienteId: 3, clienteNome: 'Gama', clienteNif: null, natureza: 'D', dataVencimento: '2026-01-01', valorPendente: 0 },
        ], '2026-03-01');
        expect(r.linhas).toEqual([
            { clienteId: 1, nome: 'Alfa', nif: '500', documentos: 3, naoVencido: 100, ate30: 0, ate60: 0, ate90: 0, mais90: 200, saldoFavor: 50, total: 250 },
            { clienteId: 2, nome: 'Beta', nif: null, documentos: 1, naoVencido: 0, ate30: 40, ate60: 0, ate90: 0, mais90: 0, saldoFavor: 0, total: 40 },
        ]);
        expect(r.totais).toEqual({ documentos: 4, naoVencido: 100, ate30: 40, ate60: 0, ate90: 0, mais90: 200, saldoFavor: 50, total: 290 });
    });
});
