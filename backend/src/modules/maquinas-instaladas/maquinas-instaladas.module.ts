import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaquinaInstalada } from './maquina-instalada.entity';

@Module({
    imports: [TypeOrmModule.forFeature([MaquinaInstalada])],
    exports: [TypeOrmModule],
})
export class MaquinasInstaladasModule { }
