import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RF-OT-002 (#55) — Registo da OT e formulário de marcação.
 *
 * - Adiciona campos `numero`, `natureza_intervencao`, `prioridade`,
 *   `data_registo`, `registado_por_id` (FK users), `executado_por_id`
 *   (FK tecnicos).
 * - Backfill: gera `numero` (OT-NNNNNN) a partir do id; `data_registo`
 *   = COALESCE(data_prog_inicio, CURRENT_DATE) para histórico.
 * - Índices e UNIQUE em `numero`.
 *
 * Decisão (#65 PR #66): `registado_por_id` é FK para **users**, não
 * `tecnicos`, porque coordenadores criam OTs e não têm linha em tecnicos.
 */
export class RegistoMarcacaoOT1748100000000 implements MigrationInterface {
  name = 'RegistoMarcacaoOT1748100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ordens_trabalho
        ADD COLUMN IF NOT EXISTS numero               VARCHAR(30),
        ADD COLUMN IF NOT EXISTS natureza_intervencao VARCHAR(40),
        ADD COLUMN IF NOT EXISTS prioridade           VARCHAR(10) NOT NULL DEFAULT 'Normal',
        ADD COLUMN IF NOT EXISTS data_registo         DATE        NOT NULL DEFAULT CURRENT_DATE,
        ADD COLUMN IF NOT EXISTS registado_por_id     INTEGER,
        ADD COLUMN IF NOT EXISTS executado_por_id     INTEGER;
    `);

    // FKs
    await queryRunner.query(`
      ALTER TABLE ordens_trabalho
        DROP CONSTRAINT IF EXISTS fk_ot_registado_por,
        ADD CONSTRAINT fk_ot_registado_por
          FOREIGN KEY (registado_por_id) REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE ordens_trabalho
        DROP CONSTRAINT IF EXISTS fk_ot_executado_por,
        ADD CONSTRAINT fk_ot_executado_por
          FOREIGN KEY (executado_por_id) REFERENCES tecnicos(id) ON DELETE SET NULL;
    `);

    // CHECKs
    await queryRunner.query(`
      ALTER TABLE ordens_trabalho DROP CONSTRAINT IF EXISTS chk_ot_natureza;
      ALTER TABLE ordens_trabalho ADD CONSTRAINT chk_ot_natureza
        CHECK (natureza_intervencao IS NULL OR natureza_intervencao IN
          ('Manutenção','Substituição de filtro','Reparação de avaria','Inspeção'));
      ALTER TABLE ordens_trabalho DROP CONSTRAINT IF EXISTS chk_ot_prioridade;
      ALTER TABLE ordens_trabalho ADD CONSTRAINT chk_ot_prioridade
        CHECK (prioridade IN ('Normal','Alta','Urgente'));
    `);

    // Backfill numero a partir do id (OT-NNNNNN); data_registo a partir do agendamento
    await queryRunner.query(`
      UPDATE ordens_trabalho
         SET numero = 'OT-' || LPAD(id::text, 6, '0')
       WHERE numero IS NULL;
      UPDATE ordens_trabalho
         SET data_registo = COALESCE(data_prog_inicio, CURRENT_DATE)
       WHERE data_registo IS NULL;
    `);

    // Índices + UNIQUE
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_ot_numero       ON ordens_trabalho(numero);
      CREATE INDEX IF NOT EXISTS idx_ot_registado_por      ON ordens_trabalho(registado_por_id);
      CREATE INDEX IF NOT EXISTS idx_ot_executado_por      ON ordens_trabalho(executado_por_id);
      CREATE INDEX IF NOT EXISTS idx_ot_natureza           ON ordens_trabalho(natureza_intervencao);
      CREATE INDEX IF NOT EXISTS idx_ot_prioridade         ON ordens_trabalho(prioridade);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_ot_numero;
      DROP INDEX IF EXISTS idx_ot_registado_por;
      DROP INDEX IF EXISTS idx_ot_executado_por;
      DROP INDEX IF EXISTS idx_ot_natureza;
      DROP INDEX IF EXISTS idx_ot_prioridade;

      ALTER TABLE ordens_trabalho
        DROP CONSTRAINT IF EXISTS fk_ot_registado_por,
        DROP CONSTRAINT IF EXISTS fk_ot_executado_por,
        DROP CONSTRAINT IF EXISTS chk_ot_natureza,
        DROP CONSTRAINT IF EXISTS chk_ot_prioridade;

      ALTER TABLE ordens_trabalho
        DROP COLUMN IF EXISTS numero,
        DROP COLUMN IF EXISTS natureza_intervencao,
        DROP COLUMN IF EXISTS prioridade,
        DROP COLUMN IF EXISTS data_registo,
        DROP COLUMN IF EXISTS registado_por_id,
        DROP COLUMN IF EXISTS executado_por_id;
    `);
  }
}
