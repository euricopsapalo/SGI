import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Liquidacao, LiquidacaoLinha } from './liquidacao.entity';
import { MovimentoConta } from './movimento-conta.entity';
import { SysLogsModule } from '../sys-logs/sys-logs.module';
import { ContaCorrenteService } from './conta-corrente.service';
import { LiquidacoesService } from './liquidacoes.service';
import { ContaCorrenteController, LiquidacoesController } from './tesouraria.controller';

/**
 * #166 + #174 — Fase 3 do Módulo de Vendas de Intervenções (épico #163):
 * pendentes filtráveis, liquidações (`RE`), Movimento em conta (`MC`) e extrato.
 */
@Module({
    imports: [TypeOrmModule.forFeature([Liquidacao, LiquidacaoLinha, MovimentoConta]), SysLogsModule],
    controllers: [ContaCorrenteController, LiquidacoesController],
    providers: [ContaCorrenteService, LiquidacoesService],
})
export class TesourariaModule {}
