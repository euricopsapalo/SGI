import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RF-OT-004 (#57) — Reserva e validação de stock na confirmação.
 *
 * Estende a Linha de Consumo (`ot_artigos`) para distinguir
 * previsto / reservado / consumido / reposição. A coluna `quantidade`
 * mantém-se (compatibilidade impressão/faturação) e o backfill assume que a
 * quantidade existente é a quantidade prevista.
 *
 * A coluna `artigos.stock_reservado` já existe (init.sql) e passa a ser usada.
 */
export class ReservaStockOT1748600000000 implements MigrationInterface {
  name = 'ReservaStockOT1748600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ot_artigos
        ADD COLUMN IF NOT EXISTS qtd_prevista   NUMERIC(12,3) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS qtd_reservada  NUMERIC(12,3) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS qtd_consumida  NUMERIC(12,3),
        ADD COLUMN IF NOT EXISTS para_reposicao BOOLEAN NOT NULL DEFAULT false;
    `);

    // Backfill: a quantidade existente passa a ser a quantidade prevista.
    await queryRunner.query(`
      UPDATE ot_artigos
        SET qtd_prevista = quantidade
        WHERE qtd_prevista = 0;
    `);

    // Índice para a lista de reposição (?paraReposicao=true).
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ot_artigos_reposicao
        ON ot_artigos(para_reposicao) WHERE para_reposicao = true;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ot_artigos_reposicao;`);
    await queryRunner.query(`
      ALTER TABLE ot_artigos
        DROP COLUMN IF EXISTS para_reposicao,
        DROP COLUMN IF EXISTS qtd_consumida,
        DROP COLUMN IF EXISTS qtd_reservada,
        DROP COLUMN IF EXISTS qtd_prevista;
    `);
  }
}
