import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentoVenda, DocumentoVendaLinha } from './documento-venda.entity';
import { MovimentoCc } from './movimento-cc.entity';
import { DocumentoConfig } from '../vendas-config/documento-config.entity';
import { OrdemTrabalho } from '../ordens-trabalho/ordem-trabalho.entity';
import { TaxaIva } from '../tabelas-sistema/taxa-iva.entity';
import { ConfiguracaoEmpresa } from '../configuracao/configuracao-empresa.entity';
import { SysLogsModule } from '../sys-logs/sys-logs.module';
import { DocumentosVendaService } from './documentos-venda.service';
import { VendasController } from './vendas.controller';
import { ImpressaoFaturaService } from './impressao-fatura.service';
import { EstornosVendaService } from './estornos-venda.service';
import { RelatoriosVendasService } from './relatorios-vendas.service';

/**
 * #165 — Fase 2 do Módulo de Vendas de Intervenções (épico #163):
 * documentos de venda a partir de OTs finalizadas e pendente em conta corrente.
 * #169 — Fase 6: estorno (NC/ND) com abate automático do pendente.
 * #170 — Fase 7: impressão de NC/ND/FR e relatórios de vendas.
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([
            DocumentoVenda, DocumentoVendaLinha, MovimentoCc, DocumentoConfig, OrdemTrabalho, TaxaIva, ConfiguracaoEmpresa,
        ]),
        SysLogsModule,
    ],
    controllers: [VendasController],
    providers: [DocumentosVendaService, ImpressaoFaturaService, EstornosVendaService, RelatoriosVendasService],
})
export class VendasModule {}
