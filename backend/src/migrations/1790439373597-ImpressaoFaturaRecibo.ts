import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * #178 — Impressão da Fatura e do Recibo conforme os modelos de referência:
 * identificação legal da empresa (fax, capital social, conservatória, matrícula),
 * código postal do cliente, motivo de isenção das taxas de IVA, requisição,
 * hash encadeado, data de disponibilização e cópia (snapshot) dos dados do
 * cliente/empresa na FT, referência do pagamento e snapshot no RE, e o contador
 * de impressões (Original / Segunda via). Só colunas novas e anuláveis.
 * SQL gerado a partir das entities contra BD fresca (`migration:generate`).
 */
export class ImpressaoFaturaRecibo1790439373597 implements MigrationInterface {
    name = 'ImpressaoFaturaRecibo1790439373597'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "cliente_enderecos"
            ADD "codigo_postal" character varying(20)
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda"
            ADD "requisicao" character varying(50)
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda"
            ADD "hash" character varying(64)
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda"
            ADD "data_disposicao" date
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda"
            ADD "snapshot_cliente" jsonb
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda"
            ADD "snapshot_empresa" jsonb
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda"
            ADD "impressoes" integer NOT NULL DEFAULT '0'
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes"
            ADD "referencia_pagamento" character varying(50)
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes"
            ADD "snapshot_cliente" jsonb
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes"
            ADD "snapshot_empresa" jsonb
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes"
            ADD "impressoes" integer NOT NULL DEFAULT '0'
        `);
        await queryRunner.query(`
            ALTER TABLE "taxas_iva"
            ADD "motivo_isencao" character varying(200)
        `);
        await queryRunner.query(`
            ALTER TABLE "configuracao_empresa"
            ADD "fax" character varying(30)
        `);
        await queryRunner.query(`
            ALTER TABLE "configuracao_empresa"
            ADD "capital_social" character varying(50)
        `);
        await queryRunner.query(`
            ALTER TABLE "configuracao_empresa"
            ADD "conservatoria_registo" character varying(150)
        `);
        await queryRunner.query(`
            ALTER TABLE "configuracao_empresa"
            ADD "matricula" character varying(50)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "configuracao_empresa" DROP COLUMN "matricula"
        `);
        await queryRunner.query(`
            ALTER TABLE "configuracao_empresa" DROP COLUMN "conservatoria_registo"
        `);
        await queryRunner.query(`
            ALTER TABLE "configuracao_empresa" DROP COLUMN "capital_social"
        `);
        await queryRunner.query(`
            ALTER TABLE "configuracao_empresa" DROP COLUMN "fax"
        `);
        await queryRunner.query(`
            ALTER TABLE "taxas_iva" DROP COLUMN "motivo_isencao"
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes" DROP COLUMN "impressoes"
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes" DROP COLUMN "snapshot_empresa"
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes" DROP COLUMN "snapshot_cliente"
        `);
        await queryRunner.query(`
            ALTER TABLE "liquidacoes" DROP COLUMN "referencia_pagamento"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda" DROP COLUMN "impressoes"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda" DROP COLUMN "snapshot_empresa"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda" DROP COLUMN "snapshot_cliente"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda" DROP COLUMN "data_disposicao"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda" DROP COLUMN "hash"
        `);
        await queryRunner.query(`
            ALTER TABLE "documentos_venda" DROP COLUMN "requisicao"
        `);
        await queryRunner.query(`
            ALTER TABLE "cliente_enderecos" DROP COLUMN "codigo_postal"
        `);
    }

}
