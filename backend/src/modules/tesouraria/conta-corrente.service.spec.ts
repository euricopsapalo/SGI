import { NotFoundException } from '@nestjs/common';
import { ContaCorrenteService } from './conta-corrente.service';

/**
 * #174/#166 — ContaCorrenteService: construção dos filtros de pendentes e
 * extrato com saldo corrido. O e2e contra BD real valida o SQL
 * (test/tesouraria-liquidacoes.e2e.spec.ts).
 */
describe('ContaCorrenteService', () => {
    let ds: any;
    let svc: ContaCorrenteService;

    beforeEach(() => {
        ds = { query: jest.fn() };
        svc = new ContaCorrenteService(ds);
    });

    describe('pendentes', () => {
        beforeEach(() => {
            ds.query
                .mockResolvedValueOnce([{ documentos: 2, valorOriginal: 228000, valorPendente: 178000, vencido: 64000 }])
                .mockResolvedValueOnce([{ movimentoCcId: 1, dataVencimento: '2000-01-01', valorPendente: 64000 }]);
        });

        it('sem filtros: só pendentes > 0, ordem por data do documento, 50 por página', async () => {
            const r = await svc.pendentes();
            const [sqlTot, pTot] = ds.query.mock.calls[0];
            const [sql, p] = ds.query.mock.calls[1];
            expect(sql).toMatch(/WHERE m\.valor_pendente > 0\s/);
            expect(sql).toMatch(/ORDER BY m\.data_documento ASC, m\.id ASC/);
            expect(p).toEqual([50, 0]);
            expect(sqlTot).toMatch(/FILTER \(WHERE m\.data_vencimento < \$1\)/);
            expect(pTot).toHaveLength(1);
            expect(r.totais).toEqual({ documentos: 2, valorOriginal: 228000, valorPendente: 178000, vencido: 64000 });
            expect(r.items[0].diasAtraso).toBeGreaterThan(0);
        });

        it('combina todos os filtros com parâmetros (sem SQL injectado)', async () => {
            await svc.pendentes({
                documento: '12', ot: 'OT-7', clienteId: 3, cliente: "O'Neil", dataTipo: 'vencimento',
                de: '2026-01-01', ate: '2026-01-31', vencidosAte: '2026-02-01', ccTipoId: 1, ccEstadoId: 2,
                ordem: 'valorPendente', direcao: 'desc', pagina: 3, porPagina: 10,
            });
            const [sql, p] = ds.query.mock.calls[1];
            expect(sql).toMatch(/ILIKE \$1 OR d\.numero = \$2/);
            expect(sql).toMatch(/ot\.numero ILIKE \$3/);
            expect(sql).toMatch(/m\.cliente_id = \$4/);
            expect(sql).toMatch(/c\.nome ILIKE \$5 OR c\.nif ILIKE \$5/);
            expect(sql).toMatch(/m\.data_vencimento >= \$6 AND m\.data_vencimento <= \$7/);
            expect(sql).toMatch(/m\.data_vencimento <= \$8/);
            expect(sql).toMatch(/m\.cc_tipo_id = \$9 AND m\.cc_estado_id = \$10/);
            expect(sql).toMatch(/ORDER BY m\.valor_pendente DESC, m\.id DESC/);
            expect(sql).not.toContain("O'Neil");
            expect(p).toEqual(['%12%', 12, '%OT-7%', 3, "%O'Neil%", '2026-01-01', '2026-01-31', '2026-02-01', 1, 2, 10, 20]);
        });

        it('n.º de documento com texto não compara o número; data do documento por omissão', async () => {
            await svc.pendentes({ documento: 'FT 2026/1', de: '2026-01-01' });
            const [sql, p] = ds.query.mock.calls[1];
            expect(sql).not.toMatch(/d\.numero =/);
            expect(sql).toMatch(/m\.data_documento >= \$2/);
            expect(p.slice(0, 2)).toEqual(['%FT 2026/1%', '2026-01-01']);
        });
    });

    describe('extrato', () => {
        it('junta documentos e liquidações por data, com saldo corrido, totais e saldo final', async () => {
            ds.query
                .mockResolvedValueOnce([{ id: 3, nome: 'C', nif: '1' }])
                .mockResolvedValueOnce([{ tipo: 'DOCUMENTO', id: 1, data: '2026-01-01', ts: '2026-01-01T10:00:00Z', debito: 114000, credito: 0, desconto: 0 }])
                .mockResolvedValueOnce([
                    { tipo: 'LIQUIDACAO', id: 2, data: '2026-02-01', ts: '2026-02-01T10:00:00Z', debito: 0, credito: 64000, desconto: 0 },
                    { tipo: 'LIQUIDACAO', id: 1, data: '2026-01-15', ts: '2026-01-15T10:00:00Z', debito: 0, credito: 50000, desconto: 0 },
                ]);
            const r = await svc.extrato({ clienteId: 3 });
            expect(r.linhas.map((l: any) => [l.tipo, l.id, l.saldo])).toEqual([['DOCUMENTO', 1, 114000], ['LIQUIDACAO', 1, 64000], ['LIQUIDACAO', 2, 0]]);
            expect(r.linhas[0]).not.toHaveProperty('ts');
            expect(r).toMatchObject({ saldoAnterior: 0, saldoFinal: 0, totais: { debito: 114000, credito: 114000, desconto: 0 } });
        });

        it('com período: saldo anterior e só as linhas do intervalo; sem linhas → saldo final = anterior', async () => {
            const docs = [{ tipo: 'DOCUMENTO', id: 1, data: '2026-01-01', ts: '2026-01-01', debito: 100, credito: 0, desconto: 0 }];
            ds.query.mockResolvedValueOnce([{ id: 3 }]).mockResolvedValueOnce(docs).mockResolvedValueOnce([]);
            const r = await svc.extrato({ clienteId: 3, de: '2026-02-01', ate: '2026-02-28' });
            expect(r).toMatchObject({ saldoAnterior: 100, saldoFinal: 100, linhas: [] });
        });

        it('cliente inexistente → 404', async () => {
            ds.query.mockResolvedValueOnce([]);
            await expect(svc.extrato({ clienteId: 9 })).rejects.toBeInstanceOf(NotFoundException);
        });
    });
});
