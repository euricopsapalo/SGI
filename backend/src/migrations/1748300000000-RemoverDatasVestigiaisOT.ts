import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #74 — Remover colunas de data vestigiais de `ordens_trabalho`:
 *   - `data_prog_inicio`  → substituída por `data_agendada` (RF-OT-003)
 *   - `data_emissao`      → resquício do fluxo legado *emitir* (410 Gone); `data_inicio` cobre o início
 *   - `data_encerramento` → resquício do fluxo legado *encerrar* (410 Gone); `data_fim` cobre o fecho
 *
 * `up`: garante o backfill `data_agendada ← data_prog_inicio` (idempotente com a
 *       migração RF-OT-003) antes de dropar. O índice `idx_ordens_trabalho_prog`
 *       (sobre data_prog_inicio) é removido automaticamente com a coluna;
 *       `idx_ot_data_agendada` já cobre a nova coluna.
 */
export class RemoverDatasVestigiaisOT1748300000000 implements MigrationInterface {
  name = 'RemoverDatasVestigiaisOT1748300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Backfill defensivo: não perder datas de OTs antigas que só tenham data_prog_inicio.
    await queryRunner.query(`
      UPDATE ordens_trabalho
        SET data_agendada = COALESCE(data_agendada, data_prog_inicio);
    `);

    await queryRunner.query(`
      ALTER TABLE ordens_trabalho
        DROP COLUMN IF EXISTS data_prog_inicio,
        DROP COLUMN IF EXISTS data_emissao,
        DROP COLUMN IF EXISTS data_encerramento;
    `);

    // Recria o índice de programação sobre a coluna canónica (idempotente).
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ordens_trabalho_prog ON ordens_trabalho(data_agendada);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ordens_trabalho
        ADD COLUMN IF NOT EXISTS data_prog_inicio   DATE,
        ADD COLUMN IF NOT EXISTS data_emissao       DATE,
        ADD COLUMN IF NOT EXISTS data_encerramento  DATE;
    `);

    // Restaura data_prog_inicio a partir de data_agendada (melhor esforço).
    await queryRunner.query(`
      UPDATE ordens_trabalho
        SET data_prog_inicio = data_agendada;
    `);
  }
}
