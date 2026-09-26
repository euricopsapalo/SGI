import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * #165 — Schema da fase 2 do Módulo de Vendas de Intervenções (épico #163):
 * documentos de venda + linhas (rascunho/emitido), movimentos de conta corrente
 * e a ligação `ordens_trabalho.documento_venda_id` (FK nullable, RESTRICT) que
 * garante uma fatura activa por OT (D5).
 * SQL gerado a partir das entities contra BD fresca (`migration:generate`).
 */
export class CreateDocumentosVenda1790413461639 implements MigrationInterface {
    name = 'CreateDocumentosVenda1790413461639'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "movimentos_cc" (
                "id" SERIAL NOT NULL,
                "cc_tipo_id" integer NOT NULL,
                "cc_estado_id" integer NOT NULL,
                "cliente_id" integer NOT NULL,
                "origem_tipo" character varying(30) NOT NULL,
                "origem_id" integer NOT NULL,
                "natureza" character varying(1) NOT NULL,
                "valor_original" numeric(14, 2) NOT NULL,
                "valor_pendente" numeric(14, 2) NOT NULL,
                "modo_pagamento_id" integer,
                "data_documento" date NOT NULL,
                "data_vencimento" date NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "chk_movimentos_cc_valores" CHECK (
                    "valor_original" > 0
                    AND "valor_pendente" >= 0
                    AND "valor_pendente" <= "valor_original"
                ),
                CONSTRAINT "chk_movimentos_cc_natureza" CHECK ("natureza" IN ('D', 'C')),
                CONSTRAINT "chk_movimentos_cc_origem" CHECK ("origem_tipo" IN ('DOCUMENTO_VENDA')),
                CONSTRAINT "PK_896b0a5036af4500fb4d312fd4b" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_movimentos_cc_origem" ON "movimentos_cc" ("origem_tipo", "origem_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_movimentos_cc_cliente" ON "movimentos_cc" ("cliente_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "documentos_venda" (
                "id" SERIAL NOT NULL,
                "documento_config_id" integer NOT NULL,
                "serie_id" integer,
                "numero" integer,
                "data_hora" TIMESTAMP WITH TIME ZONE,
                "estado" character varying(30) NOT NULL DEFAULT 'RASCUNHO',
                "cliente_id" integer NOT NULL,
                "ot_id" integer NOT NULL,
                "documento_origem_id" integer,
                "modo_pagamento_id" integer,
                "referencia" character varying(200),
                "observacoes" text,
                "desconto_global" numeric(5, 2) NOT NULL DEFAULT '0',
                "subtotal" numeric(14, 2) NOT NULL DEFAULT '0',
                "desconto" numeric(14, 2) NOT NULL DEFAULT '0',
                "valor_iva" numeric(14, 2) NOT NULL DEFAULT '0',
                "total" numeric(14, 2) NOT NULL DEFAULT '0',
                "moeda" character varying(10) NOT NULL DEFAULT 'AOA',
                "criado_por_id" integer,
                "emitido_por_id" integer,
                "emitido_em" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "uq_documentos_venda_serie_numero" UNIQUE ("serie_id", "numero"),
                CONSTRAINT "chk_documentos_venda_totais_nn" CHECK (
                    "subtotal" >= 0
                    AND "desconto" >= 0
                    AND "valor_iva" >= 0
                    AND "total" >= 0
                ),
                CONSTRAINT "chk_documentos_venda_desconto" CHECK (
                    "desconto_global" >= 0
                    AND "desconto_global" <= 100
                ),
                CONSTRAINT "chk_documentos_venda_numeracao" CHECK (
                    (
                        "estado" = 'RASCUNHO'
                        AND "numero" IS NULL
                        AND "serie_id" IS NULL
                    )
                    OR (
                        "estado" = 'EMITIDO'
                        AND "numero" IS NOT NULL
                        AND "serie_id" IS NOT NULL
                        AND "data_hora" IS NOT NULL
                    )
                ),
                CONSTRAINT "chk_documentos_venda_estado" CHECK ("estado" IN ('RASCUNHO', 'EMITIDO')),
                CONSTRAINT "PK_c306203fb6cd62eecd9227c1baa" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_documentos_venda_estado" ON "documentos_venda" ("estado")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_documentos_venda_cliente" ON "documentos_venda" ("cliente_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_documentos_venda_ot" ON "documentos_venda" ("ot_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "documentos_venda_linhas" (
                "id" SERIAL NOT NULL,
                "documento_id" integer NOT NULL,
                "ot_artigo_id" integer,
                "artigo_id" integer,
                "descricao" character varying(300) NOT NULL,
                "quantidade" numeric(12, 3) NOT NULL,
                "preco_unitario" numeric(12, 2) NOT NULL,
                "desconto" numeric(5, 2) NOT NULL DEFAULT '0',
                "codigo_iva" character varying(20),
                "taxa_iva" numeric(5, 2) NOT NULL DEFAULT '0',
                "total_liquido" numeric(14, 2) NOT NULL DEFAULT '0',
                "qtd_estornada" numeric(12, 3) NOT NULL DEFAULT '0',
                "linha_origem_id" integer,
                "motivo_estorno_id" integer,
                "ordem" integer NOT NULL DEFAULT '0',
                CONSTRAINT "chk_dvl_qtd_estornada" CHECK (
                    "qtd_estornada" >= 0
                    AND "qtd_estornada" <= "quantidade"
                ),
                CONSTRAINT "chk_dvl_taxa_iva" CHECK ("taxa_iva" >= 0),
                CONSTRAINT "chk_dvl_desconto" CHECK (
                    "desconto" >= 0
                    AND "desconto" <= 100
                ),
                CONSTRAINT "chk_dvl_preco" CHECK ("preco_unitario" >= 0),
                CONSTRAINT "chk_dvl_quantidade" CHECK ("quantidade" > 0),
                CONSTRAINT "PK_e7dc430f38d28ad3d2ce292a2b8" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_documentos_venda_linhas_doc" ON "documentos_venda_linhas" ("documento_id")
        `);
        await queryRunner.query(`
            ALTER TABLE "ordens_trabalho"
            ADD "documento_venda_id" integer
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_ot_documento_venda" ON "ordens_trabalho" ("documento_venda_id")
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_cc"
            ADD CONSTRAINT "FK_d6b6c2a65ba9067530a3f3d6954" FOREIGN KEY ("cc_tipo_id") REFERENCES "cc_tipos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_cc"
            ADD CONSTRAINT "FK_59e506217ef86f84bbf3523b4f0" FOREIGN KEY ("cc_estado_id") REFERENCES "cc_estados"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_cc"
            ADD CONSTRAINT "FK_abf78fb2bab42ba659686a32f77" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_cc"
            ADD CONSTRAINT "FK_c6ee2a658c782331ecb0784f570" FOREIGN KEY ("modo_pagamento_id") REFERENCES "modos_pagamento"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "ordens_trabalho"
            ADD CONSTRAINT "FK_094697daa7e09800dc4b6a75641" FOREIGN KEY ("documento_venda_id") REFERENCES "documentos_venda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda"
            ADD CONSTRAINT "FK_e98aae7d80d64ba47ee7f852ad2" FOREIGN KEY ("documento_config_id") REFERENCES "documentos_config"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda"
            ADD CONSTRAINT "FK_ca17b9b8c6d01e97315354b4e36" FOREIGN KEY ("serie_id") REFERENCES "series"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda"
            ADD CONSTRAINT "FK_3d623e34470f8999e8853cb8352" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda"
            ADD CONSTRAINT "FK_aa787b0558444adcb1b684f5cee" FOREIGN KEY ("ot_id") REFERENCES "ordens_trabalho"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda"
            ADD CONSTRAINT "FK_f6bb9ab9ac5821bbd9d65e3fd78" FOREIGN KEY ("documento_origem_id") REFERENCES "documentos_venda"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda"
            ADD CONSTRAINT "FK_1b9d1487d8d9437cd4a46b0e9e1" FOREIGN KEY ("modo_pagamento_id") REFERENCES "modos_pagamento"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda"
            ADD CONSTRAINT "FK_db724d7533ed203c3195df5d1d8" FOREIGN KEY ("criado_por_id") REFERENCES "users"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda"
            ADD CONSTRAINT "FK_f0311ee06ca41a7181c47db84b1" FOREIGN KEY ("emitido_por_id") REFERENCES "users"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda_linhas"
            ADD CONSTRAINT "FK_ee544a32c19e36e176e11162479" FOREIGN KEY ("documento_id") REFERENCES "documentos_venda"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda_linhas"
            ADD CONSTRAINT "FK_0c814b6acac904b157739268de8" FOREIGN KEY ("ot_artigo_id") REFERENCES "ot_artigos"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda_linhas"
            ADD CONSTRAINT "FK_1ca4f1963a133114341361db55b" FOREIGN KEY ("artigo_id") REFERENCES "artigos"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda_linhas"
            ADD CONSTRAINT "FK_4cc153e58c7ad67cb479643656a" FOREIGN KEY ("linha_origem_id") REFERENCES "documentos_venda_linhas"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda_linhas"
            ADD CONSTRAINT "FK_155791a8677e22070d26785e8d4" FOREIGN KEY ("motivo_estorno_id") REFERENCES "motivos_estorno"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "documentos_venda_linhas" DROP CONSTRAINT "FK_155791a8677e22070d26785e8d4"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda_linhas" DROP CONSTRAINT "FK_4cc153e58c7ad67cb479643656a"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda_linhas" DROP CONSTRAINT "FK_1ca4f1963a133114341361db55b"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda_linhas" DROP CONSTRAINT "FK_0c814b6acac904b157739268de8"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda_linhas" DROP CONSTRAINT "FK_ee544a32c19e36e176e11162479"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda" DROP CONSTRAINT "FK_f0311ee06ca41a7181c47db84b1"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda" DROP CONSTRAINT "FK_db724d7533ed203c3195df5d1d8"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda" DROP CONSTRAINT "FK_1b9d1487d8d9437cd4a46b0e9e1"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda" DROP CONSTRAINT "FK_f6bb9ab9ac5821bbd9d65e3fd78"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda" DROP CONSTRAINT "FK_aa787b0558444adcb1b684f5cee"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda" DROP CONSTRAINT "FK_3d623e34470f8999e8853cb8352"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda" DROP CONSTRAINT "FK_ca17b9b8c6d01e97315354b4e36"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda" DROP CONSTRAINT "FK_e98aae7d80d64ba47ee7f852ad2"
        `);
        await queryRunner.query(`
            ALTER TABLE "ordens_trabalho" DROP CONSTRAINT "FK_094697daa7e09800dc4b6a75641"
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_cc" DROP CONSTRAINT "FK_c6ee2a658c782331ecb0784f570"
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_cc" DROP CONSTRAINT "FK_abf78fb2bab42ba659686a32f77"
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_cc" DROP CONSTRAINT "FK_59e506217ef86f84bbf3523b4f0"
        `);
        await queryRunner.query(`
            ALTER TABLE "movimentos_cc" DROP CONSTRAINT "FK_d6b6c2a65ba9067530a3f3d6954"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_ot_documento_venda"
        `);
        await queryRunner.query(`
            ALTER TABLE "ordens_trabalho" DROP COLUMN "documento_venda_id"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_documentos_venda_linhas_doc"
        `);
        await queryRunner.query(`
            DROP TABLE "documentos_venda_linhas"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_documentos_venda_ot"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_documentos_venda_cliente"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_documentos_venda_estado"
        `);
        await queryRunner.query(`
            DROP TABLE "documentos_venda"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_movimentos_cc_cliente"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."uq_movimentos_cc_origem"
        `);
        await queryRunner.query(`
            DROP TABLE "movimentos_cc"
        `);
    }

}
