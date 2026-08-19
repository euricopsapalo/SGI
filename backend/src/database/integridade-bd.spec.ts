import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { Artigo } from '../modules/artigos/artigo.entity';
import { MovimentoStock } from '../modules/artigos/movimento-stock.entity';
import { StockArmazem } from '../modules/artigos/stock-armazem.entity';
import { EncomendaLinha } from '../modules/encomendas/encomenda-linha.entity';
import { Encomenda } from '../modules/encomendas/encomenda.entity';
import { Fatura } from '../modules/faturas/fatura.entity';
import { FaturaLinha } from '../modules/faturas/fatura-linha.entity';
import { SysLog } from '../modules/sys-logs/sys-log.entity';
import { OrdemTrabalho } from '../modules/ordens-trabalho/ordem-trabalho.entity';
import { OtArtigo } from '../modules/ordens-trabalho/ot-artigo.entity';
import { OtMaoObra } from '../modules/ordens-trabalho/ot-mao-obra.entity';
import { LinhaFaturaFornecedor } from '../modules/faturas-fornecedor/linha-fatura-fornecedor.entity';

/**
 * #35 — CHECK constraints, FKs em falta, índices e timestamps.
 * Valida as declarações ao nível dos metadados TypeORM (sem BD): garante que
 * as constraints/índices/relações/colunas de auditoria estão presentes nas
 * entities — com `synchronize:true` estas declarações traduzem-se em DDL real.
 */
describe('Integridade de BD (#35)', () => {
    const storage = getMetadataArgsStorage();
    const checkExprs = (t: any) => storage.filterChecks(t).map((c) => c.expression);
    const checkNames = (t: any) => storage.filterChecks(t).map((c) => c.name);
    const indexNames = (t: any) => storage.filterIndices(t).map((i) => i.name);
    const columnModes = (t: any) => storage.filterColumns(t).map((c) => c.mode);
    const relation = (t: any, name: string) =>
        storage.filterRelations(t).find((r) => r.propertyName === name);
    const columns = (t: any) => storage.filterColumns(t).map((c) => c.propertyName);

    describe('CHECK constraints', () => {
        it('artigos: stock/reservado/encomendado não-negativos', () => {
            expect(checkNames(Artigo)).toContain('chk_artigos_stock_nn');
            expect(checkExprs(Artigo).join(' ')).toMatch(/"existencia" >= 0/);
        });
        it('encomenda_linhas: recebido nunca excede o encomendado', () => {
            expect(checkNames(EncomendaLinha)).toContain('chk_enc_linha_qtds');
            expect(checkExprs(EncomendaLinha).join(' ')).toMatch(/"qtd_recebida" <= "qtd_encomendada"/);
        });
        it('stock_armazem: quantidade não-negativa', () => {
            expect(checkNames(StockArmazem)).toContain('chk_stock_armazem_qtd_nn');
        });
        it('faturas: totais não-negativos', () => {
            expect(checkNames(Fatura)).toContain('chk_faturas_totais_nn');
        });
    });

    describe('CHECK de estados válidos', () => {
        it('ordens_trabalho: estado ∈ ciclo de vida', () => {
            expect(checkNames(OrdemTrabalho)).toContain('chk_ot_estado');
            expect(checkExprs(OrdemTrabalho).join(' ')).toMatch(/"estado" IN \('Registada'/);
        });
        it('faturas: estado ∈ conjunto válido', () => {
            expect(checkNames(Fatura)).toContain('chk_faturas_estado');
            expect(checkExprs(Fatura).join(' ')).toMatch(/"estado" IN \('Pendente'/);
        });
    });

    describe('Índices em colunas críticas', () => {
        it('movimentos_stock.artigo_id', () => {
            expect(indexNames(MovimentoStock)).toContain('idx_mov_stock_artigo');
        });
        it('encomendas.fornecedor_id', () => {
            expect(indexNames(Encomenda)).toContain('idx_encomendas_fornecedor');
        });
        it('faturas.ot_id', () => {
            expect(indexNames(Fatura)).toContain('idx_faturas_ot');
        });
        it('sys_logs.timestamp', () => {
            expect(indexNames(SysLog)).toContain('idx_sys_logs_timestamp');
        });
    });

    describe('FKs em falta — linhas_fatura_fornecedor (padrão dual)', () => {
        it('produto: relação SET NULL + escalar produtoId', () => {
            expect(columns(LinhaFaturaFornecedor)).toContain('produtoId');
            expect(relation(LinhaFaturaFornecedor, 'produto')?.options.onDelete).toBe('SET NULL');
        });
        it('linhaEncomenda: relação SET NULL + escalar idLinhaEncomenda', () => {
            expect(columns(LinhaFaturaFornecedor)).toContain('idLinhaEncomenda');
            expect(relation(LinhaFaturaFornecedor, 'linhaEncomenda')?.options.onDelete).toBe('SET NULL');
        });
    });

    describe('FKs em falta — ot_maos_obra', () => {
        it('ordemTrabalho: relação CASCADE + índice na FK', () => {
            expect(relation(OtMaoObra, 'ordemTrabalho')?.options.onDelete).toBe('CASCADE');
            expect(indexNames(OtMaoObra)).toContain('idx_ot_maos_obra_ot');
        });
    });

    describe('Timestamps created_at/updated_at nas tabelas transacionais', () => {
        const comAuditoria = [
            ['Artigo', Artigo], ['StockArmazem', StockArmazem], ['EncomendaLinha', EncomendaLinha],
            ['OtArtigo', OtArtigo], ['OtMaoObra', OtMaoObra], ['Fatura', Fatura],
            ['FaturaLinha', FaturaLinha], ['LinhaFaturaFornecedor', LinhaFaturaFornecedor],
        ] as const;
        it.each(comAuditoria)('%s tem createDate + updateDate', (_nome, ent) => {
            const modos = columnModes(ent);
            expect(modos).toContain('createDate');
            expect(modos).toContain('updateDate');
        });
    });
});
