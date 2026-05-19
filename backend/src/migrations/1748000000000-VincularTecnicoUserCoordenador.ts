import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Issue #65 — Vincular Tecnico ↔ User (1:1 obrigatório) e introduzir
 * papel 'coordenador de intervenções' (pré-requisito do #55).
 *
 * Estratégia:
 * 1. Adiciona o valor 'coordenador' ao CHECK do enum users.role.
 * 2. Backfill: associa tecnicos.id_user pelo email coincidente com users.email.
 * 3. Para técnicos órfãos (sem user mapeável), cria um user automático com
 *    role='campo', password temporária (igual à dos seeds) e ativo=true.
 * 4. Aplica NOT NULL + UNIQUE em tecnicos.id_user e troca onDelete para RESTRICT.
 */
export class VincularTecnicoUserCoordenador1748000000000 implements MigrationInterface {
  name = 'VincularTecnicoUserCoordenador1748000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. CHECK de role inclui 'coordenador'
    await queryRunner.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;
      ALTER TABLE users ADD CONSTRAINT chk_users_role
        CHECK (role IN ('admin','suporte','coordenador','campo','vendedor'));
    `);

    // 2. Backfill por email (preserva ligações já existentes)
    await queryRunner.query(`
      UPDATE tecnicos t
         SET id_user = u.id
        FROM users u
       WHERE t.id_user IS NULL
         AND t.email IS NOT NULL
         AND LOWER(t.email) = LOWER(u.email);
    `);

    // 3. Para órfãos, criar user automático
    //    Password hash = bcrypt('aquatex2024') — mesma dos seeds; força reset recomendado.
    await queryRunner.query(`
      INSERT INTO users (nome, email, password_hash, role, ativo)
      SELECT
        t.nome,
        COALESCE(NULLIF(LOWER(t.email), ''), 'tecnico' || t.id || '@local.aquatex.ao'),
        '$2b$10$OY6Skmi01TTBGyksi/u1XOGNLkWxIYGeD894IBnOaXgQnn9tnlExS',
        'campo',
        TRUE
        FROM tecnicos t
       WHERE t.id_user IS NULL
       ON CONFLICT (email) DO NOTHING;
    `);

    // Religar tecnicos aos users recém-criados
    await queryRunner.query(`
      UPDATE tecnicos t
         SET id_user = u.id
        FROM users u
       WHERE t.id_user IS NULL
         AND LOWER(u.email) IN (
           LOWER(COALESCE(NULLIF(t.email, ''), 'tecnico' || t.id || '@local.aquatex.ao'))
         );
    `);

    // 4. Constraints finais
    await queryRunner.query(`
      ALTER TABLE tecnicos DROP CONSTRAINT IF EXISTS tecnicos_id_user_fkey;
      ALTER TABLE tecnicos ALTER COLUMN id_user SET NOT NULL;
      ALTER TABLE tecnicos ADD CONSTRAINT uq_tecnicos_id_user UNIQUE (id_user);
      ALTER TABLE tecnicos ADD CONSTRAINT fk_tecnicos_id_user
        FOREIGN KEY (id_user) REFERENCES users(id) ON DELETE RESTRICT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverter constraints
    await queryRunner.query(`
      ALTER TABLE tecnicos DROP CONSTRAINT IF EXISTS fk_tecnicos_id_user;
      ALTER TABLE tecnicos DROP CONSTRAINT IF EXISTS uq_tecnicos_id_user;
      ALTER TABLE tecnicos ALTER COLUMN id_user DROP NOT NULL;
      ALTER TABLE tecnicos ADD CONSTRAINT tecnicos_id_user_fkey
        FOREIGN KEY (id_user) REFERENCES users(id) ON DELETE SET NULL;
    `);

    // CHECK do role: voltar a aceitar só os 4 originais
    await queryRunner.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;
      ALTER TABLE users ADD CONSTRAINT chk_users_role
        CHECK (role IN ('admin','suporte','campo','vendedor'));
    `);
    // Mapear coordenadores existentes para 'suporte' (semelhante)
    await queryRunner.query(`
      UPDATE users SET role = 'suporte' WHERE role = 'coordenador';
    `);

    // Nota: users criados automaticamente NÃO são removidos (decisão segura).
  }
}
