import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * #164 — Schema da fase 1 do Módulo de Vendas de Intervenções (épico #163):
 * metadados da matriz de configuração (doc_tipos, doc_campos e os três níveis
 * doc_matriz_campos/condicoes/dominios), documentos configurados, séries,
 * tipos/estados de conta corrente, contas bancárias e motivos de estorno.
 * SQL gerado a partir das entities contra BD fresca (`migration:generate`).
 * Os dados (matriz e parametrização inicial) vêm nas migrações seguintes.
 */
export class CreateVendasConfig1790387386073 implements MigrationInterface {
    name = 'CreateVendasConfig1790387386073'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "doc_tipos" (
                "codigo" character varying(30) NOT NULL,
                "descricao" character varying(100) NOT NULL,
                "modulo" character varying(30) NOT NULL,
                "ordem" integer NOT NULL DEFAULT '0',
                CONSTRAINT "PK_001735c0287431133fd9d72d485" PRIMARY KEY ("codigo")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "doc_campos" (
                "codigo" character varying(40) NOT NULL,
                "descricao" character varying(150) NOT NULL,
                "tipo_valor" character varying(30) NOT NULL,
                "alvo_regra" character varying(30),
                "alvo_tipo_codigo" character varying(30),
                "campo_ref" character varying(40),
                "ordem" integer NOT NULL DEFAULT '0',
                CONSTRAINT "chk_doc_campos_alvo_regra" CHECK (
                    "alvo_regra" IS NULL
                    OR "alvo_regra" IN ('TIPO_FIXO', 'NATUREZA_INVERSA')
                ),
                CONSTRAINT "chk_doc_campos_tipo_valor" CHECK (
                    "tipo_valor" IN (
                        'BOOLEAN',
                        'ENUM',
                        'DOC_REF',
                        'SERIE_REF',
                        'CC_TIPO_REF',
                        'CC_ESTADO_REF',
                        'CONTAS_REF'
                    )
                ),
                CONSTRAINT "PK_2e8d540b9e7dacb48374daeed52" PRIMARY KEY ("codigo")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "doc_matriz_campos" (
                "tipo_codigo" character varying(30) NOT NULL,
                "campo_codigo" character varying(40) NOT NULL,
                CONSTRAINT "PK_52057e85a235a67fbdfcd0d32f8" PRIMARY KEY ("tipo_codigo", "campo_codigo")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "doc_matriz_condicoes" (
                "campo_codigo" character varying(40) NOT NULL,
                "campo_pai" character varying(40) NOT NULL,
                "valor_pai" character varying(30) NOT NULL,
                CONSTRAINT "PK_2f7e96a81ed22c6969c000846e6" PRIMARY KEY ("campo_codigo", "campo_pai", "valor_pai")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "doc_matriz_dominios" (
                "tipo_codigo" character varying(30) NOT NULL,
                "campo_codigo" character varying(40) NOT NULL,
                "valor" character varying(30) NOT NULL,
                "descricao" character varying(150) NOT NULL,
                "inverso" character varying(30),
                "ordem" integer NOT NULL DEFAULT '0',
                CONSTRAINT "PK_ea10b3d16457fb74443b0d8c161" PRIMARY KEY ("tipo_codigo", "campo_codigo", "valor")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_doc_matriz_dominios_tipo" ON "doc_matriz_dominios" ("tipo_codigo")
        `);
        await queryRunner.query(`
            CREATE TABLE "cc_tipos" (
                "id" SERIAL NOT NULL,
                "codigo" character varying(10) NOT NULL,
                "descricao" character varying(150) NOT NULL,
                "entidade" character varying(30) NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_75c4040cfdc639d073a88cbcace" UNIQUE ("codigo"),
                CONSTRAINT "chk_cc_tipos_entidade" CHECK ("entidade" IN ('CLIENTE', 'FORNECEDOR')),
                CONSTRAINT "PK_9158cf8780da3d3d0ab3b8e62b0" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "cc_estados" (
                "id" SERIAL NOT NULL,
                "cc_tipo_id" integer NOT NULL,
                "codigo" character varying(10) NOT NULL,
                "descricao" character varying(150) NOT NULL,
                CONSTRAINT "uq_cc_estados_tipo_codigo" UNIQUE ("cc_tipo_id", "codigo"),
                CONSTRAINT "PK_134ea7e70ea026b671101feb4fb" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_cc_estados_tipo" ON "cc_estados" ("cc_tipo_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "contas_bancarias" (
                "id" SERIAL NOT NULL,
                "codigo" character varying(20) NOT NULL,
                "descricao" character varying(150) NOT NULL,
                "tipo" character varying(30) NOT NULL,
                "moeda" character varying(10) NOT NULL DEFAULT 'AOA',
                "banco" character varying(100),
                "numero" character varying(50),
                "iban" character varying(50),
                "agencia" character varying(100),
                "titular" character varying(150),
                "gestor" character varying(150),
                "contactos" character varying(150),
                "aberta" boolean NOT NULL DEFAULT false,
                "ativo" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_9a018222eca99aae1a76b157bdb" UNIQUE ("codigo"),
                CONSTRAINT "chk_contas_bancarias_tipo" CHECK ("tipo" IN ('CAIXA', 'DO')),
                CONSTRAINT "PK_8380e3fa9fab7a0a30e6a407e62" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "documentos_config" (
                "id" SERIAL NOT NULL,
                "codigo" character varying(10) NOT NULL,
                "descricao" character varying(150) NOT NULL,
                "tipo_codigo" character varying(30) NOT NULL,
                "natureza" character varying(30),
                "entidade_permitida" character varying(30),
                "tipo_fiscal" character varying(30),
                "gera_mov_cc" boolean NOT NULL DEFAULT false,
                "opera_sobre_cc" boolean NOT NULL DEFAULT false,
                "cc_tipo_id" integer,
                "cc_estado_id" integer,
                "ligacao_tesouraria" boolean NOT NULL DEFAULT false,
                "ligacao_tesouraria_doc_id" integer,
                "liquidacao_automatica" boolean NOT NULL DEFAULT false,
                "liquidacao_auto_doc_id" integer,
                "estorno" boolean NOT NULL DEFAULT false,
                "estorno_doc_id" integer,
                "estorno_serie_id" integer,
                "acerto_sobra_doc_id" integer,
                "acerto_quebra_doc_id" integer,
                "ativo" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_640e41052158e919695b855fb27" UNIQUE ("codigo"),
                CONSTRAINT "PK_a70ca813117314c2a2041881fc1" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_documentos_config_tipo" ON "documentos_config" ("tipo_codigo")
        `);
        await queryRunner.query(`
            CREATE TABLE "series" (
                "id" SERIAL NOT NULL,
                "documento_config_id" integer NOT NULL,
                "codigo" character varying(20) NOT NULL,
                "ano" integer NOT NULL,
                "limite_inferior" integer NOT NULL DEFAULT '0',
                "limite_superior" integer NOT NULL DEFAULT '99999999',
                "ultimo_numero" integer,
                "ultima_data_hora" TIMESTAMP WITH TIME ZONE,
                "por_defeito" boolean NOT NULL DEFAULT false,
                "sugere_data_sistema" boolean NOT NULL DEFAULT true,
                "ativo" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "uq_series_doc_codigo" UNIQUE ("documento_config_id", "codigo"),
                CONSTRAINT "chk_series_ultimo_numero" CHECK (
                    "ultimo_numero" IS NULL
                    OR (
                        "ultimo_numero" > "limite_inferior"
                        AND "ultimo_numero" <= "limite_superior"
                    )
                ),
                CONSTRAINT "chk_series_limites" CHECK (
                    "limite_inferior" >= 0
                    AND "limite_superior" > "limite_inferior"
                ),
                CONSTRAINT "chk_series_ano" CHECK (
                    "ano" BETWEEN 2000 AND 2100
                ),
                CONSTRAINT "PK_e725676647382eb54540d7128ba" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_series_por_defeito" ON "series" ("documento_config_id")
            WHERE "por_defeito" = true
        `);
        await queryRunner.query(`
            CREATE TABLE "motivos_estorno" (
                "id" SERIAL NOT NULL,
                "codigo" character varying(10) NOT NULL,
                "descricao" character varying(150) NOT NULL,
                "ativo" boolean NOT NULL DEFAULT true,
                CONSTRAINT "UQ_8896d2a735267c8cc82ff81ecfb" UNIQUE ("codigo"),
                CONSTRAINT "PK_c9b1a3598d9c416b9042475dea6" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "documentos_config_bancos" (
                "documento_config_id" integer NOT NULL,
                "conta_bancaria_id" integer NOT NULL,
                CONSTRAINT "PK_6c50e2dae78ca9ae6dd37e12d3a" PRIMARY KEY ("documento_config_id", "conta_bancaria_id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_66c23d0cee9eee8c77d7bb5775" ON "documentos_config_bancos" ("documento_config_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_3b616fdb14e5b7199675ff2684" ON "documentos_config_bancos" ("conta_bancaria_id")
        `);
        await queryRunner.query(`
            ALTER TABLE "doc_campos"
            ADD CONSTRAINT "FK_e26dd60985e740ad6babd3f1c4a" FOREIGN KEY ("alvo_tipo_codigo") REFERENCES "doc_tipos"("codigo") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "doc_matriz_campos"
            ADD CONSTRAINT "FK_967f0cca9f8798600e2acdce105" FOREIGN KEY ("tipo_codigo") REFERENCES "doc_tipos"("codigo") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "doc_matriz_campos"
            ADD CONSTRAINT "FK_14f56780370afb28fcad81dc798" FOREIGN KEY ("campo_codigo") REFERENCES "doc_campos"("codigo") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "doc_matriz_condicoes"
            ADD CONSTRAINT "FK_438fb8e250ec16ab952a57e4514" FOREIGN KEY ("campo_codigo") REFERENCES "doc_campos"("codigo") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "doc_matriz_condicoes"
            ADD CONSTRAINT "FK_3ebd6eac46f846cd5d113b78f0a" FOREIGN KEY ("campo_pai") REFERENCES "doc_campos"("codigo") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "doc_matriz_dominios"
            ADD CONSTRAINT "FK_f5029d37c604dc7ec42535b4a1b" FOREIGN KEY ("tipo_codigo") REFERENCES "doc_tipos"("codigo") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "doc_matriz_dominios"
            ADD CONSTRAINT "FK_a8ca11e718e427a9bbb23b7d407" FOREIGN KEY ("campo_codigo") REFERENCES "doc_campos"("codigo") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "cc_estados"
            ADD CONSTRAINT "FK_6963d684769e0908e6012bb5da6" FOREIGN KEY ("cc_tipo_id") REFERENCES "cc_tipos"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_config"
            ADD CONSTRAINT "FK_0fbfc9be53907e552f6af32a66d" FOREIGN KEY ("tipo_codigo") REFERENCES "doc_tipos"("codigo") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_config"
            ADD CONSTRAINT "FK_86a420c1b90a969ed1bb80e5cc0" FOREIGN KEY ("cc_tipo_id") REFERENCES "cc_tipos"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_config"
            ADD CONSTRAINT "FK_5d592367c571509ffefb96f86a1" FOREIGN KEY ("cc_estado_id") REFERENCES "cc_estados"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_config"
            ADD CONSTRAINT "FK_0078ef7f00e70d58e347efd9fa9" FOREIGN KEY ("ligacao_tesouraria_doc_id") REFERENCES "documentos_config"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_config"
            ADD CONSTRAINT "FK_d9ee5d57be4a0836a1e1cbc3fcc" FOREIGN KEY ("liquidacao_auto_doc_id") REFERENCES "documentos_config"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_config"
            ADD CONSTRAINT "FK_9e627588595f2a52c90b4d0a0d1" FOREIGN KEY ("estorno_doc_id") REFERENCES "documentos_config"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_config"
            ADD CONSTRAINT "FK_3a13e8b5a911746f41b0a3ebfba" FOREIGN KEY ("estorno_serie_id") REFERENCES "series"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_config"
            ADD CONSTRAINT "FK_94ea4ad69bfed61ad88b6b646ac" FOREIGN KEY ("acerto_sobra_doc_id") REFERENCES "documentos_config"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_config"
            ADD CONSTRAINT "FK_66c7466f1164bad0b4481a92651" FOREIGN KEY ("acerto_quebra_doc_id") REFERENCES "documentos_config"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "series"
            ADD CONSTRAINT "FK_63bad696ef8209342edc5e24e0e" FOREIGN KEY ("documento_config_id") REFERENCES "documentos_config"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_config_bancos"
            ADD CONSTRAINT "FK_66c23d0cee9eee8c77d7bb57751" FOREIGN KEY ("documento_config_id") REFERENCES "documentos_config"("id") ON DELETE CASCADE ON UPDATE CASCADE
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_config_bancos"
            ADD CONSTRAINT "FK_3b616fdb14e5b7199675ff26849" FOREIGN KEY ("conta_bancaria_id") REFERENCES "contas_bancarias"("id") ON DELETE CASCADE ON UPDATE CASCADE
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "documentos_config_bancos" DROP CONSTRAINT "FK_3b616fdb14e5b7199675ff26849"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_config_bancos" DROP CONSTRAINT "FK_66c23d0cee9eee8c77d7bb57751"
        `);
        await queryRunner.query(`
            ALTER TABLE "series" DROP CONSTRAINT "FK_63bad696ef8209342edc5e24e0e"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_config" DROP CONSTRAINT "FK_66c7466f1164bad0b4481a92651"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_config" DROP CONSTRAINT "FK_94ea4ad69bfed61ad88b6b646ac"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_config" DROP CONSTRAINT "FK_3a13e8b5a911746f41b0a3ebfba"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_config" DROP CONSTRAINT "FK_9e627588595f2a52c90b4d0a0d1"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_config" DROP CONSTRAINT "FK_d9ee5d57be4a0836a1e1cbc3fcc"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_config" DROP CONSTRAINT "FK_0078ef7f00e70d58e347efd9fa9"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_config" DROP CONSTRAINT "FK_5d592367c571509ffefb96f86a1"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_config" DROP CONSTRAINT "FK_86a420c1b90a969ed1bb80e5cc0"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_config" DROP CONSTRAINT "FK_0fbfc9be53907e552f6af32a66d"
        `);
        await queryRunner.query(`
            ALTER TABLE "cc_estados" DROP CONSTRAINT "FK_6963d684769e0908e6012bb5da6"
        `);
        await queryRunner.query(`
            ALTER TABLE "doc_matriz_dominios" DROP CONSTRAINT "FK_a8ca11e718e427a9bbb23b7d407"
        `);
        await queryRunner.query(`
            ALTER TABLE "doc_matriz_dominios" DROP CONSTRAINT "FK_f5029d37c604dc7ec42535b4a1b"
        `);
        await queryRunner.query(`
            ALTER TABLE "doc_matriz_condicoes" DROP CONSTRAINT "FK_3ebd6eac46f846cd5d113b78f0a"
        `);
        await queryRunner.query(`
            ALTER TABLE "doc_matriz_condicoes" DROP CONSTRAINT "FK_438fb8e250ec16ab952a57e4514"
        `);
        await queryRunner.query(`
            ALTER TABLE "doc_matriz_campos" DROP CONSTRAINT "FK_14f56780370afb28fcad81dc798"
        `);
        await queryRunner.query(`
            ALTER TABLE "doc_matriz_campos" DROP CONSTRAINT "FK_967f0cca9f8798600e2acdce105"
        `);
        await queryRunner.query(`
            ALTER TABLE "doc_campos" DROP CONSTRAINT "FK_e26dd60985e740ad6babd3f1c4a"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_3b616fdb14e5b7199675ff2684"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_66c23d0cee9eee8c77d7bb5775"
        `);
        await queryRunner.query(`
            DROP TABLE "documentos_config_bancos"
        `);
        await queryRunner.query(`
            DROP TABLE "motivos_estorno"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."uq_series_por_defeito"
        `);
        await queryRunner.query(`
            DROP TABLE "series"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_documentos_config_tipo"
        `);
        await queryRunner.query(`
            DROP TABLE "documentos_config"
        `);
        await queryRunner.query(`
            DROP TABLE "contas_bancarias"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_cc_estados_tipo"
        `);
        await queryRunner.query(`
            DROP TABLE "cc_estados"
        `);
        await queryRunner.query(`
            DROP TABLE "cc_tipos"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_doc_matriz_dominios_tipo"
        `);
        await queryRunner.query(`
            DROP TABLE "doc_matriz_dominios"
        `);
        await queryRunner.query(`
            DROP TABLE "doc_matriz_condicoes"
        `);
        await queryRunner.query(`
            DROP TABLE "doc_matriz_campos"
        `);
        await queryRunner.query(`
            DROP TABLE "doc_campos"
        `);
        await queryRunner.query(`
            DROP TABLE "doc_tipos"
        `);
    }

}
