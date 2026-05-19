import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tecnico } from './tecnico.entity';
import { TecnicosService } from './tecnicos.service';
import { TecnicosController } from './tecnicos.controller';
import { User } from '../users/user.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Tecnico, User])],
    controllers: [TecnicosController],
    providers: [TecnicosService],
    exports: [TypeOrmModule, TecnicosService],
})
export class TecnicosModule { }
