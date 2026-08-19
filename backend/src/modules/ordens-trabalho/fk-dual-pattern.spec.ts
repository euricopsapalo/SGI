import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { OrdemTrabalho } from './ordem-trabalho.entity';
import { OtArtigo } from './ot-artigo.entity';
import { EncomendaLinha } from '../encomendas/encomenda-linha.entity';
import { PlanoArtigo } from '../planos/plano-artigo.entity';
import { PlanoMaoObra } from '../planos/plano-mao-obra.entity';
import { PlanoManutencao } from '../planos/plano-manutencao.entity';
import { Tecnico } from '../tecnicos/tecnico.entity';
import { Cliente } from '../clientes/cliente.entity';
import { Fornecedor } from '../fornecedores/fornecedor.entity';
import { FaturaFornecedor } from '../faturas-fornecedor/fatura-fornecedor.entity';
import { Fatura } from '../faturas/fatura.entity';

/**
 * #36 — FKs raw → @ManyToOne (padrão dual).
 * Garante que cada FK convertida expõe a **relação** `@ManyToOne` E mantém a
 * **coluna escalar** `xxxId` (compatibilidade de shape com o frontend/DTOs).
 */
describe('FK dual pattern (@ManyToOne + escalar) — #36', () => {
    const storage = getMetadataArgsStorage();
    const relations = (t: any) => storage.filterRelations(t).map((r) => r.propertyName);
    const columns = (t: any) => storage.filterColumns(t).map((c) => c.propertyName);

    const expectDual = (entity: any, relacao: string, escalar: string) => {
        expect(relations(entity)).toContain(relacao);
        expect(columns(entity)).toContain(escalar);
    };

    it('OrdemTrabalho: equipInstalado/plano com escalares preservados', () => {
        expectDual(OrdemTrabalho, 'equipInstalado', 'equipInstaladoId');
        expectDual(OrdemTrabalho, 'plano', 'planoId');
    });

    it('OtArtigo / EncomendaLinha / PlanoArtigo: relação artigo + escalar artigoId', () => {
        expectDual(OtArtigo, 'artigo', 'artigoId');
        expectDual(EncomendaLinha, 'artigo', 'artigoId');
        expectDual(PlanoArtigo, 'artigo', 'artigoId');
    });

    it('PlanoManutencao: tipoTrabalho + escalar tipoTrabalhoId', () => {
        expectDual(PlanoManutencao, 'tipoTrabalho', 'tipoTrabalhoId');
    });

    it('PlanoMaoObra / Tecnico: funcao + escalar funcaoId', () => {
        expectDual(PlanoMaoObra, 'funcao', 'funcaoId');
        expectDual(Tecnico, 'funcao', 'funcaoId');
    });

    it('cada relação convertida usa o ON DELETE do init.sql', () => {
        const rel = (t: any, name: string) =>
            storage.filterRelations(t).find((r) => r.propertyName === name);
        expect(rel(OrdemTrabalho, 'equipInstalado')?.options.onDelete).toBe('SET NULL');
        expect(rel(OrdemTrabalho, 'plano')?.options.onDelete).toBe('SET NULL');
        expect(rel(OtArtigo, 'artigo')?.options.onDelete).toBe('SET NULL');
        expect(rel(PlanoArtigo, 'artigo')?.options.onDelete).toBe('RESTRICT');
        expect(rel(EncomendaLinha, 'artigo')?.options.onDelete).toBe('SET NULL');
    });

    // Follow-up #36: FKs de lookup sem FK no init.sql (municipio/pagamento/fatura.ot_id).
    // Relações aditivas — ON DELETE SET NULL (escalares nullable, lookups não críticos).
    it('Cliente / FaturaFornecedor: condição + modo de pagamento (dual)', () => {
        expectDual(Cliente, 'condicaoPagamento', 'condicaoPagamentoId');
        expectDual(Cliente, 'modoPagamento', 'modoPagamentoId');
        expectDual(FaturaFornecedor, 'condicaoPagamento', 'condicaoPagamentoId');
        expectDual(FaturaFornecedor, 'modoPagamento', 'modoPagamentoId');
    });

    it('Fornecedor: geografia + pagamento (dual)', () => {
        expectDual(Fornecedor, 'provincia', 'provinciaId');
        expectDual(Fornecedor, 'municipio', 'municipioId');
        expectDual(Fornecedor, 'condicaoPagamento', 'condicaoPagamentoId');
        expectDual(Fornecedor, 'modoPagamento', 'modoPagamentoId');
    });

    it('Tecnico: geografia (dual)', () => {
        expectDual(Tecnico, 'provincia', 'provinciaId');
        expectDual(Tecnico, 'municipio', 'municipioId');
    });

    it('Fatura: ot + escalar otId (dual)', () => {
        expectDual(Fatura, 'ot', 'otId');
    });

    it('lookups sem FK no init.sql usam ON DELETE SET NULL', () => {
        const rel = (t: any, name: string) =>
            storage.filterRelations(t).find((r) => r.propertyName === name);
        expect(rel(Cliente, 'condicaoPagamento')?.options.onDelete).toBe('SET NULL');
        expect(rel(Fornecedor, 'provincia')?.options.onDelete).toBe('SET NULL');
        expect(rel(Fornecedor, 'municipio')?.options.onDelete).toBe('SET NULL');
        expect(rel(Tecnico, 'municipio')?.options.onDelete).toBe('SET NULL');
        expect(rel(Fatura, 'ot')?.options.onDelete).toBe('SET NULL');
    });
});
