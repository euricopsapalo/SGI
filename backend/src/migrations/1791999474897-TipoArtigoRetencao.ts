import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * #195 — Tipo de artigo e marcação de retenção na fonte (pré-requisito do #179):
 * - `artigos.tipo` (PRODUTO/SERVICO, varchar + CHECK — #89; existentes ficam PRODUTO)
 *   e `artigos.sujeito_retencao` (só Serviços — CHECK);
 * - cópia de ambos em `documentos_venda_linhas` (fixada na emissão).
 * SQL gerado a partir das entities contra BD fresca (`migration:generate`).
 */
export class TipoArtigoRetencao1791999474897 implements MigrationInterface {
    name = 'TipoArtigoRetencao1791999474897'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "artigos"
            ADD "tipo" character varying(30) NOT NULL DEFAULT 'PRODUTO'
        `);
        await queryRunner.query(`
            ALTER TABLE "artigos"
            ADD "sujeito_retencao" boolean NOT NULL DEFAULT false
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda_linhas"
            ADD "tipo_artigo" character varying(30) NOT NULL DEFAULT 'PRODUTO'
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda_linhas"
            ADD "sujeito_retencao" boolean NOT NULL DEFAULT false
        `);
        await queryRunner.query(`
            ALTER TABLE "artigos"
            ADD CONSTRAINT "chk_artigos_retencao_servico" CHECK (
                    "sujeito_retencao" = false
                    OR "tipo" = 'SERVICO'
                )
        `);
        await queryRunner.query(`
            ALTER TABLE "artigos"
            ADD CONSTRAINT "chk_artigos_tipo" CHECK ("tipo" IN ('PRODUTO', 'SERVICO'))
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda_linhas"
            ADD CONSTRAINT "chk_dvl_tipo_artigo" CHECK ("tipo_artigo" IN ('PRODUTO', 'SERVICO'))
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "documentos_venda_linhas" DROP CONSTRAINT "chk_dvl_tipo_artigo"
        `);
        await queryRunner.query(`
            ALTER TABLE "artigos" DROP CONSTRAINT "chk_artigos_tipo"
        `);
        await queryRunner.query(`
            ALTER TABLE "artigos" DROP CONSTRAINT "chk_artigos_retencao_servico"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda_linhas" DROP COLUMN "sujeito_retencao"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda_linhas" DROP COLUMN "tipo_artigo"
        `);
        await queryRunner.query(`
            ALTER TABLE "artigos" DROP COLUMN "sujeito_retencao"
        `);
        await queryRunner.query(`
            ALTER TABLE "artigos" DROP COLUMN "tipo"
        `);
    }

}
