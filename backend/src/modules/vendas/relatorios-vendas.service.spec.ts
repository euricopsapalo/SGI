import { UnprocessableEntityException } from '@nestjs/common';
import { RelatoriosVendasService } from './relatorios-vendas.service';

/** #170 — relatórios de vendas (o SQL valida-se contra BD real no e2e). */
describe('RelatoriosVendasService', () => {
    let ds: any; let svc: RelatoriosVendasService;
    beforeEach(() => {
        ds = {
            query: jest.fn(async (sql: string) => {
                if (sql.includes('FROM documentos_venda_linhas')) return [{ natureza: 'A_RECEBER', codigoIva: 'NOR', taxaIva: 14, totalLiquido: 100, descontoGlobal: 0 }];
                if (sql.includes('FROM documentos_venda d')) return [{ id: 1, codigo: 'FT', serie: '2026', numero: 3, natureza: 'A_RECEBER', data: '2026-01-10',
                    clienteId: 1, clienteNome: 'Alfa', clienteNif: null, otId: 5, otNumero: 'OT-5', subtotal: 100, desconto: 0, valorIva: 14, total: 114 }];
                if (sql.includes('FROM movimentos_cc')) return [];
                return [];
            }),
        };
        svc = new RelatoriosVendasService(ds);
    });

    it('agrega os documentos do período com a identificação legível', async () => {
        const r = await svc.relatorio({ de: '2026-01-01', ate: '2026-01-31' });
        expect(r.periodo).toEqual({ de: '2026-01-01', ate: '2026-01-31' });
        expect(r.porOt[0]).toMatchObject({ otNumero: 'OT-5', numeros: ['FT 2026/3'], liquido: 114 });
        expect(r.iva).toEqual([{ codigoIva: 'NOR', taxa: 14, incidencia: 100, valor: 14 }]);
        expect(r.contasReceber.linhas).toEqual([]);
        expect(ds.query.mock.calls[0][1]).toEqual(['2026-01-01', '2026-01-31']);
    });

    it('sem datas: do início do ano até hoje', async () => {
        const r = await svc.relatorio();
        expect(r.periodo.de).toBe(`${r.hoje.slice(0, 4)}-01-01`);
        expect(r.periodo.ate).toBe(r.hoje);
    });

    it('datas inválidas ou invertidas → 422', async () => {
        await expect(svc.relatorio({ de: '01/01/2026' })).rejects.toBeInstanceOf(UnprocessableEntityException);
        await expect(svc.relatorio({ de: '2026-02-01', ate: '2026-01-01' })).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
});
