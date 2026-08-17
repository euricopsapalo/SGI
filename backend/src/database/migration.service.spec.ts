import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { MigrationService } from './migration.service';

describe('MigrationService', () => {
  let service: MigrationService;
  let runMigrationsMock: jest.Mock;
  let module: TestingModule;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    runMigrationsMock = jest.fn().mockResolvedValue([]);

    module = await Test.createTestingModule({
      providers: [
        MigrationService,
        {
          provide: getDataSourceToken(),
          useValue: {
            runMigrations: runMigrationsMock,
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
  });
});
