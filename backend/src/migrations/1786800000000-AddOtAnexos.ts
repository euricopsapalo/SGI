import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * #47 — Tabela `ot_anexos`: fotos da intervenção e assinatura digital do cliente
 * associadas a uma OT. FK para `ordens_trabalho` (ON DELETE CASCADE), índice por
 * OT e CHECK no tipo (foto/assinatura). SQL alinhado com o que o TypeORM gera a
 * partir da entidade (verificado com `migration:generate --check`).
 */
export class AddOtAnexos1786800000000 implements MigrationInterface {
    name = 'AddOtAnexos1786800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ot_anexos" ("id" SERIAL NOT NULL, "tipo" character varying(20) NOT NULL, "path" character varying(300) NOT NULL, "nome_original" character varying(255), "mime" character varying(100) NOT NULL, "tamanho" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "ot_id" integer, CONSTRAINT "chk_ot_anexos_tipo" CHECK ("tipo" IN ('foto', 'assinatura')), CONSTRAINT "PK_dbff52b425ba219fdc322074154" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_ot_anexos_ot" ON "ot_anexos" ("ot_id")`);
        await queryRunner.query(`ALTER TABLE "ot_anexos" ADD CONSTRAINT "FK_1679875bab0db0cc36174a84beb" FOREIGN KEY ("ot_id") REFERENCES "ordens_trabalho"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ot_anexos" DROP CONSTRAINT "FK_1679875bab0db0cc36174a84beb"`);
        await queryRunner.query(`DROP INDEX "public"."idx_ot_anexos_ot"`);
        await queryRunner.query(`DROP TABLE "ot_anexos"`);
    }
}
