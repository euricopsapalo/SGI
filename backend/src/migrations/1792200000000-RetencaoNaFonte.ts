import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * #179 — Retenção na fonte (Lei 19/14), configurada na ficha do cliente:
 * - `clientes.retencao_ativa`, `retencao_percentagem` (6,5 por omissão) e `retencao_descricao`;
 * - no documento de venda, a cópia fixada na emissão: `retencao_incidencia`,
 *   `retencao_percentagem`, `retencao_valor` e `retencao_descricao`.
 * O pendente da conta corrente nasce já líquido da retenção (total − retenção).
 */
export class RetencaoNaFonte1792200000000 implements MigrationInterface {
    name = 'RetencaoNaFonte1792200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "clientes"
            ADD "retencao_ativa" boolean NOT NULL DEFAULT false
        `);
        await queryRunner.query(`
            ALTER TABLE "clientes"
            ADD "retencao_percentagem" numeric(5, 2) NOT NULL DEFAULT '6.5'
        `);
        await queryRunner.query(`
            ALTER TABLE "clientes"
            ADD "retencao_descricao" character varying(120) NOT NULL DEFAULT 'Retenção Clientes — Lei 19/14'
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda"
            ADD "retencao_incidencia" numeric(14, 2) NOT NULL DEFAULT '0'
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda"
            ADD "retencao_percentagem" numeric(5, 2) NOT NULL DEFAULT '0'
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda"
            ADD "retencao_valor" numeric(14, 2) NOT NULL DEFAULT '0'
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda"
            ADD "retencao_descricao" character varying(120)
        `);
        await queryRunner.query(`
            ALTER TABLE "clientes"
            ADD CONSTRAINT "chk_clientes_retencao_percentagem" CHECK (
                    "retencao_percentagem" >= 0
                    AND "retencao_percentagem" <= 100
                )
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda"
            ADD CONSTRAINT "chk_documentos_venda_retencao" CHECK (
                    "retencao_incidencia" >= 0
                    AND "retencao_percentagem" >= 0
                    AND "retencao_percentagem" <= 100
                    AND "retencao_valor" >= 0
                    AND "retencao_valor" <= "total"
                )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "documentos_venda" DROP CONSTRAINT "chk_documentos_venda_retencao"
        `);
        await queryRunner.query(`
            ALTER TABLE "clientes" DROP CONSTRAINT "chk_clientes_retencao_percentagem"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda" DROP COLUMN "retencao_descricao"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda" DROP COLUMN "retencao_valor"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda" DROP COLUMN "retencao_percentagem"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda" DROP COLUMN "retencao_incidencia"
        `);
        await queryRunner.query(`
            ALTER TABLE "clientes" DROP COLUMN "retencao_descricao"
        `);
        await queryRunner.query(`
            ALTER TABLE "clientes" DROP COLUMN "retencao_percentagem"
        `);
        await queryRunner.query(`
            ALTER TABLE "clientes" DROP COLUMN "retencao_ativa"
        `);
    }

}
