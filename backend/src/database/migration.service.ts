import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Migração a "baselinar" quando a BD já traz o schema mas a tabela `migrations`
 * está vazia (BD legada do antigo `postgres/init.sql`). O `sentinel` deteta se
 * os objetos dessa migração já existem; em caso afirmativo, a migração é
 * marcada como executada em vez de voltar a correr (evita 42P07). Ordenar por
 * timestamp crescente. Ver #152 (relacionado com #31).
 */
interface BaselineCandidate {
  name: string;
  timestamp: number;
  sentinel: string;
}

@Injectable()
export class MigrationService implements OnModuleInit {
  private readonly logger = new Logger(MigrationService.name);

  // Cada sentinel devolve uma linha `{ exists: boolean }`. São robustos a
  // tabelas ausentes (usam to_regclass) para nunca rebentarem na deteção.
  private static readonly BASELINE_MIGRATIONS: BaselineCandidate[] = [
    {
      name: 'InitialSchema1786743588363',
      timestamp: 1786743588363,
      sentinel: `SELECT to_regclass('public.users') IS NOT NULL AS exists`,
    },
    {
      name: 'InitialSeed1786745000000',
      timestamp: 1786745000000,
      sentinel:
        `SELECT CASE WHEN to_regclass('public.tipos_trabalho') IS NULL THEN false ` +
        `ELSE EXISTS(SELECT 1 FROM tipos_trabalho WHERE id = 1) END AS exists`,
    },
    {
      name: 'AddOtAnexos1786800000000',
      timestamp: 1786800000000,
      sentinel: `SELECT to_regclass('public.ot_anexos') IS NOT NULL AS exists`,
    },
    {
      // FKs de lookup do #36/#31. A BD legada (init.sql) já as tinha, embora
      // com nomes próprios — por isso o sentinel deteta a FK pela coluna, não
      // pelo nome gerado pelo TypeORM (evita constraints duplicadas).
      name: 'LookupFksManyToOne1787168341785',
      timestamp: 1787168341785,
      sentinel:
        `SELECT EXISTS(SELECT 1 FROM information_schema.table_constraints tc ` +
        `JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name ` +
        `WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'clientes' ` +
        `AND kcu.column_name = 'condicao_pagamento_id') AS exists`,
    },
  ];

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    // #31 — com synchronize desligado, as migrações constroem o schema em todos
    // os ambientes. Em 'test' não há BD real (suites usam repos mockados), por
    // isso não se corre nada.
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    this.logger.log(`Running migrations (NODE_ENV=${process.env.NODE_ENV ?? 'development'})`);

    // #152 — recuperar BDs legadas (schema herdado do init.sql, registo de
    // migrações vazio) antes de correr as migrações, para o arranque não falhar
    // com "relation already exists".
    await this.baselineLegacySchema();

    const migrations = await this.dataSource.runMigrations();

    if (migrations.length === 0) {
      this.logger.log('Nenhuma migration pendente');
    } else {
      this.logger.log(`${migrations.length} migration(s) executada(s) com sucesso`);
    }
  }

  /**
   * #152 — Deteta o cenário "a BD tem o schema mas a tabela `migrations` não
   * sabe disso" (herdado da transição init.sql → migrações TypeORM, #31) e faz
   * baseline: marca como executadas apenas as migrações cujos objetos já
   * existem, deixando as genuinamente pendentes correr normalmente.
   *
   * Numa BD nova (sem `users`) não faz nada — o `runMigrations` constrói tudo.
   * Numa BD saudável (já com registos em `migrations`) também não faz nada.
   */
  private async baselineLegacySchema(): Promise<void> {
    const schemaExists = await this.tableExists('users');

    // BD nova: deixar o runMigrations criar tudo de raiz.
    if (!schemaExists) {
      return;
    }

    // BD já rastreada por migrações: nada a fazer.
    if (await this.hasMigrationRecords()) {
      return;
    }

    this.logger.warn(
      'Schema pré-existente detetado com registo de migrações vazio (BD legada do init.sql). ' +
        'A fazer baseline das migrações cujos objetos já existem — ver #152. ' +
        'O caminho limpo em dev continua a ser recriar o volume (docker compose down -v).',
    );

    await this.ensureMigrationsTable();

    for (const candidate of MigrationService.BASELINE_MIGRATIONS) {
      const [row] = await this.dataSource.query(candidate.sentinel);
      if (!row?.exists) {
        continue;
      }

      const existing = await this.dataSource.query(
        `SELECT 1 FROM "migrations" WHERE "name" = $1 LIMIT 1`,
        [candidate.name],
      );
      if (existing.length > 0) {
        continue;
      }

      await this.dataSource.query(
        `INSERT INTO "migrations" ("timestamp", "name") VALUES ($1, $2)`,
        [candidate.timestamp, candidate.name],
      );
      this.logger.warn(
        `Baseline: migração "${candidate.name}" marcada como executada (objetos já existiam).`,
      );
    }
  }

  private async tableExists(table: string): Promise<boolean> {
    const [row] = await this.dataSource.query(
      `SELECT to_regclass($1) IS NOT NULL AS exists`,
      [`public.${table}`],
    );
    return Boolean(row?.exists);
  }

  private async hasMigrationRecords(): Promise<boolean> {
    if (!(await this.tableExists('migrations'))) {
      return false;
    }
    const [row] = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM "migrations"`,
    );
    return Number(row?.count ?? 0) > 0;
  }

  private async ensureMigrationsTable(): Promise<void> {
    await this.dataSource.query(
      `CREATE TABLE IF NOT EXISTS "migrations" (` +
        `"id" SERIAL NOT NULL, ` +
        `"timestamp" bigint NOT NULL, ` +
        `"name" character varying NOT NULL, ` +
        `CONSTRAINT "PK_migrations_id" PRIMARY KEY ("id"))`,
    );
  }
}
