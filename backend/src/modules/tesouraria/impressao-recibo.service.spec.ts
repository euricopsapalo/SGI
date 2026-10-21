import { NotFoundException } from '@nestjs/common';
import { ImpressaoReciboService } from './impressao-recibo.service';
import { Liquidacao } from './liquidacao.entity';

/** #178 — dados de impressão do Recibo (o e2e contra BD real valida o SQL). */
describe('ImpressaoReciboService', () => {
    let liq: any; let mcs: any[]; let ds: any; let svc: ImpressaoReciboService;

    beforeEach(() => {
        liq = {
            id: 9, clienteId: 3, numero: 2, total: '78400.00', moeda: 'AOA', observacoes: null, referenciaPagamento: 'TRF-9',
            dataHora: new Date('2026-02-01T10:00:00Z'),
            snapshotCliente: { id: 3, nome: 'Cliente' }, snapshotEmpresa: { nome: 'AQUATEX' },
            documentoConfig: { codigo: 'RE', descricao: 'Recebimento', tipoFiscal: 'RG' }, serie: { codigo: '2026' },
            contaBancaria: { codigo: 'D1', descricao: 'Conta', banco: 'BAI', agencia: null },
            linhas: [{ id: 5, movimentoCcId: 1, valorPago: '78400.00', desconto: '10000.00', pendenteAnterior: '88400.00' }],
        };
        mcs = [{ valor: '78400.00', modoPagamento: { movimento: 'TRF', descricao: 'Transferência' } }];
        ds = {
            getRepository: jest.fn((e: any) => (e === Liquidacao
                ? { findOne: jest.fn(async () => liq) }
                : { find: jest.fn(async () => mcs) })),
            query: jest.fn(async (sql: string) => {
                if (sql.startsWith('UPDATE')) return [[{ impressoes: 1 }], 1];
                if (sql.includes('FROM liquidacoes_linhas ll')) return [{ id: 5, numeroDocumento: 'FT 2026/1', valorDocumento: 138400, prestacao: 2 }];
                if (sql.includes('logo_url')) return [{ logoUrl: 'L' }];
                return [];
            }),
        };
        svc = new ImpressaoReciboService(ds);
    });

    it('meios (um por MC, com a referência), documentos com prestação e o pendente que ficou, e totais', async () => {
        const r: any = await svc.imprimir(9);
        expect(r).toMatchObject({ via: 'Original', total: 78400, cliente: { nome: 'Cliente' }, empresa: { nome: 'AQUATEX', logoUrl: 'L' } });
        expect(r.documento).toMatchObject({ numeroDocumento: 'RE 2026/2', tipoFiscal: 'RG', data: '2026-02-01' });
        expect(r.meios).toEqual([{ movimento: 'TRF', descricao: 'Transferência', numero: 'TRF-9', balcao: 'BAI', valor: 78400 }]);
        expect(r.documentos).toEqual([{ numeroDocumento: 'FT 2026/1', prestacao: 2, valorDocumento: 138400, valorAtribuido: 78400, desconto: 10000, retencao: 0, pendente: 0 }]);
        expect(r.totais).toEqual({ valorDocumento: 138400, valorAtribuido: 78400, desconto: 10000, retencao: 0, pendente: 0 });
    });

    it('#179 — coluna Retenção: o valor do documento é o total e a retenção a do documento', async () => {
        ds.query.mockImplementation(async (sql: string) => {
            if (sql.startsWith('UPDATE')) return [[{ impressoes: 1 }], 1];
            if (sql.includes('FROM liquidacoes_linhas ll')) return [{ id: 5, numeroDocumento: 'FT 2026/1', valorDocumento: 114000, retencao: 3900, prestacao: 1 }];
            return [];
        });
        liq.linhas = [{ id: 5, movimentoCcId: 1, valorPago: '110100.00', desconto: '0', pendenteAnterior: '110100.00' }];
        const r: any = await svc.imprimir(9);
        expect(r.documentos[0]).toMatchObject({ valorDocumento: 114000, retencao: 3900, valorAtribuido: 110100, pendente: 0 });
        expect(r.totais).toMatchObject({ retencao: 3900 });
        const sql = ds.query.mock.calls.map((c: any[]) => c[0]).find((q: string) => q.includes('FROM liquidacoes_linhas ll'));
        expect(sql).toMatch(/COALESCE\(d\.retencao_valor, 0\)/);
    });

    it('sem cópia gravada usa os dados actuais; sem banco usa a descrição da conta; 404', async () => {
        liq.snapshotCliente = null; liq.snapshotEmpresa = null; liq.contaBancaria = { descricao: 'Caixa' };
        mcs = [{ valor: '10', modoPagamento: null }];
        ds.query.mockImplementation(async (sql: string) => {
            if (sql.startsWith('UPDATE')) return [{ impressoes: 2 }];
            if (sql.includes('FROM clientes')) return [{ id: 3, nome: 'Actual' }];
            return [];
        });
        const r: any = await svc.imprimir(9);
        expect(r.via).toBe('Segunda via');
        expect(r.cliente.nome).toBe('Actual');
        expect(r.meios[0]).toMatchObject({ movimento: null, balcao: 'Caixa' });
        expect(r.documentos[0]).toMatchObject({ numeroDocumento: '#1', prestacao: 1 });
        liq = null;
        await expect(svc.imprimir(9)).rejects.toBeInstanceOf(NotFoundException);
    });
});
