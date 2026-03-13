import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanoManutencao } from './plano-manutencao.entity';
import { PlanoMaoObra } from './plano-mao-obra.entity';
import { PlanoArtigo } from './plano-artigo.entity';
import { PlanosService } from './planos.service';
import { PlanosController } from './planos.controller';

@Module({
    imports: [TypeOrmModule.forFeature([PlanoManutencao, PlanoMaoObra, PlanoArtigo])],
    controllers: [PlanosController],
    providers: [PlanosService],
    exports: [TypeOrmModule, PlanosService],
})
export class PlanosModule {}
