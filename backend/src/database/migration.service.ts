import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class MigrationService implements OnModuleInit {
  private readonly logger = new Logger(MigrationService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    // #31 — com synchronize desligado, as migrações constroem o schema em todos
    // os ambientes. Em 'test' não há BD real (suites usam repos mockados), por
    // isso não se corre nada.
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    this.logger.log(`Running migrations (NODE_ENV=${process.env.NODE_ENV ?? 'development'})`);

    const migrations = await this.dataSource.runMigrations();

    if (migrations.length === 0) {
      this.logger.log('Nenhuma migration pendente');
    } else {
      this.logger.log(`${migrations.length} migration(s) executada(s) com sucesso`);
    }
  }
}
