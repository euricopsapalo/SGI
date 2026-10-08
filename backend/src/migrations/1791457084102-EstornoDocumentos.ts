import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * #169 — Estorno (fase 6 do épico #163):
 * - `liquidacoes.liquidacao_origem_id` (ERE → RE estornada; UNIQUE: estorna-se uma vez)
 *   e `motivo_estorno_id`;
 * - índices para seguir NC/ND → documento e linha estornados.
 * As colunas do estorno de documentos de venda (`qtd_estornada`, `linha_origem_id`,
 * `motivo_estorno_id`, `documento_origem_id`) já existem desde CreateDocumentosVenda.
 * SQL gerado a partir das entities contra BD fresca (`migration:generate`).
 */
export class EstornoDocumentos1791457084102 implements MigrationInterface {
    name = 'EstornoDocumentos1791457084102'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "liquidacoes"
            ADD "liquidacao_origem_id" integer
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes"
            ADD "motivo_estorno_id" integer
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_documentos_venda_origem" ON "documentos_venda" ("documento_origem_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_documentos_venda_linhas_origem" ON "documentos_venda_linhas" ("linha_origem_id")
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_liquidacoes_origem" ON "liquidacoes" ("liquidacao_origem_id")
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes"
            ADD CONSTRAINT "FK_a5ffacd6d774e4a408eb5e43322" FOREIGN KEY ("liquidacao_origem_id") REFERENCES "liquidacoes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes"
            ADD CONSTRAINT "FK_3bee69ba5786d2f9b065299ae3a" FOREIGN KEY ("motivo_estorno_id") REFERENCES "motivos_estorno"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "liquidacoes" DROP CONSTRAINT "FK_3bee69ba5786d2f9b065299ae3a"
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes" DROP CONSTRAINT "FK_a5ffacd6d774e4a408eb5e43322"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."uq_liquidacoes_origem"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_documentos_venda_linhas_origem"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."idx_documentos_venda_origem"
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes" DROP COLUMN "motivo_estorno_id"
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes" DROP COLUMN "liquidacao_origem_id"
        `);
    }

}
