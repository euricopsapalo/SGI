import { MigrationInterface, QueryRunner } from "typeorm";

export class LookupFksManyToOne1787168341785 implements MigrationInterface {
    name = 'LookupFksManyToOne1787168341785'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "clientes"
            ADD CONSTRAINT "FK_6b167efb1202b02a04c11a7bdb2" FOREIGN KEY ("condicao_pagamento_id") REFERENCES "condicoes_pagamento"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "clientes"
            ADD CONSTRAINT "FK_e7c01a1602cab3b6536aefcc6f4" FOREIGN KEY ("modo_pagamento_id") REFERENCES "modos_pagamento"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "tecnicos"
            ADD CONSTRAINT "FK_4cd7d9f1984cf40b1224cca2d72" FOREIGN KEY ("provincia_id") REFERENCES "provincias"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "tecnicos"
            ADD CONSTRAINT "FK_42399e7ad9fb6b101dbaf12c607" FOREIGN KEY ("municipio_id") REFERENCES "municipios"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "fornecedores"
            ADD CONSTRAINT "FK_da79e1bf0db8387115b56c8f273" FOREIGN KEY ("provincia_id") REFERENCES "provincias"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "fornecedores"
            ADD CONSTRAINT "FK_757c03fb2c4240acbe36f87cc53" FOREIGN KEY ("municipio_id") REFERENCES "municipios"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "fornecedores"
            ADD CONSTRAINT "FK_a7a9128c8c8669598fc205e7320" FOREIGN KEY ("condicao_pagamento_id") REFERENCES "condicoes_pagamento"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "fornecedores"
            ADD CONSTRAINT "FK_090efa581488ecd973280472355" FOREIGN KEY ("modo_pagamento_id") REFERENCES "modos_pagamento"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "faturas_fornecedor"
            ADD CONSTRAINT "FK_7ada12e150b1ec9dfec2b7ae502" FOREIGN KEY ("condicao_pagamento_id") REFERENCES "condicoes_pagamento"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "faturas_fornecedor"
            ADD CONSTRAINT "FK_2a600181d23692ed890e5469c2e" FOREIGN KEY ("modo_pagamento_id") REFERENCES "modos_pagamento"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "faturas"
            ADD CONSTRAINT "FK_6a976cd9b4fe2300c15ca4a2630" FOREIGN KEY ("ot_id") REFERENCES "ordens_trabalho"("id") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "faturas" DROP CONSTRAINT "FK_6a976cd9b4fe2300c15ca4a2630"
        `);
        await queryRunner.query(`
            ALTER TABLE "faturas_fornecedor" DROP CONSTRAINT "FK_2a600181d23692ed890e5469c2e"
        `);
        await queryRunner.query(`
            ALTER TABLE "faturas_fornecedor" DROP CONSTRAINT "FK_7ada12e150b1ec9dfec2b7ae502"
        `);
        await queryRunner.query(`
            ALTER TABLE "fornecedores" DROP CONSTRAINT "FK_090efa581488ecd973280472355"
        `);
        await queryRunner.query(`
            ALTER TABLE "fornecedores" DROP CONSTRAINT "FK_a7a9128c8c8669598fc205e7320"
        `);
        await queryRunner.query(`
            ALTER TABLE "fornecedores" DROP CONSTRAINT "FK_757c03fb2c4240acbe36f87cc53"
        `);
        await queryRunner.query(`
            ALTER TABLE "fornecedores" DROP CONSTRAINT "FK_da79e1bf0db8387115b56c8f273"
        `);
        await queryRunner.query(`
            ALTER TABLE "tecnicos" DROP CONSTRAINT "FK_42399e7ad9fb6b101dbaf12c607"
        `);
        await queryRunner.query(`
            ALTER TABLE "tecnicos" DROP CONSTRAINT "FK_4cd7d9f1984cf40b1224cca2d72"
        `);
        await queryRunner.query(`
            ALTER TABLE "clientes" DROP CONSTRAINT "FK_e7c01a1602cab3b6536aefcc6f4"
        `);
        await queryRunner.query(`
            ALTER TABLE "clientes" DROP CONSTRAINT "FK_6b167efb1202b02a04c11a7bdb2"
        `);
    }

}
