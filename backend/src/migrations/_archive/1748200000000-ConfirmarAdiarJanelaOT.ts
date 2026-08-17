import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RF-OT-003 (#56) — Programação: ciclo confirmar/adiar + janela de 6 meses.
 *
 * - Adiciona em `ordens_trabalho`:
 *     - `data_agendada`    (data programada actual)
 *     - `data_execucao`    (data definida ao confirmar)
 *     - `adiamentos`       (contador)
 *     - `janela_fim`       (limite superior da janela; default data_registo + 6m)
 *     - `aprovado_por_id`  (FK users — quem aprovou o adiamento acima do limite)
 * - Adiciona em `configuracao_empresa`:
 *     - `limite_adiamentos` (default 3) — RD-2 do RF-OT-003.
 * - Backfill: `data_agendada ← data_prog_inicio`; `janela_fim ← data_registo + 6m`.
 */
export class ConfirmarAdiarJanelaOT1748200000000 implements MigrationInterface {
  name = 'ConfirmarAdiarJanelaOT1748200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ordens_trabalho
        ADD COLUMN IF NOT EXISTS data_agendada    DATE,
        ADD COLUMN IF NOT EXISTS data_execucao    DATE,
        ADD COLUMN IF NOT EXISTS adiamentos       INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS janela_fim       DATE,
        ADD COLUMN IF NOT EXISTS aprovado_por_id  INTEGER;
    `);

    await queryRunner.query(`
      ALTER TABLE ordens_trabalho
        DROP CONSTRAINT IF EXISTS fk_ot_aprovado_por,
        ADD CONSTRAINT fk_ot_aprovado_por
          FOREIGN KEY (aprovado_por_id) REFERENCES users(id) ON DELETE SET NULL;
    `);

    // Backfill data_agendada e janela_fim para histórico
    await queryRunner.query(`
      UPDATE ordens_trabalho
        SET data_agendada = COALESCE(data_agendada, data_prog_inicio),
            janela_fim    = COALESCE(
              janela_fim,
              (COALESCE(data_registo, CURRENT_DATE) + INTERVAL '6 months')::date
            );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ot_data_agendada ON ordens_trabalho(data_agendada);
      CREATE INDEX IF NOT EXISTS idx_ot_janela_fim    ON ordens_trabalho(janela_fim);
      CREATE INDEX IF NOT EXISTS idx_ot_aprovado_por  ON ordens_trabalho(aprovado_por_id);
    `);

    // configuracao_empresa.limite_adiamentos
    await queryRunner.query(`
      ALTER TABLE configuracao_empresa
        ADD COLUMN IF NOT EXISTS limite_adiamentos INTEGER NOT NULL DEFAULT 3;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE configuracao_empresa
        DROP COLUMN IF EXISTS limite_adiamentos;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_ot_aprovado_por;
      DROP INDEX IF EXISTS idx_ot_janela_fim;
      DROP INDEX IF EXISTS idx_ot_data_agendada;
    `);
    await queryRunner.query(`
      ALTER TABLE ordens_trabalho
        DROP CONSTRAINT IF EXISTS fk_ot_aprovado_por,
        DROP COLUMN IF EXISTS aprovado_por_id,
        DROP COLUMN IF EXISTS janela_fim,
        DROP COLUMN IF EXISTS adiamentos,
        DROP COLUMN IF EXISTS data_execucao,
        DROP COLUMN IF EXISTS data_agendada;
    `);
  }
}
