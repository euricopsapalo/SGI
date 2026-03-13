import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModeloEquipamento } from './modelo-equipamento.entity';
import { EquipInstalado } from './equip-instalado.entity';
import { EquipHistorico } from './equip-historico.entity';
import { ParqueService } from './parque.service';
import { ModelosEquipamentoController, EquipInstaladosController } from './parque.controller';

@Module({
    imports: [TypeOrmModule.forFeature([ModeloEquipamento, EquipInstalado, EquipHistorico])],
    controllers: [ModelosEquipamentoController, EquipInstaladosController],
    providers: [ParqueService],
    exports: [TypeOrmModule, ParqueService],
})
export class ParqueModule {}
