import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tecnico } from './tecnico.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Tecnico])],
    exports: [TypeOrmModule],
})
export class TecnicosModule { }
