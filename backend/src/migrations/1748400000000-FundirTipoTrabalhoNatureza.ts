import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * #75 — Funde os campos livres `tipo_trabalho` e `tipo_ot` de `ordens_trabalho`
 * na classificação única `natureza_intervencao`.
 *
 * Decisões (ver issue #75):
 *  - Estende o enum/CHECK de natureza com `Montagem / Instalação` (cobre as OTs
 *    auto-criadas no Parque). `Reparação de avaria` é a corretiva.
 *  - `up`: backfill por palavra-chave de `tipo_trabalho` → `natureza_intervencao`
 *    (apenas quando a natureza está nula), depois dropa `tipo_trabalho` e `tipo_ot`.
 *  - `tipo_ot` era apenas um proxy textual de `tipo` (pontual/periódica), pelo que
 *    não tem mapeamento próprio.
 */
export class FundirTipoTrabalhoNatureza1748400000000 implements MigrationInterface {
  name = 'FundirTipoTrabalhoNatureza1748400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Estender o CHECK da natureza para aceitar 'Montagem / Instalação'.
    await queryRunner.query(`
      ALTER TABLE ordens_trabalho DROP CONSTRAINT IF EXISTS chk_ot_natureza;
      ALTER TABLE ordens_trabalho ADD CONSTRAINT chk_ot_natureza
        CHECK (natureza_intervencao IS NULL OR natureza_intervencao IN
          ('Manutenção','Substituição de filtro','Reparação de avaria','Inspeção','Montagem / Instalação'));
    `);

    // 2. Backfill por palavra-chave (só onde a natureza ainda é nula).
    await queryRunner.query(`
      UPDATE ordens_trabalho SET natureza_intervencao =
        CASE
          WHEN lower(coalesce(tipo_trabalho,'')) LIKE '%corretiv%' THEN 'Reparação de avaria'
          WHEN lower(coalesce(tipo_trabalho,'')) LIKE '%avaria%'   THEN 'Reparação de avaria'
          WHEN lower(coalesce(tipo_trabalho,'')) LIKE '%filtro%'   THEN 'Substituição de filtro'
          WHEN lower(coalesce(tipo_trabalho,'')) LIKE '%inspe%'    THEN 'Inspeção'
          WHEN lower(coalesce(tipo_trabalho,'')) LIKE '%montagem%' THEN 'Montagem / Instalação'
          WHEN lower(coalesce(tipo_trabalho,'')) LIKE '%instala%'  THEN 'Montagem / Instalação'
          WHEN lower(coalesce(tipo_trabalho,'')) LIKE '%preventiv%' THEN 'Manutenção'
          WHEN lower(coalesce(tipo_trabalho,'')) LIKE '%manuten%'   THEN 'Manutenção'
          ELSE 'Manutenção'
        END
      WHERE natureza_intervencao IS NULL AND coalesce(tipo_trabalho,'') <> '';
    `);

    // 3. Dropar as colunas redundantes.
    await queryRunner.query(`
      ALTER TABLE ordens_trabalho
        DROP COLUMN IF EXISTS tipo_trabalho,
        DROP COLUMN IF EXISTS tipo_ot;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ordens_trabalho
        ADD COLUMN IF NOT EXISTS tipo_trabalho VARCHAR(100),
        ADD COLUMN IF NOT EXISTS tipo_ot       VARCHAR(100);
    `);

    // Restaura tipo_trabalho a partir da natureza (melhor esforço).
    await queryRunner.query(`
      UPDATE ordens_trabalho SET tipo_trabalho = natureza_intervencao
      WHERE tipo_trabalho IS NULL AND natureza_intervencao IS NOT NULL;
    `);

    // Reverte o CHECK ao conjunto original (sem 'Montagem / Instalação').
    await queryRunner.query(`
      UPDATE ordens_trabalho SET natureza_intervencao = 'Manutenção'
        WHERE natureza_intervencao = 'Montagem / Instalação';
      ALTER TABLE ordens_trabalho DROP CONSTRAINT IF EXISTS chk_ot_natureza;
      ALTER TABLE ordens_trabalho ADD CONSTRAINT chk_ot_natureza
        CHECK (natureza_intervencao IS NULL OR natureza_intervencao IN
          ('Manutenção','Substituição de filtro','Reparação de avaria','Inspeção'));
    `);
  }
}
