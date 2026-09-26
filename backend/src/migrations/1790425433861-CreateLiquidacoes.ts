import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * #166 — Schema da fase 3 do Módulo de Vendas de Intervenções (épico #163):
 * liquidações (`RE`) + linhas (valor pago/desconto por movimento de CC, com o
 * pendente anterior) e movimentos em conta (`MC`), numerados por série.
 * SQL gerado a partir das entities contra BD fresca (`migration:generate`).
 */
export class CreateLiquidacoes1790425433861 implements MigrationInterface {
    name = 'CreateLiquidacoes1790425433861'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "movimentos_conta" (
                "id" SERIAL NOT NULL,
                "documento_config_id" integer NOT NULL,
                "serie_id" integer NOT NULL,
                "numero" integer NOT NULL,
                "data_hora" TIMESTAMP WITH TIME ZONE NOT NULL,
                "conta_bancaria_id" integer NOT NULL,
                "origem_tipo" character varying(30) NOT NULL,
                "origem_id" integer NOT NULL,
                "valor" numeric(14, 2) NOT NULL,
                "modo_pagamento_id" integer,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "uq_movimentos_conta_serie_numero" UNIQUE ("serie_id", "numero"),
                CONSTRAINT "chk_movimentos_conta_valor" CHECK ("valor" <> 0),
                CONSTRAINT "chk_movimentos_conta_origem" CHECK ("origem_tipo" IN ('LIQUIDACAO')),
                CONSTRAINT "PK_c23da58c78c9d224132a8009430" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_movimentos_conta_origem" ON "movimentos_conta" ("origem_tipo", "origem_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_movimentos_conta_conta" ON "movimentos_conta" ("conta_bancaria_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "liquidacoes" (
                "id" SERIAL NOT NULL,
                "documento_config_id" integer NOT NULL,
                "serie_id" integer NOT NULL,
                "numero" integer NOT NULL,
                "data_hora" TIMESTAMP WITH TIME ZONE NOT NULL,
                "cliente_id" integer NOT NULL,
                "conta_bancaria_id" integer NOT NULL,
                "total" numeric(14, 2) NOT NULL,
                "desconto" numeric(14, 2) NOT NULL DEFAULT '0',
                "moeda" character varying(10) NOT NULL DEFAULT 'AOA',
                "observacoes" text,
                "emitido_por_id" integer,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "uq_liquidacoes_serie_numero" UNIQUE ("serie_id", "numero"),
                CONSTRAINT "chk_liquidacoes_totais" CHECK (
                    "total" > 0
                    AND "desconto" >= 0
                ),
                CONSTRAINT "PK_2dfac78781eb5fcf2ca0c4a7ee9" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_liquidacoes_cliente" ON "liquidacoes" ("cliente_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "liquidacoes_linhas" (
                "id" SERIAL NOT NULL,
                "liquidacao_id" integer NOT NULL,
                "movimento_cc_id" integer NOT NULL,
                "valor_pago" numeric(14, 2) NOT NULL,
                "desconto" numeric(14, 2) NOT NULL DEFAULT '0',
                "pendente_anterior" numeric(14, 2) NOT NULL,
                CONSTRAINT "chk_liquidacoes_linhas_valores" CHECK (
                    "valor_pago" >= 0
                    AND "desconto" >= 0
                    AND "valor_pago" + "desconto" > 0
                ),
                CONSTRAINT "PK_ce6034885834dd5a1cc1e08ee3b" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_liquidacoes_linhas_mov" ON "liquidacoes_linhas" ("movimento_cc_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_liquidacoes_linhas_liq" ON "liquidacoes_linhas" ("liquidacao_id")
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_conta"
            ADD CONSTRAINT "FK_3bacb577d93379559e93255cff1" FOREIGN KEY ("documento_config_id") REFERENCES "documentos_config"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_conta"
            ADD CONSTRAINT "FK_02055b4231b4078f7627286b6c8" FOREIGN KEY ("serie_id") REFERENCES "series"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_conta"
            ADD CONSTRAINT "FK_6e5199850e2694a7c45c06a3c09" FOREIGN KEY ("conta_bancaria_id") REFERENCES "contas_bancarias"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_conta"
            ADD CONSTRAINT "FK_a9ff9403e5e22963438fff7f951" FOREIGN KEY ("modo_pagamento_id") REFERENCES "modos_pagamento"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes"
            ADD CONSTRAINT "FK_223664f1f686edd45abae7ab0cd" FOREIGN KEY ("documento_config_id") REFERENCES "documentos_config"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes"
            ADD CONSTRAINT "FK_99bcfadd7dcd3166a1401e2cd36" FOREIGN KEY ("serie_id") REFERENCES "series"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes"
            ADD CONSTRAINT "FK_fa32cdb96a89aff46e82bd4e1fa" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes"
            ADD CONSTRAINT "FK_77e52c8ce059a9be5dd645b0559" FOREIGN KEY ("conta_bancaria_id") REFERENCES "contas_bancarias"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes"
            ADD CONSTRAINT "FK_7003838a3b94d476b48c4458940" FOREIGN KEY ("emitido_por_id") REFERENCES "users"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes_linhas"
            ADD CONSTRAINT "FK_accaa841eb89451cd9fd414a22a" FOREIGN KEY ("liquidacao_id") REFERENCES "liquidacoes"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes_linhas"
            ADD CONSTRAINT "FK_87c56a392bd9d1e0b766dd371f8" FOREIGN KEY ("movimento_cc_id") REFERENCES "movimentos_cc"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "liquidacoes_linhas" DROP CONSTRAINT "FK_87c56a392bd9d1e0b766dd371f8"
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes_linhas" DROP CONSTRAINT "FK_accaa841eb89451cd9fd414a22a"
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes" DROP CONSTRAINT "FK_7003838a3b94d476b48c4458940"
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes" DROP CONSTRAINT "FK_77e52c8ce059a9be5dd645b0559"
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes" DROP CONSTRAINT "FK_fa32cdb96a89aff46e82bd4e1fa"
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes" DROP CONSTRAINT "FK_99bcfadd7dcd3166a1401e2cd36"
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes" DROP CONSTRAINT "FK_223664f1f686edd45abae7ab0cd"
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_conta" DROP CONSTRAINT "FK_a9ff9403e5e22963438fff7f951"
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_conta" DROP CONSTRAINT "FK_6e5199850e2694a7c45c06a3c09"
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_conta" DROP CONSTRAINT "FK_02055b4231b4078f7627286b6c8"
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_conta" DROP CONSTRAINT "FK_3bacb577d93379559e93255cff1"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_liquidacoes_linhas_liq"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_liquidacoes_linhas_mov"
        `);
        await queryRunner.query(`
            DROP TABLE "liquidacoes_linhas"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_liquidacoes_cliente"
        `);
        await queryRunner.query(`
            DROP TABLE "liquidacoes"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_movimentos_conta_conta"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_movimentos_conta_origem"
        `);
        await queryRunner.query(`
            DROP TABLE "movimentos_conta"
        `);
    }

}
