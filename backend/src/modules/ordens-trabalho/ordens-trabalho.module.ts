import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdemTrabalho } from './ordem-trabalho.entity';
import { OtMaoObra } from './ot-mao-obra.entity';
import { OtArtigo } from './ot-artigo.entity';
import { OtReprogramacao } from './ot-reprogramacao.entity';
import { OrdensTrabalhoService } from './ordens-trabalho.service';
import { StockReservaService } from './stock-reserva.service';
import { OrdensTrabalhoController } from './ordens-trabalho.controller';
import { ArtigosModule } from '../artigos/artigos.module';
import { SysLogsModule } from '../sys-logs/sys-logs.module';
import { Tecnico } from '../tecnicos/tecnico.entity';
import { EquipInstalado } from '../parque/equip-instalado.entity';
import { User } from '../users/user.entity';
import { ConfiguracaoEmpresa } from '../configuracao/configuracao-empresa.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([OrdemTrabalho, OtMaoObra, OtArtigo, OtReprogramacao, Tecnico, EquipInstalado, User, ConfiguracaoEmpresa]),
        ArtigosModule,
        SysLogsModule,
    ],
    controllers: [OrdensTrabalhoController],
    providers: [OrdensTrabalhoService, StockReservaService],
    exports: [TypeOrmModule, OrdensTrabalhoService, StockReservaService],
})
export class OrdensTrabalhoModule {}
