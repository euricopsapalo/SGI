import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SysLog } from './sys-log.entity';
import { SysLogsService } from './sys-logs.service';
import { SysLogsController } from './sys-logs.controller';
import { ConfiguracaoModule } from '../configuracao/configuracao.module';

@Module({
    imports: [TypeOrmModule.forFeature([SysLog]), ConfiguracaoModule],
    controllers: [SysLogsController],
    providers: [SysLogsService],
    exports: [TypeOrmModule, SysLogsService],
})
export class SysLogsModule {}
