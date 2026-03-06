import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comissao } from './comissao.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Comissao])],
    exports: [TypeOrmModule],
})
export class ComissoesModule { }
