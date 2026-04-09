import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class MigrationService implements OnModuleInit {
  private readonly logger = new Logger(MigrationService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    const isProduction = process.env.NODE_ENV === 'production';

    this.logger.log(
      `Running in ${isProduction ? 'production' : 'development'} mode`,
    );

    if (isProduction) {
      const migrations = await this.dataSource.runMigrations();

      if (migrations.length === 0) {
        this.logger.log('Nenhuma migration pendente');
      } else {
        this.logger.log(`${migrations.length} migration(s) executada(s) com sucesso`);
      }
    }
  }
}
