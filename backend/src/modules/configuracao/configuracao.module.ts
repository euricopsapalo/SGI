import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfiguracaoEmpresa } from './configuracao-empresa.entity';

@Module({
    imports: [TypeOrmModule.forFeature([ConfiguracaoEmpresa])],
    exports: [TypeOrmModule],
})
export class ConfiguracaoModule { }
