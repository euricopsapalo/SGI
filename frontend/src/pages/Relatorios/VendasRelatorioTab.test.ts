import { COLS_VENDAS, linhasVista } from './VendasRelatorioTab';
import type { RelatorioVendas } from '../../services/vendas';

/** #170 — linhas exportáveis de cada vista do relatório de Vendas. */
const acum = { documentos: 2, faturado: 1140, creditos: 114, iva: 126, liquido: 1026 };
const r: RelatorioVendas = {
    periodo: { de: '2026-01-01', ate: '2026-03-31' }, hoje: '2026-03-31', totais: acum,
    porPeriodo: [{ mes: '2026-02', ...acum }],
    iva: [{ codigoIva: null, taxa: 0, incidencia: 50, valor: 0 }],
    porCliente: [{ clienteId: 1, nome: 'Alfa', nif: '500', ...acum }],
    porOt: [{ otId: 9, otNumero: 'OT-000009', clienteNome: 'Alfa', numeros: ['FT 2026/1', 'NC 2026/1'], ...acum }],
    contasReceber: { linhas: [], totais: { documentos: 0, naoVencido: 0, ate30: 0, ate60: 0, ate90: 0, mais90: 0, saldoFavor: 0, total: 0 } },
};

describe('linhasVista', () => {
    it('sem dados → vazio', () => {
        expect(linhasVista(null, 'periodo')).toEqual([]);
    });

    it('formata o mês, o código de IVA em falta e a lista de documentos da OT', () => {
        expect(linhasVista(r, 'periodo')[0].mesLabel).toBe('Fev 2026');
        expect(linhasVista(r, 'iva')[0].codigoIva).toBe('—');
        expect(linhasVista(r, 'ots')[0].documentosLabel).toBe('FT 2026/1, NC 2026/1');
        expect(linhasVista(r, 'receber')).toEqual([]);
    });

    it('todas as colunas de exportação existem nas linhas', () => {
        (['periodo', 'iva', 'clientes', 'ots'] as const).forEach((v) => {
            const linha = linhasVista(r, v)[0];
            COLS_VENDAS[v].forEach((c) => expect(linha).toHaveProperty(c.key));
        });
    });
});
