import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Artigo } from './artigo.entity';
import { MovimentoStock } from './movimento-stock.entity';
import { ArtigosService } from './artigos.service';
import { ArtigosController, MovimentosStockController } from './artigos.controller';

@Module({
    imports: [TypeOrmModule.forFeature([Artigo, MovimentoStock])],
    controllers: [ArtigosController, MovimentosStockController],
    providers: [ArtigosService],
    exports: [TypeOrmModule, ArtigosService],
})
export class ArtigosModule {}
