import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * #257 — As OTs periódicas geradas ao finalizar a anterior ficavam sem `numero`
 * (e sem `janela_fim`/`registado_por_id`). Só dados, sem alteração de schema:
 * - `numero` = OT-NNNNNN a partir do id, onde faltar (sem colidir com um existente);
 * - nas geradas: `janela_fim` = data agendada + 6 meses; registador herdado da
 *   origem e `data_registo` = data de fim da origem (quando foi gerada).
 */
export class NumeroOtsPeriodicasGeradas1792300000000 implements MigrationInterface {
    name = 'NumeroOtsPeriodicasGeradas1792300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "ordens_trabalho" o
            SET "numero" = 'OT-' || lpad(o."id"::text, 6, '0')
            WHERE o."numero" IS NULL
              AND NOT EXISTS (
                    SELECT 1 FROM "ordens_trabalho" x
                    WHERE x."numero" = 'OT-' || lpad(o."id"::text, 6, '0')
                )
        `);
        await queryRunner.query(`
            UPDATE "ordens_trabalho"
            SET "janela_fim" = ("data_agendada" + interval '6 months')::date
            WHERE "gerada_de_ot_id" IS NOT NULL
              AND "janela_fim" IS NULL
              AND "data_agendada" IS NOT NULL
        `);
        await queryRunner.query(`
            UPDATE "ordens_trabalho" o
            SET "registado_por_id" = COALESCE(o."registado_por_id", origem."registado_por_id"),
                "data_registo" = COALESCE(o."data_registo", origem."data_fim")
            FROM "ordens_trabalho" origem
            WHERE o."gerada_de_ot_id" = origem."id"
              AND (o."registado_por_id" IS NULL OR o."data_registo" IS NULL)
        `);
    }

    public async down(): Promise<void> {
        // Correção de dados: nada a reverter.
    }

}
