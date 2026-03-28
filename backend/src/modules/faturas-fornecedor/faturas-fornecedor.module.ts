import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FaturaFornecedor } from './fatura-fornecedor.entity';
import { LinhaFaturaFornecedor } from './linha-fatura-fornecedor.entity';
import { FaturasFornecedorService } from './faturas-fornecedor.service';
import { FaturasFornecedorController } from './faturas-fornecedor.controller';
import { Artigo } from '../artigos/artigo.entity';

@Module({
    imports: [TypeOrmModule.forFeature([FaturaFornecedor, LinhaFaturaFornecedor, Artigo])],
    controllers: [FaturasFornecedorController],
    providers: [FaturasFornecedorService],
    exports: [TypeOrmModule, FaturasFornecedorService],
})
export class FaturasFornecedorModule {}
