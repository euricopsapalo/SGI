import { resumirDocumentos, faturadoNoMes, recebidoNoMes, somarPor, dataLocal } from './faturacaoResumo';

// #206 — faturação do Dashboard e dos Relatórios a partir dos documentos de venda.
const doc = (over: any) => ({
    id: 1, estado: 'EMITIDO', naturezaDocumento: 'A_RECEBER', total: 100, otId: 10, clienteId: 5,
    dataHora: '2026-10-05T10:00:00', documentoOrigemId: null, estadoFaturacao: 'Pendente',
    ...over,
});

describe('faturacaoResumo (#206)', () => {
    it('ignora rascunhos e dá sinal negativo às NC', () => {
        const r = resumirDocumentos([
            doc({ id: 1, total: 114000 }),
            doc({ id: 2, estado: 'RASCUNHO', total: 999 }),
            doc({ id: 3, naturezaDocumento: 'A_PAGAR', total: 14000, documentoOrigemId: 1, estadoFaturacao: null }),
        ] as any);
        expect(r.map(f => f.valor)).toEqual([114000, -14000]);
        expect(faturadoNoMes(r, '2026-10')).toBe(100000);
        expect(faturadoNoMes(r, '2026-09')).toBe(0);
    });

    it('em aberto = faturas Pendentes ou Parcialmente pagas (não estornos nem pagas)', () => {
        const r = resumirDocumentos([
            doc({ id: 1, estadoFaturacao: 'Pendente' }),
            doc({ id: 2, estadoFaturacao: 'Parcialmente paga' }),
            doc({ id: 3, estadoFaturacao: 'Paga' }),
            doc({ id: 4, estadoFaturacao: 'Estornada' }),
            doc({ id: 5, naturezaDocumento: 'A_PAGAR', documentoOrigemId: 1, estadoFaturacao: null }),
        ] as any);
        expect(r.filter(f => f.emAberto).map(f => f.id)).toEqual([1, 2]);
    });

    it('recebido no mês = Σ liquidações; um estorno (ERE) abate', () => {
        const liqs = [
            { dataHora: '2026-10-02T09:00:00', total: 50000, eEstorno: false },
            { dataHora: '2026-10-20T09:00:00', total: 20000, eEstorno: false },
            { dataHora: '2026-10-21T09:00:00', total: 20000, eEstorno: true },
            { dataHora: '2026-09-30T09:00:00', total: 999, eEstorno: false },
        ];
        expect(recebidoNoMes(liqs as any, '2026-10')).toBe(50000);
    });

    it('soma por OT e por cliente (com as NC a abater)', () => {
        const r = resumirDocumentos([
            doc({ id: 1, otId: 10, clienteId: 5, total: 300 }),
            doc({ id: 2, otId: 11, clienteId: 5, total: 200 }),
            doc({ id: 3, otId: 10, clienteId: 5, total: 50, naturezaDocumento: 'A_PAGAR', documentoOrigemId: 1 }),
        ] as any);
        expect(somarPor(r, f => f.otId).get('10')).toBe(250);
        expect(somarPor(r, f => f.clienteId).get('5')).toBe(450);
    });

    it('dataLocal usa a data local (não a de UTC)', () => {
        const iso = new Date(2026, 9, 1, 0, 30).toISOString(); // 1 out 00:30 local
        expect(dataLocal(iso)).toBe('2026-10-01');
        expect(dataLocal(null)).toBe('');
    });
});
