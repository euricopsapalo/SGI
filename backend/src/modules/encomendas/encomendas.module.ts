import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Encomenda } from './encomenda.entity';
import { EncomendaLinha } from './encomenda-linha.entity';
import { EncomendaService } from './encomendas.service';
import { EncomendaController } from './encomendas.controller';
import { Artigo } from '../artigos/artigo.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Encomenda, EncomendaLinha, Artigo])],
    controllers: [EncomendaController],
    providers: [EncomendaService],
    exports: [TypeOrmModule, EncomendaService],
})
export class EncomendaModule {}
