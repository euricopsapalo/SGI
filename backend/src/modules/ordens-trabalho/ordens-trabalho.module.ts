import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdemTrabalho } from './ordem-trabalho.entity';
import { OtMaoObra } from './ot-mao-obra.entity';
import { OtArtigo } from './ot-artigo.entity';
import { OtReprogramacao } from './ot-reprogramacao.entity';
import { OrdensTrabalhoService } from './ordens-trabalho.service';
import { OrdensTrabalhoController } from './ordens-trabalho.controller';
import { ArtigosModule } from '../artigos/artigos.module';
import { SysLogsModule } from '../sys-logs/sys-logs.module';
import { Tecnico } from '../tecnicos/tecnico.entity';
import { EquipInstalado } from '../parque/equip-instalado.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([OrdemTrabalho, OtMaoObra, OtArtigo, OtReprogramacao, Tecnico, EquipInstalado]),
        ArtigosModule,
        SysLogsModule,
    ],
    controllers: [OrdensTrabalhoController],
    providers: [OrdensTrabalhoService],
    exports: [TypeOrmModule, OrdensTrabalhoService],
})
export class OrdensTrabalhoModule {}
