import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * #204 — `stock_armazem` passa a ser a fonte única de verdade do stock e
 * `artigos.existencia` é sempre Σ stock_armazem.quantidade.
 *
 * Migração só de dados (o schema não muda). Até aqui, vários caminhos alteravam
 * `artigos.existencia` sem tocar em `stock_armazem`, por isso há artigos com
 * existência mas sem linhas por armazém. Para cada um:
 * - a diferença positiva (existência − Σ armazéns) é posta no armazém do artigo
 *   (`codigo_armazem`), ou no primeiro armazém ativo se esse código não existir;
 * - depois, `existencia` é recalculada como a soma (também corrige o caso inverso).
 *
 * O `down` não desfaz: as linhas criadas representam stock real que já existia.
 */
export class StockArmazemFonteUnica1792100000000 implements MigrationInterface {
    name = 'StockArmazemFonteUnica1792100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            WITH soma AS (
                SELECT a.id AS artigo_id,
                       a.existencia - COALESCE(SUM(sa.quantidade), 0) AS diferenca,
                       COALESCE(
                           (SELECT ar.id FROM armazens ar WHERE ar.codigo = a.codigo_armazem ORDER BY ar.id LIMIT 1),
                           (SELECT ar.id FROM armazens ar WHERE ar.ativo ORDER BY ar.id LIMIT 1),
                           (SELECT ar.id FROM armazens ar ORDER BY ar.id LIMIT 1)
                       ) AS armazem_id
                FROM artigos a
                LEFT JOIN stock_armazem sa ON sa.artigo_id = a.id
                GROUP BY a.id
            )
            INSERT INTO stock_armazem (artigo_id, armazem_id, quantidade, stock_minimo)
            SELECT artigo_id, armazem_id, diferenca, 0
            FROM soma
            WHERE diferenca > 0 AND armazem_id IS NOT NULL
            ON CONFLICT (artigo_id, armazem_id)
            DO UPDATE SET quantidade = stock_armazem.quantidade + EXCLUDED.quantidade
        `);
        await queryRunner.query(`
            UPDATE artigos a
            SET existencia = s.total
            FROM (
                SELECT a2.id, COALESCE(SUM(sa.quantidade), 0) AS total
                FROM artigos a2
                LEFT JOIN stock_armazem sa ON sa.artigo_id = a2.id
                GROUP BY a2.id
            ) s
            WHERE s.id = a.id AND a.existencia <> s.total
              AND EXISTS (SELECT 1 FROM armazens)
        `);
    }

    public async down(): Promise<void> {
        // Sem reversão: as linhas criadas correspondem a stock que já existia.
    }
}
