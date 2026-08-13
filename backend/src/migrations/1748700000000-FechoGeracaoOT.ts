import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RF-OT-006 (#59) — Fecho, assinatura e geração automática periódica.
 *
 * Acrescenta em `ordens_trabalho`:
 *  - `assinatura_ref`  (referência opcional ao comprovativo de assinatura)
 *  - `gerada_de_ot_id` (FK self — cadeia periódica; ON DELETE SET NULL)
 *
 * `data_fim` e `assinada_cliente` já existem (RF-OT-001/003) — não são tocados.
 */
export class FechoGeracaoOT1748700000000 implements MigrationInterface {
  name = 'FechoGeracaoOT1748700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ordens_trabalho
        ADD COLUMN IF NOT EXISTS assinatura_ref  VARCHAR(255),
        ADD COLUMN IF NOT EXISTS gerada_de_ot_id INTEGER;
    `);

    await queryRunner.query(`
      ALTER TABLE ordens_trabalho
        DROP CONSTRAINT IF EXISTS fk_ot_gerada_de,
        ADD CONSTRAINT fk_ot_gerada_de
          FOREIGN KEY (gerada_de_ot_id) REFERENCES ordens_trabalho(id) ON DELETE SET NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ot_gerada_de ON ordens_trabalho(gerada_de_ot_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ot_gerada_de;`);
    await queryRunner.query(`
      ALTER TABLE ordens_trabalho
        DROP CONSTRAINT IF EXISTS fk_ot_gerada_de,
        DROP COLUMN IF EXISTS gerada_de_ot_id,
        DROP COLUMN IF EXISTS assinatura_ref;
    `);
  }
}
