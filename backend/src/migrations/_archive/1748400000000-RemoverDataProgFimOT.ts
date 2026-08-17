import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #82 — Remover a coluna de data vestigial `data_prog_fim` de `ordens_trabalho`.
 *
 * Seguimento do #74 (que removeu `data_prog_inicio`/`data_emissao`/`data_encerramento`).
 * Pelo modelo canónico do ciclo de vida (RF-OT-001 / RF-OT-003) uma OT representa
 * uma intervenção única — não um intervalo planeado — pelo que `data_prog_fim` não
 * tem momento de preenchimento no ciclo. A "duração prevista" já está coberta por
 * `previsao_tempo` (horas). As datas canónicas são `data_registo`, `janela_fim`,
 * `data_agendada`, `data_execucao`, `data_inicio` e `data_fim`.
 *
 * `down`: recria a coluna mas **sem backfill recuperável** (os valores anteriores
 *         perdem-se) — restauro de melhor esforço apenas do schema.
 */
export class RemoverDataProgFimOT1748400000000 implements MigrationInterface {
  name = 'RemoverDataProgFimOT1748400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ordens_trabalho
        DROP COLUMN IF EXISTS data_prog_fim;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ordens_trabalho
        ADD COLUMN IF NOT EXISTS data_prog_fim DATE;
    `);
  }
}
