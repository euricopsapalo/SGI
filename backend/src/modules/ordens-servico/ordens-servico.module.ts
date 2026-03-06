import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdemDeServico } from './ordem-de-servico.entity';
import { OsPeca } from './os-peca.entity';

@Module({
    imports: [TypeOrmModule.forFeature([OrdemDeServico, OsPeca])],
    exports: [TypeOrmModule],
})
export class OrdensServicoModule { }
