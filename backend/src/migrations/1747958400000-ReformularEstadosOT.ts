import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RF-OT-001 — Ciclo de vida e máquina de estados da OT.
 *
 * Substitui o modelo de 4 estados (Programado/Em curso/Terminado/Encerrado)
 * pela máquina de 6 estados (Registada/Programada/Adiada/Confirmada/
 * Em execução/Finalizada), renomeia o tipo `programada` → `periodica` e
 * acrescenta a coluna `assinada_cliente`.
 */
export class ReformularEstadosOT1747958400000 implements MigrationInterface {
  name = 'ReformularEstadosOT1747958400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Mapear estados antigos → novos.
    //    Programado sem data programada → ainda só Registada.
    await queryRunner.query(`
      UPDATE ordens_trabalho SET estado = 'Registada'
        WHERE estado = 'Programado' AND data_prog_inicio IS NULL;
      UPDATE ordens_trabalho SET estado = 'Programada'
        WHERE estado = 'Programado' AND data_prog_inicio IS NOT NULL;
      UPDATE ordens_trabalho SET estado = 'Em execução'
        WHERE estado = 'Em curso';
      UPDATE ordens_trabalho SET estado = 'Finalizada'
        WHERE estado IN ('Terminado', 'Encerrado');
    `);

    // 2. Mapear tipo programada → periodica.
    await queryRunner.query(`
      UPDATE ordens_trabalho SET tipo = 'periodica' WHERE tipo = 'programada';
    `);

    // 3. Coluna assinada_cliente (true para OTs já finalizadas).
    await queryRunner.query(`
      ALTER TABLE ordens_trabalho
        ADD COLUMN IF NOT EXISTS assinada_cliente BOOLEAN NOT NULL DEFAULT false;
    `);
    await queryRunner.query(`
      UPDATE ordens_trabalho SET assinada_cliente = true WHERE estado = 'Finalizada';
    `);

    // 4. Ajustar default e CHECK constraint do enum.
    await queryRunner.query(`
      ALTER TABLE ordens_trabalho ALTER COLUMN estado SET DEFAULT 'Registada';
      ALTER TABLE ordens_trabalho DROP CONSTRAINT IF EXISTS chk_ot_estado;
      ALTER TABLE ordens_trabalho ADD CONSTRAINT chk_ot_estado
        CHECK (estado IN ('Registada','Programada','Adiada','Confirmada','Em execução','Finalizada'));
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverter mapeamento. Encerrado não é recuperável → fica Terminado.
    await queryRunner.query(`
      ALTER TABLE ordens_trabalho DROP CONSTRAINT IF EXISTS chk_ot_estado;
      ALTER TABLE ordens_trabalho ALTER COLUMN estado SET DEFAULT 'Programado';
    `);
    await queryRunner.query(`
      UPDATE ordens_trabalho SET estado = 'Programado'
        WHERE estado IN ('Registada','Programada','Adiada','Confirmada');
      UPDATE ordens_trabalho SET estado = 'Em curso'
        WHERE estado = 'Em execução';
      UPDATE ordens_trabalho SET estado = 'Terminado'
        WHERE estado = 'Finalizada';
      UPDATE ordens_trabalho SET tipo = 'programada' WHERE tipo = 'periodica';
    `);
    await queryRunner.query(`
      ALTER TABLE ordens_trabalho DROP COLUMN IF EXISTS assinada_cliente;
    `);
  }
}
