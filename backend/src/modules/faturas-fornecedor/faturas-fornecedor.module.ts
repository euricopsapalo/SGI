import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FaturaFornecedor } from './fatura-fornecedor.entity';
import { LinhaFaturaFornecedor } from './linha-fatura-fornecedor.entity';
import { VncFaturaAssociada } from './vnc-fatura-associada.entity';
import { FaturasFornecedorService } from './faturas-fornecedor.service';
import { FaturasFornecedorController } from './faturas-fornecedor.controller';
import { Artigo } from '../artigos/artigo.entity';
import { MovimentoStock } from '../artigos/movimento-stock.entity';

@Module({
    imports: [TypeOrmModule.forFeature([FaturaFornecedor, LinhaFaturaFornecedor, Artigo, VncFaturaAssociada, MovimentoStock])],
    controllers: [FaturasFornecedorController],
    providers: [FaturasFornecedorService],
    exports: [TypeOrmModule, FaturasFornecedorService],
})
export class FaturasFornecedorModule {}
