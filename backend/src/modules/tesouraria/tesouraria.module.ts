import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Liquidacao, LiquidacaoLinha } from './liquidacao.entity';
import { MovimentoConta } from './movimento-conta.entity';
import { SessaoCaixa } from './sessao-caixa.entity';
import { ContaBancaria } from '../vendas-config/conta-bancaria.entity';
import { SysLogsModule } from '../sys-logs/sys-logs.module';
import { ContaCorrenteService } from './conta-corrente.service';
import { LiquidacoesService } from './liquidacoes.service';
import { ImpressaoReciboService } from './impressao-recibo.service';
import { ImpressaoPendentesService } from './impressao-pendentes.service';
import { CaixaService } from './caixa.service';
import { CaixaController, ContaCorrenteController, LiquidacoesController } from './tesouraria.controller';

/**
 * #166 + #174 — Fase 3 do Módulo de Vendas de Intervenções (épico #163):
 * pendentes filtráveis, liquidações (`RE`), Movimento em conta (`MC`) e extrato.
 * #167 — Fase 4: gestão de caixa (abertura, saída, fecho com apuramento e acerto).
 * #175 — impressão da lista de pendentes filtrada e do detalhe de um pendente.
 */
@Module({
    imports: [TypeOrmModule.forFeature([Liquidacao, LiquidacaoLinha, MovimentoConta, SessaoCaixa, ContaBancaria]), SysLogsModule],
    controllers: [ContaCorrenteController, LiquidacoesController, CaixaController],
    providers: [ContaCorrenteService, LiquidacoesService, ImpressaoReciboService, ImpressaoPendentesService, CaixaService],
})
export class TesourariaModule {}
