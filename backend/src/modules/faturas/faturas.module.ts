import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Fatura } from './fatura.entity';
import { FaturaLinha } from './fatura-linha.entity';
import { FaturasService } from './faturas.service';
import { FaturasController } from './faturas.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Fatura, FaturaLinha])],
    controllers: [FaturasController],
    providers: [FaturasService],
    exports: [TypeOrmModule, FaturasService],
})
export class FaturasModule { }
