import { Global, Module } from '@nestjs/common';
import { MigrationService } from './migration.service';

@Global()
@Module({
  providers: [MigrationService],
  exports: [MigrationService],
})
export class DatabaseModule {}
