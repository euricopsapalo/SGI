import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Equipamento } from './equipamento.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Equipamento])],
    exports: [TypeOrmModule],
})
export class EquipamentosModule { }
