import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Artigo } from './artigo.entity';
import { MovimentoStock } from './movimento-stock.entity';
import { StockArmazem } from './stock-armazem.entity';
import { Armazem } from '../armazens/armazem.entity';
import { ArtigosService } from './artigos.service';
import { ArtigosController, MovimentosStockController } from './artigos.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Artigo, MovimentoStock, StockArmazem, Armazem])],
    controllers: [ArtigosController, MovimentosStockController],
    providers: [ArtigosService],
    exports: [TypeOrmModule, ArtigosService],
})
export class ArtigosModule {}
