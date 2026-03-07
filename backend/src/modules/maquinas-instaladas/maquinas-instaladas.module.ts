import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaquinaInstalada } from './maquina-instalada.entity';
import { MaquinaHistorico } from './maquina-historico.entity';

@Module({
    imports: [TypeOrmModule.forFeature([MaquinaInstalada, MaquinaHistorico])],
    exports: [TypeOrmModule],
})
export class MaquinasInstaladasModule { }
