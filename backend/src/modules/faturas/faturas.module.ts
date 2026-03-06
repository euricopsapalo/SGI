import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Fatura } from './fatura.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Fatura])],
    exports: [TypeOrmModule],
})
export class FaturasModule { }
