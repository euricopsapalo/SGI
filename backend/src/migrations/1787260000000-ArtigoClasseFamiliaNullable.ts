import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * #159 — `artigos.classe` e `artigos.familia` deixam de ser obrigatórias:
 * o registo de um artigo já não exige preencher a classe/família.
 * Alinha o schema versionado com a entity (`nullable: true`) e o DTO
 * (`@IsOptional`), evitando drift (#31).
 */
export class ArtigoClasseFamiliaNullable1787260000000 implements MigrationInterface {
    name = 'ArtigoClasseFamiliaNullable1787260000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "artigos" ALTER COLUMN "classe" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "artigos" ALTER COLUMN "familia" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "artigos" ALTER COLUMN "familia" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "artigos" ALTER COLUMN "classe" SET NOT NULL`);
    }
}
