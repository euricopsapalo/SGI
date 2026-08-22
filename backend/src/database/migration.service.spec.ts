import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { MigrationService } from './migration.service';

describe('MigrationService', () => {
  let service: MigrationService;
  let runMigrationsMock: jest.Mock;
  let queryMock: jest.Mock;
  let module: TestingModule;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    runMigrationsMock = jest.fn().mockResolvedValue([]);
    // Por defeito, nenhuma tabela existe → baseline é no-op (BD nova).
    queryMock = jest.fn().mockResolvedValue([{ exists: false }]);

    module = await Test.createTestingModule({
      providers: [
        MigrationService,
        {
          provide: getDataSourceToken(),
          useValue: {
            runMigrations: runMigrationsMock,
            query: queryMock,
          },
        },
      ],
    }).compile();

    service = module.get<MigrationService>(MigrationService);
  });

  afterEach(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.clearAllMocks();
    await module?.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit in production', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should call runMigrations when NODE_ENV is production', async () => {
      await service.onModuleInit();
      expect(runMigrationsMock).toHaveBeenCalledTimes(1);
    });

    it('should log "Nenhuma migration pendente" when runMigrations returns empty array', async () => {
      runMigrationsMock.mockResolvedValue([]);
      const logSpy = jest.spyOn(service['logger'], 'log');

      await service.onModuleInit();

      expect(logSpy).toHaveBeenCalledWith('Nenhuma migration pendente');
    });

    it('should log the number of migrations when runMigrations returns migrations', async () => {
      const fakeMigrations = [{ name: 'Migration1' }, { name: 'Migration2' }];
      runMigrationsMock.mockResolvedValue(fakeMigrations);
      const logSpy = jest.spyOn(service['logger'], 'log');

      await service.onModuleInit();

      expect(logSpy).toHaveBeenCalledWith(
        '2 migration(s) executada(s) com sucesso',
      );
    });
  });

  // #31 — o schema passou a ser versionado por migrações em todos os ambientes.
  describe('onModuleInit in development', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should call runMigrations when NODE_ENV is development', async () => {
      await service.onModuleInit();
      expect(runMigrationsMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('onModuleInit with undefined NODE_ENV', () => {
    beforeEach(() => {
      delete process.env.NODE_ENV;
    });

    it('should call runMigrations when NODE_ENV is undefined', async () => {
      await service.onModuleInit();
      expect(runMigrationsMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('onModuleInit in test', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('should NOT call runMigrations when NODE_ENV is test', async () => {
      await service.onModuleInit();
      expect(runMigrationsMock).not.toHaveBeenCalled();
    });

    it('should NOT touch the database when NODE_ENV is test', async () => {
      await service.onModuleInit();
      expect(queryMock).not.toHaveBeenCalled();
    });
  });

  // #152 — baseline de BDs legadas (schema herdado do init.sql sem registo de migrações).
  describe('baselineLegacySchema', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    /**
     * Encaminha cada query do mock para uma resposta plausível de Postgres,
     * consoante o SQL executado, simulando uma BD legada.
     */
    const legacyDbRouter =
      (opts: {
        tablesPresent: string[];
        migrationsCount?: number;
        seedPresent?: boolean;
        lookupFksPresent?: boolean;
        migrationRecords?: string[];
      }) =>
      (sql: string, params?: unknown[]) => {
        const records = opts.migrationRecords ?? [];
        if (sql.includes('to_regclass($1)')) {
          const table = String(params?.[0] ?? '').replace('public.', '');
          return Promise.resolve([{ exists: opts.tablesPresent.includes(table) }]);
        }
        if (sql.includes('COUNT(*)') && sql.includes('"migrations"')) {
          return Promise.resolve([{ count: opts.migrationsCount ?? 0 }]);
        }
        // Sentinel da InitialSchema (to_regclass literal de 'public.users').
        if (sql.includes("to_regclass('public.users')")) {
          return Promise.resolve([{ exists: opts.tablesPresent.includes('users') }]);
        }
        if (sql.includes('FROM tipos_trabalho')) {
          return Promise.resolve([{ exists: opts.seedPresent ?? false }]);
        }
        if (sql.includes('to_regclass') && sql.includes('ot_anexos')) {
          return Promise.resolve([{ exists: opts.tablesPresent.includes('ot_anexos') }]);
        }
        // Sentinel da LookupFks (deteta a FK pela coluna via information_schema).
        if (sql.includes('information_schema.table_constraints')) {
          return Promise.resolve([{ exists: opts.lookupFksPresent ?? false }]);
        }
        if (sql.startsWith('SELECT 1 FROM "migrations" WHERE "name"')) {
          const name = String(params?.[0] ?? '');
          return Promise.resolve(records.includes(name) ? [{ '?column?': 1 }] : []);
        }
        if (sql.startsWith('CREATE TABLE IF NOT EXISTS "migrations"')) {
          return Promise.resolve([]);
        }
        if (sql.startsWith('INSERT INTO "migrations"')) {
          records.push(String(params?.[1] ?? ''));
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      };

    it('does not baseline a fresh DB (no users table) and lets runMigrations build it', async () => {
      queryMock.mockImplementation(legacyDbRouter({ tablesPresent: [] }));

      await service.onModuleInit();

      const inserts = queryMock.mock.calls.filter(([sql]) =>
        String(sql).startsWith('INSERT INTO "migrations"'),
      );
      expect(inserts).toHaveLength(0);
      expect(runMigrationsMock).toHaveBeenCalledTimes(1);
    });

    it('does not baseline a healthy DB that already has migration records', async () => {
      queryMock.mockImplementation(
        legacyDbRouter({ tablesPresent: ['users', 'migrations'], migrationsCount: 3 }),
      );

      await service.onModuleInit();

      const inserts = queryMock.mock.calls.filter(([sql]) =>
        String(sql).startsWith('INSERT INTO "migrations"'),
      );
      expect(inserts).toHaveLength(0);
      expect(runMigrationsMock).toHaveBeenCalledTimes(1);
    });

    it('baselines schema/seed/lookup-fks on a legacy init.sql DB without ot_anexos', async () => {
      const inserted: string[] = [];
      queryMock.mockImplementation(
        legacyDbRouter({
          tablesPresent: ['users', 'tipos_trabalho'],
          migrationsCount: 0,
          seedPresent: true,
          lookupFksPresent: true,
          migrationRecords: inserted,
        }),
      );

      await service.onModuleInit();

      expect(inserted).toContain('InitialSchema1786743588363');
      expect(inserted).toContain('InitialSeed1786745000000');
      // A BD legada já tinha as FKs de lookup → baseline evita duplicá-las.
      expect(inserted).toContain('LookupFksManyToOne1787168341785');
      // ot_anexos não existe na BD legada → migração fica pendente para correr.
      expect(inserted).not.toContain('AddOtAnexos1786800000000');
      expect(runMigrationsMock).toHaveBeenCalledTimes(1);
    });

    it('also baselines AddOtAnexos when ot_anexos already exists', async () => {
      const inserted: string[] = [];
      queryMock.mockImplementation(
        legacyDbRouter({
          tablesPresent: ['users', 'tipos_trabalho', 'ot_anexos'],
          migrationsCount: 0,
          seedPresent: true,
          migrationRecords: inserted,
        }),
      );

      await service.onModuleInit();

      expect(inserted).toContain('AddOtAnexos1786800000000');
    });

    it('creates the migrations table before inserting baseline records', async () => {
      queryMock.mockImplementation(
        legacyDbRouter({
          tablesPresent: ['users', 'tipos_trabalho'],
          migrationsCount: 0,
          seedPresent: true,
        }),
      );

      await service.onModuleInit();

      const createIdx = queryMock.mock.calls.findIndex(([sql]) =>
        String(sql).startsWith('CREATE TABLE IF NOT EXISTS "migrations"'),
      );
      const firstInsertIdx = queryMock.mock.calls.findIndex(([sql]) =>
        String(sql).startsWith('INSERT INTO "migrations"'),
      );
      expect(createIdx).toBeGreaterThanOrEqual(0);
      expect(firstInsertIdx).toBeGreaterThan(createIdx);
    });
  });
});
