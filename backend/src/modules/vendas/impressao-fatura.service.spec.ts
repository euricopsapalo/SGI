import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { extrasEmpresa, ImpressaoFaturaService, registarImpressao, resumoImpostos, viaDe } from './impressao-fatura.service';

/** #178 — dados de impressão da Fatura (o e2e contra BD real valida o SQL). */
describe('ImpressaoFaturaService', () => {
    it('resumoImpostos agrupa por código/taxa, aplica o desconto global e traz o motivo de isenção a 0 %', () => {
        const motivos = new Map([['90', 'Transmissão não sujeita'], ['2', null]]);
        const r = resumoImpostos([
            { codigoIva: '90', taxaIva: 0, totalLiquido: 70000 },
            { codigoIva: '2', taxaIva: 14, totalLiquido: 1000 },
            { codigoIva: '2', taxaIva: 14, totalLiquido: 1000 },
            { codigoIva: null, taxaIva: 0, totalLiquido: 50 },
        ], 10, motivos);
        expect(r).toEqual([
            { codigoIva: '2', taxa: 14, incidencia: 1800, valor: 252, motivoIsencao: null },
            { codigoIva: '90', taxa: 0, incidencia: 63000, valor: 0, motivoIsencao: 'Transmissão não sujeita' },
            { codigoIva: null, taxa: 0, incidencia: 45, valor: 0, motivoIsencao: null },
        ]);
    });

    it('viaDe: 1.ª impressão Original, seguintes Segunda via', () => {
        expect(viaDe(0)).toBe('Original');
        expect(viaDe(3)).toBe('Segunda via');
    });

    it('registarImpressao aceita o formato [linhas, contagem] do UPDATE … RETURNING', async () => {
        expect(await registarImpressao({ query: jest.fn(async () => [[{ impressoes: 1 }], 1]) }, 'documentos_venda', 1)).toBe(0);
        expect(await registarImpressao({ query: jest.fn(async () => [{ impressoes: 3 }]) }, 'liquidacoes', 1)).toBe(2);
    });

    it('extrasEmpresa junta o IBAN da empresa e as contas DO sem repetir', async () => {
        const db = { query: jest.fn()
            .mockResolvedValueOnce([{ logoUrl: 'L', rodapeDocumentos: 'R', iban: 'AO1', banco: 'BAI' }])
            .mockResolvedValueOnce([{ banco: 'BAI', numero: '1', iban: 'AO1' }, { banco: 'BFA', numero: '2', iban: 'AO2' }]) };
        expect(await extrasEmpresa(db)).toEqual({
            logoUrl: 'L', rodapeDocumentos: 'R',
            coordenadasBancarias: [{ banco: 'BAI', numero: null, iban: 'AO1' }, { banco: 'BFA', numero: '2', iban: 'AO2' }],
        });
    });

    describe('imprimir', () => {
        let doc: any; let ds: any; let svc: ImpressaoFaturaService;
        beforeEach(() => {
            doc = {
                id: 50, estado: 'EMITIDO', clienteId: 3, numero: 1, moeda: 'AOA', descontoGlobal: '0', subtotal: '130000.00', desconto: '0',
                valorIva: '8400.00', total: '138400.00', requisicao: 'R1', referencia: 'OT-1', observacoes: null, dataDisposicao: '2026-01-01',
                dataHora: new Date('2026-01-01T10:00:00Z'), hash: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq=',
                snapshotCliente: { id: 3, nome: 'Cliente gravado', condicaoPagamento: '30 dias' }, snapshotEmpresa: { nome: 'AQUATEX' },
                documentoConfig: { codigo: 'FT', descricao: 'Fatura', tipoFiscal: 'FT' }, serie: { codigo: '2026' },
                ot: { numero: 'OT-1', equipInstalado: { nrSerie: 'SN1' } }, modoPagamento: { descricao: 'Transferência' },
                linhas: [
                    { id: 2, ordem: 2, descricao: 'Filtro', quantidade: '2', precoUnitario: '30000', desconto: '0', codigoIva: null, taxaIva: '14', totalLiquido: '60000', artigo: { codigo: 'F1', unidadeMedida: 'CX' } },
                    { id: 1, ordem: 1, descricao: 'Serviço', quantidade: '1', precoUnitario: '70000', desconto: '0', codigoIva: '90', taxaIva: '0', totalLiquido: '70000', artigo: null },
                ],
            };
            ds = {
                getRepository: jest.fn(() => ({ findOne: jest.fn(async () => doc) })),
                query: jest.fn(async (sql: string) => {
                    if (sql.startsWith('UPDATE')) return [[{ impressoes: 1 }], 1];
                    if (sql.includes('FROM movimentos_cc')) return [{ dataVencimento: '2026-01-31', valorPendente: 138400 }];
                    if (sql.includes('FROM taxas_iva')) return [{ codigo: '90', motivoIsencao: 'Não sujeita' }];
                    if (sql.includes('logo_url')) return [{ logoUrl: null, rodapeDocumentos: null, iban: null, banco: null }];
                    return [];
                }),
            };
            svc = new ImpressaoFaturaService(ds);
        });

        it('monta todos os blocos a partir da cópia gravada', async () => {
            const r: any = await svc.imprimir(50);
            expect(r.via).toBe('Original');
            expect(r.cliente.nome).toBe('Cliente gravado');
            expect(r.empresa).toMatchObject({ nome: 'AQUATEX', logoUrl: null });
            expect(r.documento).toMatchObject({
                numeroDocumento: 'FT 2026/1', data: '2026-01-01', dataVencimento: '2026-01-31', condicaoPagamento: '30 dias',
                requisicao: 'R1', modoPagamento: 'Transferência', otNumero: 'OT-1', nrSerieEquipamento: 'SN1',
            });
            expect(r.linhas.map((l: any) => [l.artigoCodigo, l.unidade, l.valor])).toEqual([[null, 'UN', 70000], ['F1', 'CX', 60000]]);
            expect(r.totais).toEqual({ mercadoriaServicos: 130000, descontosComerciais: 0, valorIva: 8400, total: 138400, retencao: 0, totalAReceber: 138400, valorPendente: 138400 });
            expect(r.impostos[1]).toMatchObject({ codigoIva: '90', motivoIsencao: 'Não sujeita' });
            expect(r.codigoHash).toBe('AKUe');
        });

        it('documentos anteriores ao #178 (sem cópia) usam os dados actuais', async () => {
            doc.snapshotCliente = null; doc.snapshotEmpresa = null; doc.ot = null;
            ds.query.mockImplementation(async (sql: string) => {
                if (sql.startsWith('UPDATE')) return [{ impressoes: 2 }];
                if (sql.includes('FROM clientes')) return [{ id: 3, nome: 'Cliente actual' }];
                if (sql.includes('FROM configuracao_empresa') && !sql.includes('logo_url')) return [];
                return [];
            });
            const r: any = await svc.imprimir(50);
            expect(r.via).toBe('Segunda via');
            expect(r.cliente.nome).toBe('Cliente actual');
            expect(r.empresa.nome).toBeNull();
            expect(r.documento.dataVencimento).toBeNull();
        });

        it('#170 — NC traz o documento estornado e o motivo de cada linha; sem liquidação', async () => {
            doc.documentoConfig = { codigo: 'NC', descricao: 'Nota de Crédito', tipoFiscal: 'NC', liquidacaoAutomatica: false };
            doc.documentoOrigem = { numero: 7, dataHora: new Date('2025-12-20T10:00:00Z'), documentoConfig: { codigo: 'FT' }, serie: { codigo: '2025' } };
            doc.linhas[0].motivoEstorno = { descricao: 'Devolução' };
            const r: any = await svc.imprimir(50);
            expect(r.documento.documentoOrigem).toEqual({ numeroDocumento: 'FT 2025/7', data: '2025-12-20' });
            expect(r.documento.liquidacao).toBeNull();
            expect(r.linhas.map((l: any) => l.motivoEstorno)).toEqual([null, 'Devolução']);
            expect(ds.query.mock.calls.some(([sql]: [string]) => sql.includes('FROM liquidacoes'))).toBe(false);
        });

        it('#170 — FR traz o recibo da liquidação automática e a conta', async () => {
            doc.documentoConfig = { codigo: 'FR', descricao: 'Fatura Recibo', tipoFiscal: 'FR', liquidacaoAutomatica: true };
            const query = ds.query.getMockImplementation();
            ds.query.mockImplementation(async (sql: string, p: any[]) => (sql.includes('FROM liquidacoes')
                ? [{ codigo: 'RE', serie: '2026', numero: 4, conta: 'Caixa Sede' }] : query(sql, p)));
            const r: any = await svc.imprimir(50);
            expect(r.documento.liquidacao).toEqual({ numeroDocumento: 'RE 2026/4', conta: 'Caixa Sede' });
            expect(r.documento.documentoOrigem).toBeNull();
        });

        it('rascunho → 422; inexistente → 404', async () => {
            doc.estado = 'RASCUNHO';
            await expect(svc.imprimir(50)).rejects.toBeInstanceOf(UnprocessableEntityException);
            doc = null;
            await expect(svc.imprimir(50)).rejects.toBeInstanceOf(NotFoundException);
        });
    });
});
