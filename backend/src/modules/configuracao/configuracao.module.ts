import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfiguracaoEmpresa } from './configuracao-empresa.entity';
import { ConfiguracaoService } from './configuracao.service';
import { ConfiguracaoController } from './configuracao.controller';

@Module({
    imports: [TypeOrmModule.forFeature([ConfiguracaoEmpresa])],
    controllers: [ConfiguracaoController],
    providers: [ConfiguracaoService],
    exports: [TypeOrmModule, ConfiguracaoService],
})
export class ConfiguracaoModule { }
