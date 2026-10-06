import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * #167 — Gestão de caixa (fase 4 do épico #163):
 * - `sessoes_caixa` (abertura → fecho, sugerido/declarado, teórico/contado, acerto),
 *   com no máximo uma sessão aberta por caixa (índice único parcial);
 * - `movimentos_conta.sessao_caixa_id` e `descricao`; novas origens `SAIDA_CAIXA`
 *   e `ACERTO_CAIXA` (o TypeORM não detecta a mudança do CHECK — acrescentada à mão).
 * Uma caixa marcada como aberta sem sessão (só possível antes desta fase, por SQL)
 * fica fechada: passa a ter de ser aberta pela gestão de caixa.
 * SQL gerado a partir das entities contra BD fresca (`migration:generate`).
 */
export class GestaoCaixa1791322988677 implements MigrationInterface {
    name = 'GestaoCaixa1791322988677'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "movimentos_conta" DROP CONSTRAINT "chk_movimentos_conta_origem"
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_conta"
            ADD CONSTRAINT "chk_movimentos_conta_origem" CHECK ("origem_tipo" IN ('LIQUIDACAO','SAIDA_CAIXA','ACERTO_CAIXA'))
        `);
        await queryRunner.query(`
            UPDATE "contas_bancarias" SET "aberta" = false WHERE "tipo" = 'CAIXA' AND "aberta"
        `);
        await queryRunner.query(`
            CREATE TABLE "sessoes_caixa" (
                "id" SERIAL NOT NULL,
                "conta_bancaria_id" integer NOT NULL,
                "abertura_serie_id" integer NOT NULL,
                "abertura_numero" integer NOT NULL,
                "aberta_em" TIMESTAMP WITH TIME ZONE NOT NULL,
                "aberta_por_id" integer,
                "valor_sugerido" numeric(14, 2) NOT NULL,
                "valor_declarado" numeric(14, 2) NOT NULL,
                "observacoes_abertura" text,
                "fecho_serie_id" integer,
                "fecho_numero" integer,
                "fechada_em" TIMESTAMP WITH TIME ZONE,
                "fechada_por_id" integer,
                "saldo_teorico" numeric(14, 2),
                "valor_contado" numeric(14, 2),
                "documento_acerto_id" integer,
                "observacoes_fecho" text,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "chk_sessoes_caixa_fecho" CHECK (
                    ("fechada_em" IS NULL) = ("valor_contado" IS NULL)
                ),
                CONSTRAINT "chk_sessoes_caixa_valores" CHECK (
                    "valor_sugerido" >= 0
                    AND "valor_declarado" >= 0
                    AND (
                        "valor_contado" IS NULL
                        OR "valor_contado" >= 0
                    )
                ),
                CONSTRAINT "PK_ca6793bb73e6c4c4d2344f09f21" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_sessoes_caixa_aberta" ON "sessoes_caixa" ("conta_bancaria_id")
            WHERE "fechada_em" IS NULL
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_sessoes_caixa_conta" ON "sessoes_caixa" ("conta_bancaria_id")
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_conta"
            ADD "sessao_caixa_id" integer
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_conta"
            ADD "descricao" character varying(300)
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_movimentos_conta_sessao" ON "movimentos_conta" ("sessao_caixa_id")
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_conta"
            ADD CONSTRAINT "FK_452ce616fc53ec6c34ac42012f6" FOREIGN KEY ("sessao_caixa_id") REFERENCES "sessoes_caixa"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "sessoes_caixa"
            ADD CONSTRAINT "FK_be50348eb7f725d9b20b9c87ae2" FOREIGN KEY ("conta_bancaria_id") REFERENCES "contas_bancarias"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "sessoes_caixa"
            ADD CONSTRAINT "FK_1e432e4491257a4469198c3af18" FOREIGN KEY ("abertura_serie_id") REFERENCES "series"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "sessoes_caixa"
            ADD CONSTRAINT "FK_dc5fef75c6389430090788f81da" FOREIGN KEY ("aberta_por_id") REFERENCES "users"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "sessoes_caixa"
            ADD CONSTRAINT "FK_a2dd702e7f423cf8fab91ae0b3c" FOREIGN KEY ("fecho_serie_id") REFERENCES "series"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "sessoes_caixa"
            ADD CONSTRAINT "FK_82d076d21992bf85efbdfa4e4c6" FOREIGN KEY ("fechada_por_id") REFERENCES "users"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "sessoes_caixa"
            ADD CONSTRAINT "FK_06ff4355446f64aebf40fe9123d" FOREIGN KEY ("documento_acerto_id") REFERENCES "movimentos_conta"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "sessoes_caixa" DROP CONSTRAINT "FK_06ff4355446f64aebf40fe9123d"
        `);
        await queryRunner.query(`
            ALTER TABLE "sessoes_caixa" DROP CONSTRAINT "FK_82d076d21992bf85efbdfa4e4c6"
        `);
        await queryRunner.query(`
            ALTER TABLE "sessoes_caixa" DROP CONSTRAINT "FK_a2dd702e7f423cf8fab91ae0b3c"
        `);
        await queryRunner.query(`
            ALTER TABLE "sessoes_caixa" DROP CONSTRAINT "FK_dc5fef75c6389430090788f81da"
        `);
        await queryRunner.query(`
            ALTER TABLE "sessoes_caixa" DROP CONSTRAINT "FK_1e432e4491257a4469198c3af18"
        `);
        await queryRunner.query(`
            ALTER TABLE "sessoes_caixa" DROP CONSTRAINT "FK_be50348eb7f725d9b20b9c87ae2"
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_conta" DROP CONSTRAINT "FK_452ce616fc53ec6c34ac42012f6"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_movimentos_conta_sessao"
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_conta" DROP COLUMN "descricao"
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_conta" DROP COLUMN "sessao_caixa_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_sessoes_caixa_conta"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."uq_sessoes_caixa_aberta"
        `);
        await queryRunner.query(`
            DROP TABLE "sessoes_caixa"
        `);
        await queryRunner.query(`
            DELETE FROM "movimentos_conta" WHERE "origem_tipo" <> 'LIQUIDACAO'
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_conta" DROP CONSTRAINT "chk_movimentos_conta_origem"
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_conta"
            ADD CONSTRAINT "chk_movimentos_conta_origem" CHECK ("origem_tipo" IN ('LIQUIDACAO'))
        `);
    }

}
